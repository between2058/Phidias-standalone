'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo, useReducer, Suspense } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import SegmentAIPanel from '@/components/segment/SegmentAIPanel';
import type { P3SAMParams, SegmentResult } from '@/components/segment/SegmentAIPanel';
import ExportDropdown from '@/components/shared/ExportDropdown';

import type { TransformValues } from '@/components/shared/TransformPanel';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';
import { findObjectInScene, transformDataToValues } from '@/lib/scene';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { exportSceneToGlb, validateAndFixMaterials, type PhidiasMetadata } from '@/lib/three/loaders';
import { useWorkspace } from '@/lib/workspace-context';
import type { Asset } from '@/lib/workspace-context';
import { useSegmentStore } from '@/store/segment-store';
import { usePhidiasStore } from '@/store/phidias-store';
import { useConnectionAvailability, useConnectionCount } from '@/hooks/useJobManager';
import { segment3D, smartOrganize, JobSubmitResponse } from '@/lib/api/phidias';
import type { SmartOrganizeResult } from '@/lib/api/phidias';
import { computeRadialVectors, explodeOffset, easeInOutCubic } from '@/lib/segment/explode';

const ThreeViewport = dynamic(() => import('@/components/shared/ThreeViewport'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
      <div className="flex flex-col items-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#D5B451', borderRightColor: 'rgba(213,180,81,0.3)' }} />
          <div className="absolute inset-1.5 rounded-full animate-spin" style={{ border: '1.5px solid transparent', borderBottomColor: 'rgba(139,124,200,0.6)', animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="text-[#64748b] text-[11px] mt-3 tracking-wide">Loading viewport</p>
      </div>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Part {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  meshIds: string[];     // all mesh IDs belonging to this part
  isGroup?: boolean;     // true = logical group folder
  childIds?: string[];   // if group: contained part IDs
  parentId?: string;     // parent group ID if nested
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_PALETTE = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#a855f7', '#14b8a6', '#eab308',
];


// ─── Helpers ─────────────────────────────────────────────────────────────────

function flattenMeshes(items: HierarchyItem[]): HierarchyItem[] {
  const result: HierarchyItem[] = [];
  function walk(nodes: HierarchyItem[]) {
    for (const n of nodes) {
      if (n.type === 'mesh') result.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(items);
  return result;
}

/** Scan the scene graph for merged / group nodes and return Part descriptors. */
function detectMergedAndGroupNodes(
  nodes: HierarchyItem[],
  palette: string[],
  colorOffset: number,
): { mergedParts: Part[]; groupParts: Part[]; claimedMeshIds: Set<string> } {
  const mergedParts: Part[] = [];
  const groupParts: Part[] = [];
  const claimedMeshIds = new Set<string>();
  let idx = colorOffset;

  function walk(items: HierarchyItem[]) {
    for (const n of items) {
      if (n.type === 'group' && n.id.startsWith('merged_') && n.children) {
        const childMeshIds = flattenMeshes(n.children).map(m => m.id);
        if (childMeshIds.length > 0) {
          const color = palette[idx++ % palette.length];
          mergedParts.push({
            id: n.id,
            name: n.name,
            color,
            visible: n.visible,
            meshIds: childMeshIds,
          });
          childMeshIds.forEach(mid => claimedMeshIds.add(mid));
        }
      } else if (n.type === 'group' && n.id.startsWith('group_') && n.children) {
        // Collect direct child IDs (both mesh parts and merged parts)
        const childIds = n.children.map(c => c.id);
        groupParts.push({
          id: n.id,
          name: n.name || `Group (${childIds.length})`,
          color: '#94a3b8',
          visible: n.visible,
          meshIds: [],
          isGroup: true,
          childIds,
        });
        // Recurse into group children to find nested merged nodes
        walk(n.children);
      } else if (n.children) {
        walk(n.children);
      }
    }
  }
  walk(nodes);
  return { mergedParts, groupParts, claimedMeshIds };
}

function _buildSegmentColors(parts: Part[]): Record<string, string> {
  const colors: Record<string, string> = {};
  parts.forEach(p => p.meshIds.forEach(mid => { colors[mid] = p.color; }));
  return colors;
}

function buildMeshToPartId(parts: Part[]): Record<string, string> {
  const map: Record<string, string> = {};
  parts.forEach(p => p.meshIds.forEach(mid => { map[mid] = p.id; }));
  return map;
}

function partsToHierarchyItems(parts: Part[]): HierarchyItem[] {
  const topLevel = parts.filter(p => !p.parentId);
  return topLevel.map(p => {
    if (p.isGroup && p.childIds) {
      const children: HierarchyItem[] = p.childIds
        .map(cid => parts.find(c => c.id === cid))
        .filter((c): c is Part => c != null)
        .map(c => ({ id: c.id, name: c.name, visible: c.visible, type: 'mesh' as const }));
      return { id: p.id, name: p.name, visible: p.visible, type: 'group' as const, children };
    }
    const type: HierarchyItem['type'] = p.meshIds.length > 1 ? 'group' : 'mesh';
    return { id: p.id, name: p.name, visible: p.visible, type };
  });
}

// ─── Screenshot helpers ──────────────────────────────────────────────────────

/** Camera angles for multi-view capture: [azimuth°, elevation°, label] */
const CAPTURE_ANGLES: [number, number, string][] = [
  [30, 20, 'front-right'],
  [210, 20, 'back-left'],
  [120, 60, 'top-side'],
];

/** Render the scene group from a specific angle to a PNG Blob. */
function renderFromAngle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  group: THREE.Group,
  center: THREE.Vector3,
  dist: number,
  azimuthDeg: number,
  elevationDeg: number,
): Promise<Blob> {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  camera.position.set(
    center.x + dist * Math.cos(el) * Math.sin(az),
    center.y + dist * Math.sin(el),
    center.z + dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(center);
  renderer.render(scene, camera);

  return new Promise<Blob>((resolve, reject) => {
    renderer.domElement.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Screenshot capture failed')),
      'image/png',
    );
  });
}

/** Swap all mesh materials to segment colors, returns a restore function. */
function applySegmentColorMaterials(
  group: THREE.Group,
  parts: Part[],
): () => void {
  const overrides: { mesh: THREE.Mesh; origMat: THREE.Material | THREE.Material[] }[] = [];
  const colorMap = new Map<string, string>();
  for (const p of parts) {
    const color = p.color || '';
    if (color) p.meshIds.forEach(mid => colorMap.set(mid, color));
  }

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const id = child.name || child.uuid;
    const color = colorMap.get(id);
    if (color) {
      overrides.push({ mesh: child, origMat: child.material });
      child.material = new THREE.MeshStandardMaterial({
        color, roughness: 0.6, metalness: 0.1,
      });
    }
  });

  return () => {
    for (const { mesh, origMat } of overrides) {
      mesh.material = origMat;
    }
  };
}

/**
 * Capture multi-angle screenshots in both original and colored modes.
 * Returns { original: Blob[], colored: Blob[] } — one per CAPTURE_ANGLES entry.
 */
async function captureMultiViewScreenshots(
  group: THREE.Group,
  parts: Part[],
): Promise<{ original: Blob[]; colored: Blob[] }> {
  const w = 768, h = 768;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x1a1a2e, 1);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 1.8;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, maxDim * 100);

  const tempScene = new THREE.Scene();
  tempScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(1, 2, 1);
  tempScene.add(dir);

  const savedParent = group.parent;
  tempScene.add(group);

  // 1. Capture original texture from all angles
  const original: Blob[] = [];
  for (const [az, el] of CAPTURE_ANGLES) {
    original.push(await renderFromAngle(renderer, tempScene, camera, group, center, dist, az, el));
  }

  // 2. Swap to segment colors and capture from all angles
  const restoreMaterials = applySegmentColorMaterials(group, parts);
  const colored: Blob[] = [];
  for (const [az, el] of CAPTURE_ANGLES) {
    colored.push(await renderFromAngle(renderer, tempScene, camera, group, center, dist, az, el));
  }
  restoreMaterials();

  // Restore parent
  tempScene.remove(group);
  if (savedParent) savedParent.add(group);
  renderer.dispose();

  return { original, colored };
}

/** Read the material colour of every Mesh child in the scene group. */
function getMeshColors(group: THREE.Group): { id: string; color: string }[] {
  const result: { id: string; color: string }[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (mat?.color) {
        result.push({ id: child.name || child.uuid, color: '#' + mat.color.getHexString() });
      }
    }
  });
  return result;
}

// ─── splitSegmentedGlb ────────────────────────────────────────────────────────
// P3-SAM returns a single mesh with COLOR_0 vertex attributes (one color per
// segment).  This helper splits it into one Three.js Mesh per colour group so
// that the scene graph contains selectable individual parts.
// The per-group material colour comes from P3-SAM's vertex colours — no
// SEGMENT_PALETTE is applied here.
async function splitSegmentedGlb(blob: Blob): Promise<{ blob: Blob; partCount: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      URL.revokeObjectURL(url);
      const scene = gltf.scene;
      const toProcess: THREE.Mesh[] = [];
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) toProcess.push(child);
      });

      for (const child of toProcess) {
        const geo = child.geometry as THREE.BufferGeometry;
        const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
        if (!colorAttr) continue;

        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
        const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
        const indexAttr = geo.index;

        // Group face starts by the first vertex's RGB colour (0-255 key)
        const colorGroups = new Map<string, number[]>();
        const faceCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
        for (let f = 0; f < faceCount; f++) {
          const vi = indexAttr ? indexAttr.getX(f * 3) : f * 3;
          const r = Math.round(colorAttr.getX(vi) * 255);
          const g = Math.round(colorAttr.getY(vi) * 255);
          const b = Math.round(colorAttr.getZ(vi) * 255);
          const key = `${r},${g},${b}`;
          if (!colorGroups.has(key)) colorGroups.set(key, []);
          colorGroups.get(key)!.push(f);
        }

        if (colorGroups.size <= 1) continue; // nothing to split

        const parent = child.parent ?? scene;
        let partIndex = 0;

        for (const [colorKey, faces] of Array.from(colorGroups.entries())) {
          const positions: number[] = [];
          const normals: number[] = [];
          const uvs: number[] = [];

          for (const f of faces) {
            for (let j = 0; j < 3; j++) {
              const vi = indexAttr ? indexAttr.getX(f * 3 + j) : f * 3 + j;
              positions.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
              if (normAttr) normals.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
              if (uvAttr) uvs.push(uvAttr.getX(vi), uvAttr.getY(vi));
            }
          }

          const newGeo = new THREE.BufferGeometry();
          newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          if (normals.length) newGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          if (uvs.length) newGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

          const [r, g, b] = colorKey.split(',').map(Number);
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(r / 255, g / 255, b / 255),
          });

          const mesh = new THREE.Mesh(newGeo, mat);
          mesh.name = `part_${partIndex}`;
          mesh.applyMatrix4(child.matrixWorld);
          parent.add(mesh);
          partIndex++;
        }

        parent.remove(child);
      }

      // Count total meshes in the processed scene for partCount reporting
      let totalParts = 0;
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) totalParts++;
      });

      // Fix any corrupted materials before export
      validateAndFixMaterials(scene);

      import('three/examples/jsm/exporters/GLTFExporter.js').then(({ GLTFExporter }) => {
        const exporter = new GLTFExporter();
        exporter.parse(
          scene,
          (result) => resolve({
            blob: new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }),
            partCount: totalParts,
          }),
          (err: unknown) => reject(err),
          { binary: true },
        );
      }).catch(reject);
    }, undefined, (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    });
  });
}

// ─── Page component ──────────────────────────────────────────────────────────

/** Duration of the exploded-view dilate/converge animation, in milliseconds. */
const EXPLODE_ANIM_MS = 600;

export default function SegmentPage() {
  const { setSceneGraph, setSegmentHierarchy, assets, activeAssetId, addAsset, setActiveAssetId, updateAsset, updateAssetThumbnail } = useWorkspace();
  const activeModelUrl = assets.find(a => a.id === activeAssetId)?.modelUrl ?? null;

  // Ref mirror of the current active asset for synchronous reads inside callbacks.
  // Updated via useEffect so it's always current without adding reactive deps.
  const activeAssetRef = useRef<(typeof assets)[number] | null>(null);
  useEffect(() => {
    activeAssetRef.current = assets.find(a => a.id === activeAssetId) ?? null;
  }, [assets, activeAssetId]);

  const sceneRef = useRef<THREE.Group | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // When true, the next handleSceneGraphChange call assigns SEGMENT_PALETTE
  // colours to the newly created parts (set right before model replacement
  // after segmentation).
  const pendingColorRef = useRef(false);

  // NOTE: suppressAutoColorRef has been removed. In /segment, auto-colour is
  // always applied when a new model loads — regardless of whether it was previously
  // segmented/organised or carried __PHIDIAS_METADATA__.

  // ── Mesh registry for scene rebuild on undo/redo ──────────────────────────
  // meshRegistryRef: meshId → { obj, origParent } — built at scene-ready time
  const meshRegistryRef = useRef<Map<string, { obj: THREE.Object3D; origParent: THREE.Object3D }>>(new Map());

  // ── Local Imperative Transform History ────────────────────────────────────
  // Because Zundo state rebuilds break Three.js SkinnedMesh parent/child
  // structures, we track transform position/rotation/scale imperatively here.
  const transformHistoryRef = useRef<Record<string, TransformValues>[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndoTransform, setCanUndoTransform] = useState(false);
  const [canRedoTransform, setCanRedoTransform] = useState(false);

  // ── Parts state — backed by Zundo temporal store ──────────────────────────
  const { parts, setParts } = useSegmentStore();

  // Trigger re-render when temporal store changes (for button disabled state)
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  // Keep a stable ref to rebuildThreeScene so the temporal subscriber (below)
  // can call the latest version without being a stale closure.
  const rebuildRef = useRef<(parts: Part[]) => void>(() => { });

  // ── View mode: 'original' shows native materials, 'colored' shows palette ──
  // Initialize from store: if parts already have colors (e.g. tab switch), start in 'colored'.
  const [viewMode, setViewMode] = useState<'original' | 'colored'>(() => {
    const stored = useSegmentStore.getState().parts;
    return stored.some(p => p.color !== '') ? 'colored' : 'original';
  });

  // When switching to colored mode, auto-assign palette colors to parts that lack them
  const handleViewModeChange = useCallback((mode: 'original' | 'colored') => {
    if (mode === 'colored') {
      const current = useSegmentStore.getState().parts;
      const needsColors = current.filter(p => !p.isGroup && !p.color);
      if (needsColors.length > 0) {
        const updated = current.map((p, i) => {
          if (!p.isGroup && !p.color) {
            return { ...p, color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] };
          }
          return p;
        });
        setParts(updated);
      }
    }
    setViewMode(mode);
  }, [setParts]);

  // Derive colors and meshId map from parts (replaces explicit setState calls)
  const segmentColors = useMemo(() => {
    if (viewMode === 'original') return {};
    // Build colors with fallback for parts that somehow still lack a color
    const colors: Record<string, string> = {};
    parts.forEach((p, i) => {
      const color = p.color || SEGMENT_PALETTE[i % SEGMENT_PALETTE.length];
      p.meshIds.forEach(mid => { colors[mid] = color; });
    });
    return colors;
  }, [parts, viewMode]);
  const meshToPartId = useMemo(() => buildMeshToPartId(parts), [parts]);

  // AI segmentation state
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [aiResults, setAiResults] = useState<SegmentResult[]>([]);
  const [isOrganizing, setIsOrganizing] = useState(false);


  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [lastClickedMeshId, setLastClickedMeshId] = useState<string | null>(null);
  const [transform, setTransform] = useState<TransformValues | null>(null);

  // ── Exploded view state ───────────────────────────────────────────────────
  // UI state lives here (NOT in useSegmentStore) so it never enters Zundo undo
  // history, which only snapshots `parts`. Animation is driven imperatively over
  // sceneRef via requestAnimationFrame.
  // IMPORTANT: relies on the R3F Canvas using frameloop="always" (its default in
  // ThreeViewport). If that Canvas ever switches to frameloop="demand", these
  // imperative position mutations would not trigger a re-render and the animation
  // would freeze — an invalidate() call from inside the Canvas would be needed.
  const [exploded, setExploded] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState(1); // slider gain, 0..2

  // Refs read inside the rAF loop (avoid stale closures / re-renders).
  const explodedRef = useRef(false);
  const explodeAmountRef = useRef(1);
  const explodeProgressRef = useRef(0); // current eased value, 0..1
  const explodeRafRef = useRef<number | null>(null);
  const transitionStartProgressRef = useRef(0);
  const transitionTargetRef = useRef(0);
  const transitionStartTimeRef = useRef(0);
  // Per-object animation targets, resolved at explode-enable time.
  const explodeTargetsRef = useRef<
    { obj: THREE.Object3D; base: THREE.Vector3; worldRadialVec: THREE.Vector3 }[]
  >([]);

  // ── Pending segmented model (set by useJobDownload, used as URL-match fallback) ──
  const pendingSegmentedModel = usePhidiasStore((s) => s.pendingSegmentedModel);
  const setPendingSegmentedModel = usePhidiasStore((s) => s.setPendingSegmentedModel);

  const selectedPartId = selectedPartIds[selectedPartIds.length - 1] ?? null;
  const topLevelPartCount = parts.filter((p) => !p.parentId).length;

  const highlightedMeshIds = selectedPartIds.flatMap(pid => {
    const part = parts.find(p => p.id === pid);
    if (!part) return [];
    if (part.isGroup && part.childIds) {
      return part.childIds.flatMap(cid => parts.find(p => p.id === cid)?.meshIds ?? []);
    }
    return part.meshIds;
  });

  // ── Transform History Methods ─────────────────────────────────────────────

  // For capture, we need ALL transformed objects. Not just meshes, but also 
  // any custom Groups we generated in `rebuildThreeScene`!
  // Since TransformControls attaches to whatever `lastClickedMeshId` is (which 
  // could be a custom Group ID), we must capture its transform.
  const captureTransformSnapshot = useCallback((reason = 'unknown') => {
    if (!sceneRef.current) return;
    const snapshot: Record<string, TransformValues> = {};

    // Traverse the entire scene to capture everything's local transform
    sceneRef.current.traverse((obj) => {
      // Only capture objects that we might move (Meshes or our custom Groups)
      if (obj instanceof THREE.Mesh || (obj instanceof THREE.Group && (obj.name.startsWith('merged_') || obj.name.startsWith('group_')))) {
        const key = obj.name || obj.uuid;
        snapshot[key] = {
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
          scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
        };
        if (key === lastClickedMeshId) {
          console.log(`[UNDO-DEBUG] captureTransformSnapshot saving for ${key}:`, snapshot[key].position);
        }
      }
    });

    if (historyIndexRef.current < transformHistoryRef.current.length - 1) {
      transformHistoryRef.current = transformHistoryRef.current.slice(0, historyIndexRef.current + 1);
    }

    transformHistoryRef.current.push(snapshot);
    historyIndexRef.current = transformHistoryRef.current.length - 1;

    console.log(`[UNDO-DEBUG] captureTransformSnapshot (reason: ${reason}) at index ${historyIndexRef.current}`, Object.keys(snapshot).length, 'objects snapshotted.');

    setCanUndoTransform(historyIndexRef.current > 0);
    setCanRedoTransform(historyIndexRef.current < transformHistoryRef.current.length - 1);
  }, [lastClickedMeshId]);

  const applyTransformSnapshot = useCallback((idx: number) => {
    if (idx < 0 || idx >= transformHistoryRef.current.length || !sceneRef.current) return;
    const snapshot = transformHistoryRef.current[idx];

    let applyCount = 0;
    sceneRef.current.traverse((obj) => {
      const key = obj.name || obj.uuid;
      const tv = snapshot[key];
      if (tv) {
        if (key === lastClickedMeshId) {
          console.log(`[UNDO-DEBUG] applyTransformSnapshot applying to ${key}: from`,
            { x: obj.position.x, y: obj.position.y, z: obj.position.z },
            'to', tv.position
          );
        }
        obj.position.set(tv.position.x, tv.position.y, tv.position.z);
        obj.rotation.set(tv.rotation.x, tv.rotation.y, tv.rotation.z);
        obj.scale.set(tv.scale.x, tv.scale.y, tv.scale.z);

        // Force comprehensive matrix update for the renderer
        obj.updateMatrixWorld(true);
        applyCount++;

        if (key === lastClickedMeshId) {
          setTransform(tv);
          // Crucial: we must notify TransformControls to snap its gizmo 
          // back to the newly updated object matrix!
          const customEvent = new CustomEvent('force-transform-update');
          window.dispatchEvent(customEvent);
        }
      }
    });

    console.log(`[UNDO-DEBUG] applyTransformSnapshot applied index ${idx} to ${applyCount} objects.`);
  }, [lastClickedMeshId]);

  // ── Explode helpers ───────────────────────────────────────────────────────

  /** Resolve top-level parts to their scene Object3D + world centroid, then
   *  compute radial vectors and capture baseline local positions. */
  const buildExplodeTargets = useCallback(() => {
    const root = sceneRef.current;
    if (!root) {
      explodeTargetsRef.current = [];
      return;
    }
    root.updateMatrixWorld(true);

    // Index every named object. Assumes scene object names are unique; on a
    // name collision the last traversal hit wins (acceptable — segment meshIds
    // and merged_/group_ ids are unique by construction).
    const byName = new Map<string, THREE.Object3D>();
    root.traverse((o) => {
      if (o.name) byName.set(o.name, o);
    });

    const topParts = useSegmentStore.getState().parts.filter((p) => !p.parentId);
    const resolved: { key: string; obj: THREE.Object3D; centroid: THREE.Vector3 }[] = [];
    for (const part of topParts) {
      // merged_/group_ parts are THREE.Groups named === part.id; single parts are meshes.
      let obj = byName.get(part.id) ?? null;
      if (!obj) {
        const mid = part.meshIds[0];
        obj = mid ? (meshRegistryRef.current.get(mid)?.obj ?? null) : null;
      }
      if (!obj) continue;
      const centroid = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      resolved.push({ key: obj.name || obj.uuid, obj, centroid });
    }

    const radial = computeRadialVectors(resolved.map((r) => ({ key: r.key, centroid: r.centroid })));
    explodeTargetsRef.current = resolved.map((r) => ({
      obj: r.obj,
      base: r.obj.position.clone(),
      worldRadialVec: radial.get(r.key) ?? new THREE.Vector3(),
    }));
  }, []);

  /** Apply offsets for a given eased progress + slider amount. Converts the
   *  world-space radial offset into each object's parent-local frame. */
  const applyExplode = useCallback((progress: number, amount: number) => {
    for (const t of explodeTargetsRef.current) {
      const parent = t.obj.parent;
      if (!parent) continue;
      const worldOffset = explodeOffset(t.worldRadialVec, amount, progress);
      const worldBase = parent.localToWorld(t.base.clone());
      const localTarget = parent.worldToLocal(worldBase.add(worldOffset));
      t.obj.position.copy(localTarget);
      t.obj.updateMatrixWorld(true);
    }
  }, []);

  /** Snap every target back to its captured baseline (exact restore). */
  const restoreExplode = useCallback(() => {
    for (const t of explodeTargetsRef.current) {
      t.obj.position.copy(t.base);
      t.obj.updateMatrixWorld(true);
    }
  }, []);

  /** rAF frame: ease progress toward the target, then STOP once the transition
   *  completes (in either direction). While idle-exploded the loop does not keep
   *  running — live slider changes are re-applied by the explodeAmount effect. */
  const explodeTick = useCallback(() => {
    // Nothing to animate (e.g. the model changed mid-flight) — stop cleanly.
    if (explodeTargetsRef.current.length === 0) {
      explodeRafRef.current = null;
      return;
    }
    const now = performance.now();
    const u = Math.min(1, (now - transitionStartTimeRef.current) / EXPLODE_ANIM_MS);
    const eased = easeInOutCubic(u);
    const start = transitionStartProgressRef.current;
    const target = transitionTargetRef.current;
    const progress = start + (target - start) * eased;
    explodeProgressRef.current = progress;

    applyExplode(progress, explodeAmountRef.current);

    if (u >= 1) {
      // Transition finished. When converged, snap to exact baselines (no float
      // drift); when fully exploded, positions are already correct. Either way,
      // stop the loop so we don't burn frames holding a static pose.
      if (target === 0) {
        restoreExplode();
        explodeProgressRef.current = 0;
      }
      explodeRafRef.current = null;
      return;
    }
    explodeRafRef.current = requestAnimationFrame(explodeTick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyExplode, restoreExplode]);

  const undoTransform = useCallback(() => {
    if (explodedRef.current) return; // don't fight the exploded-view animation
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      applyTransformSnapshot(historyIndexRef.current);
      setCanUndoTransform(historyIndexRef.current > 0);
      setCanRedoTransform(true);
    }
  }, [applyTransformSnapshot]);

  const redoTransform = useCallback(() => {
    if (explodedRef.current) return; // don't fight the exploded-view animation
    if (historyIndexRef.current < transformHistoryRef.current.length - 1) {
      historyIndexRef.current++;
      applyTransformSnapshot(historyIndexRef.current);
      setCanUndoTransform(true);
      setCanRedoTransform(historyIndexRef.current < transformHistoryRef.current.length - 1);
    }
  }, [applyTransformSnapshot]);

  // Start an explode/converge transition whenever `exploded` flips.
  useEffect(() => {
    explodedRef.current = exploded;
    if (exploded) {
      buildExplodeTargets(); // capture baselines + radial vectors on enable
    }
    transitionStartProgressRef.current = explodeProgressRef.current;
    transitionTargetRef.current = exploded ? 1 : 0;
    transitionStartTimeRef.current = performance.now();
    if (explodeRafRef.current == null) {
      explodeRafRef.current = requestAnimationFrame(explodeTick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded]);

  // Reset explode when the model changes so a new model never starts exploded.
  useEffect(() => {
    setExploded(false);
    explodedRef.current = false;
    explodeProgressRef.current = 0;
    explodeTargetsRef.current = [];
    if (explodeRafRef.current != null) {
      cancelAnimationFrame(explodeRafRef.current);
      explodeRafRef.current = null;
    }
  }, [activeModelUrl]);

  // On unmount, cancel the loop and restore baselines so the saved scene is
  // never left in an exploded state.
  useEffect(() => {
    return () => {
      if (explodeRafRef.current != null) cancelAnimationFrame(explodeRafRef.current);
      restoreExplode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the rAF loop's amount ref current. When fully exploded and the loop is
  // idle (transition already settled), re-apply once so the magnitude slider
  // updates the spread live — without spinning up a continuous animation loop.
  // Note: the slider is only mounted while `exploded` is true, so the converging
  // case (raf running, exploded=false) is unreachable from the UI.
  useEffect(() => {
    explodeAmountRef.current = explodeAmount;
    if (explodedRef.current && explodeRafRef.current == null) {
      applyExplode(explodeProgressRef.current, explodeAmount);
    }
  }, [explodeAmount, applyExplode]);

  // ── Scene loading ──────────────────────────────────────────────────────────

  const handleSceneReady = useCallback((group: THREE.Group) => {
    sceneRef.current = group;

    // Restore Phidias metadata embedded in the GLB (written by handleSave / ExportDropdown).
    // This lets re-imported segmented/organized GLBs be recognized automatically.
    // Note: auto-colour is always applied in /segment regardless of metadata presence.
    const metaNode =
      group.getObjectByName('__PHIDIAS_METADATA__') ??
      group.getObjectByName('__phidias_meta__');
    if (metaNode && activeAssetId) {
      const ud = metaNode.userData as {
        // New field names
        segmented?: boolean;
        numParts?: number;
        organized?: boolean;
        organizedAt?: string;
        segmentedAt?: string;
        // Legacy field names (backward compat)
        phidia_segmented?: boolean;
        phidia_num_parts?: number;
        phidia_organized?: boolean;
        phidia_organized_at?: string;
        phidia_segmented_at?: string;
      };
      const isSegmented = ud.segmented ?? ud.phidia_segmented ?? false;
      if (isSegmented) {
        const numParts = ud.numParts ?? ud.phidia_num_parts;
        const isOrganized = ud.organized ?? ud.phidia_organized ?? false;
        const organizedAt = ud.organizedAt ?? ud.phidia_organized_at;
        const segmentedAt = ud.segmentedAt ?? ud.phidia_segmented_at;
        // Always allow auto-colour in /segment — do NOT set suppressAutoColorRef here.
        updateAsset(activeAssetId, {
          type: isOrganized ? 'organized' : 'segmented',
          ...(numParts !== undefined && {
            segmentation: {
              numParts,
              segmentedAt: segmentedAt ?? new Date().toISOString(),
            },
          }),
          ...(isOrganized && {
            isOrganized: true,
            organizedAt: organizedAt ?? new Date().toISOString(),
          }),
        });
      }
      // Remove from live scene so the metadata node doesn't appear in the hierarchy panel
      group.remove(metaNode);
    }

    // Build mesh registry AND initial LOCAL transforms before any user operations.
    // We store LOCAL-space transforms (obj.position/rotation/scale) because
    // TransformControls also modifies local-space coords, so undo/redo can
    // directly set them back without any coordinate conversion.
    const registry = new Map<string, { obj: THREE.Object3D; origParent: THREE.Object3D }>();
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.parent) {
        const key = child.name || child.uuid;
        registry.set(key, { obj: child, origParent: child.parent });
      }
    });
    meshRegistryRef.current = registry;

    // Reset transform history for the new scene
    transformHistoryRef.current = [];
    historyIndexRef.current = -1;
    setCanUndoTransform(false);
    setCanRedoTransform(false);

    // Capture the baseline snapshot (index 0)
    captureTransformSnapshot('handleSceneReady');
    // activeAssetId and updateAsset omitted - event handler uses latest values from closure when called
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureTransformSnapshot]);

  const handleSceneGraphChange = useCallback((nodes: HierarchyItem[]) => {
    const meshes = flattenMeshes(nodes);
    let assignColors = pendingColorRef.current;
    if (assignColors) {
      pendingColorRef.current = false;
    }

    // Auto-assign colors when a new model is loaded in /segment.
    // Triggers when: (a) store is empty, or (b) mesh IDs don't match existing parts
    // (indicating a new/different model was loaded).
    // In /segment we ALWAYS apply auto-colour regardless of whether the model was
    // previously segmented, downloaded, or re-imported — no exceptions.
    // NOTE: no meshes.length guard — even single-mesh models should be colored.
    const existing = useSegmentStore.getState().parts;
    if (!assignColors && meshes.length >= 1) {
      const existingMeshIds = new Set(existing.flatMap(p => p.meshIds));
      const newMeshIds = meshes.map(m => m.id);
      const isNewModel = existing.length === 0 || newMeshIds.some(id => !existingMeshIds.has(id));
      if (isNewModel) {
        assignColors = true;
      }
    }

    if (assignColors) {
      setViewMode('colored');
    }

    // Detect merged_*/group_* groups baked into the GLB scene graph.
    // This covers both fresh import of a previously-exported GLB and
    // tab-switch remounts where the store already has merge info.
    const {
      mergedParts: sceneMerged,
      groupParts: sceneGroups,
      claimedMeshIds: sceneClaimedMeshIds,
    } = detectMergedAndGroupNodes(nodes, SEGMENT_PALETTE, meshes.length);

    // Preserve existing part colors/names on tab-switch remounts
    const existingMap = new Map(existing.map(p => [p.id, p]));

    // Collect meshIds claimed by store-based merged parts (tab-switch case)
    const storeMerged = existing.filter(p => !p.isGroup && p.meshIds.length > 1);
    const allClaimedMeshIds = new Set([
      ...Array.from(sceneClaimedMeshIds),
      ...storeMerged.flatMap(p => p.meshIds),
    ]);

    const meshIdSet = new Set(meshes.map(m => m.id));

    // Build individual parts for unclaimed meshes
    const newParts: Part[] = meshes
      .filter(m => !allClaimedMeshIds.has(m.id))
      .map((m, i) => {
        const prev = existingMap.get(m.id);
        return {
          id: m.id,
          name: prev?.name ?? m.name,
          color: assignColors
            ? SEGMENT_PALETTE[i % SEGMENT_PALETTE.length]
            : (prev?.color ?? ''),
          visible: m.visible,
          meshIds: [m.id],
          parentId: prev?.parentId,
        };
      });

    // Insert merged parts detected from the scene graph (fresh import)
    for (const mp of sceneMerged) {
      // If the store already has this merged part, prefer store version (has user edits)
      const storeVersion = existingMap.get(mp.id);
      newParts.push(storeVersion ? { ...storeVersion } : mp);
    }

    // Insert merged parts from the store that aren't in the scene graph (tab-switch)
    for (const sp of storeMerged) {
      if (!newParts.some(p => p.id === sp.id) && sp.meshIds.every(mid => meshIdSet.has(mid))) {
        newParts.push({ ...sp });
      }
    }

    // Insert group parts detected from the scene graph (fresh import)
    for (const gp of sceneGroups) {
      if (!newParts.some(p => p.id === gp.id)) {
        // Set parentId on children
        gp.childIds?.forEach(cid => {
          const child = newParts.find(p => p.id === cid);
          if (child) child.parentId = gp.id;
        });
        // Insert before the first child
        const insertAt = newParts.findIndex(p => gp.childIds?.includes(p.id));
        if (insertAt >= 0) {
          newParts.splice(insertAt, 0, gp);
        } else {
          newParts.push(gp);
        }
      }
    }

    // Re-insert group parts from the store (tab-switch)
    for (const ep of existing) {
      if (ep.isGroup && !newParts.some(p => p.id === ep.id) &&
        ep.childIds?.some(cid => meshIdSet.has(cid) || newParts.some(p => p.id === cid))
      ) {
        const insertAt = newParts.findIndex(p => ep.childIds?.includes(p.id));
        if (insertAt >= 0) {
          newParts.splice(insertAt, 0, { ...ep });
        }
      }
    }

    const temporal = useSegmentStore.temporal.getState();
    temporal.pause();
    setParts(newParts);
    temporal.resume();
    temporal.clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scene rebuild (called after undo/redo to sync Three.js to parts[]) ────

  const rebuildThreeScene = useCallback((
    targetParts: Part[]
  ) => {
    const scene = sceneRef.current;
    const registry = meshRegistryRef.current;
    if (!scene || registry.size === 0) return;

    // Step 1: Remove all merge/group groups created by our operations
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (
        child instanceof THREE.Group &&
        (child.name.startsWith('merged_') || child.name.startsWith('group_'))
      ) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((g) => {
      const children = [...g.children];
      children.forEach((c) => scene.attach(c));
      g.parent?.remove(g);
    });

    // Step 2: Re-parent each mesh to its original parent
    registry.forEach(({ obj, origParent }) => {
      if (obj.parent !== origParent) {
        origParent.attach(obj);
      }
    });

    // Step 3: Re-create Three.js groups from the target parts
    targetParts.forEach((part) => {
      if (part.isGroup && part.childIds && part.childIds.length > 0) {
        const threeGroup = new THREE.Group();
        threeGroup.name = part.id;
        const childMeshIds = part.childIds.flatMap(
          (cid) => targetParts.find((p) => p.id === cid)?.meshIds ?? []
        );
        const meshObjs = childMeshIds
          .map((mid) => registry.get(mid)?.obj ?? findObjectInScene(scene, mid))
          .filter((o): o is THREE.Object3D => o !== null);
        scene.add(threeGroup);
        meshObjs.forEach((obj) => threeGroup.attach(obj));
      } else if (part.meshIds.length > 1) {
        const threeGroup = new THREE.Group();
        threeGroup.name = part.id;
        const meshObjs = part.meshIds
          .map((mid) => registry.get(mid)?.obj ?? findObjectInScene(scene, mid))
          .filter((o): o is THREE.Object3D => o !== null);
        scene.add(threeGroup);
        meshObjs.forEach((obj) => threeGroup.attach(obj));
      }
    });

    // Note: WE NO LONGER RESTORE TRANSFORMS HERE.
    // Three.js groups and object transforms naturally persist through 
    // node re-parenting. The custom undo/redo logic (applyTransformSnapshot)
    // handles imperative transform restoration independently of Zundo.

    // Step 4: Restore visibility from the target parts snapshot.
    // zundo restores parts[].visible in React state, but the Three.js
    // .visible flag is imperative and must be synced back explicitly
    // after every undo/redo; otherwise hide/show toggles cannot be undone.
    targetParts.forEach((part) => {
      part.meshIds.forEach((meshId) => {
        const entry = registry.get(meshId);
        if (entry?.obj) entry.obj.visible = part.visible;
      });
    });
  }, []);

  // Keep rebuildRef in sync with the latest stable version of rebuildThreeScene.
  rebuildRef.current = rebuildThreeScene;

  // ── Reactive rebuild: parts changes only (scene STRUCTURE) ────────────────
  // Because Zundo now only stores `parts`, this fires exclusively when
  // groups, merges, or re-arrangements occur. It does not recalculate transforms.
  useEffect(() => {
    if (parts.length === 0) return; // skip until model is loaded
    rebuildThreeScene(parts);
  }, [parts, rebuildThreeScene]);

  // ── Undo/Redo subscriber: rebuild parts on actual undo/redo ────────────────
  // The Zundo temporal subscriber fires on EVERY temporal state change.
  // We rebuild `parts` only when futureStates/pastStates delta indicates an undo/redo.
  useEffect(() => {
    let prevPast = useSegmentStore.temporal.getState().pastStates.length;
    let prevFuture = useSegmentStore.temporal.getState().futureStates.length;

    const unsub = useSegmentStore.temporal.subscribe(() => {
      const { pastStates, futureStates } = useSegmentStore.temporal.getState();
      const curPast = pastStates.length;
      const curFuture = futureStates.length;

      const isUndo = curPast < prevPast;
      const isRedo = curFuture < prevFuture && curPast > prevPast;

      prevPast = curPast;
      prevFuture = curFuture;

      rerender(); // keep undo/redo button disabled-state in sync

      if (!isUndo && !isRedo) return; // ignore snapshot-add and clear

      const { parts: p } = useSegmentStore.getState();
      if (p.length === 0) return;
      rebuildRef.current(p); // rebuild scene structure only
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection ──────────────────────────────────────────────────────────────

  const gizmoIdForPart = useCallback((part: Part) => {
    if (part.isGroup || part.meshIds.length > 1) return part.id;
    return part.meshIds[0] ?? part.id;
  }, []);

  const handleObjectSelect = useCallback((meshId: string | null) => {
    if (isOrganizing) {
      console.warn('[SegmentPage] Cannot select object during Smart Organize');
      return;
    }
    if (!meshId) {
      setLastClickedMeshId(null);
      setSelectedPartIds([]);
      setTransform(null);
      return;
    }
    const partId = meshToPartId[meshId] ?? meshId;
    const part = parts.find(p => p.id === partId);
    setLastClickedMeshId(part ? gizmoIdForPart(part) : meshId);
    setSelectedPartIds([partId]);
    // Auto-switch AssetsPanel to Scene tab
    window.dispatchEvent(new CustomEvent('phidias:switch-panel-tab', { detail: 'scene' }));
  }, [meshToPartId, parts, gizmoIdForPart, isOrganizing]);

  const handleObjectMultiSelect = useCallback((meshId: string) => {
    if (isOrganizing) {
      console.warn('[SegmentPage] Cannot multi-select object during Smart Organize');
      return;
    }
    const partId = meshToPartId[meshId] ?? meshId;
    const part = parts.find(p => p.id === partId);
    setLastClickedMeshId(part ? gizmoIdForPart(part) : meshId);
    setSelectedPartIds(prev =>
      prev.includes(partId) ? prev.filter(x => x !== partId) : [...prev, partId]
    );
  }, [meshToPartId, parts, gizmoIdForPart, isOrganizing]);

  const handlePanelSelect = useCallback((partId: string | null) => {
    if (isOrganizing) {
      console.warn('[SegmentPage] Cannot select part during Smart Organize');
      return;
    }
    if (!partId) {
      setLastClickedMeshId(null);
      setSelectedPartIds([]);
      setTransform(null);
      return;
    }
    const part = parts.find(p => p.id === partId);
    setLastClickedMeshId(part ? gizmoIdForPart(part) : partId);
    setSelectedPartIds([partId]);
  }, [parts, gizmoIdForPart, isOrganizing]);

  const handlePanelMultiSelect = useCallback((partId: string) => {
    if (isOrganizing) {
      console.warn('[SegmentPage] Cannot multi-select part during Smart Organize');
      return;
    }
    const part = parts.find(p => p.id === partId);
    setLastClickedMeshId(part ? gizmoIdForPart(part) : partId);
    setSelectedPartIds(prev =>
      prev.includes(partId) ? prev.filter(x => x !== partId) : [...prev, partId]
    );
  }, [parts, gizmoIdForPart, isOrganizing]);

  // ── Part operations ────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleColorChange = useCallback((id: string, color: string) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
  }, [setParts]);

  const handleVisibilityToggle = useCallback((id: string, visible: boolean) => {
    setParts((prev) => {
      const newParts = prev.map((p) => (p.id === id ? { ...p, visible } : p));
      const part = newParts.find((p) => p.id === id);
      if (sceneRef.current && part) {
        part.meshIds.forEach((mid) => {
          const obj = findObjectInScene(sceneRef.current!, mid);
          if (obj) obj.visible = visible;
        });
      }
      return newParts;
    });
  }, [setParts]);

  const handleMerge = useCallback(() => {
    const selected = parts.filter(p => selectedPartIds.includes(p.id) && !p.isGroup);
    if (selected.length < 2) return;
    const [first, ...rest] = selected;
    const allMeshIds = selected.flatMap(p => p.meshIds);
    const mergedId = `merged_${Date.now()}`;
    const mergedPart: Part = { ...first, id: mergedId, meshIds: allMeshIds };
    const removeIds = new Set(rest.map(p => p.id));
    const newParts = parts
      .map(p => p.id === first.id ? mergedPart : p)
      .filter(p => !removeIds.has(p.id));
    setParts(newParts);
    setSelectedPartIds([mergedId]);
    setLastClickedMeshId(mergedId);
    if (sceneRef.current) {
      const threeGroup = new THREE.Group();
      threeGroup.name = mergedId;
      const meshObjs = allMeshIds
        .map(mid => findObjectInScene(sceneRef.current!, mid))
        .filter((o): o is THREE.Object3D => o !== null);
      sceneRef.current.add(threeGroup);
      meshObjs.forEach(obj => threeGroup.attach(obj));
    }
  }, [parts, selectedPartIds, setParts]);

  const handleGroup = useCallback(() => {
    const selected = parts.filter(p => selectedPartIds.includes(p.id) && !p.parentId);
    if (selected.length < 2) return;
    const groupId = `group_${Date.now()}`;
    const newGroup: Part = {
      id: groupId,
      name: `Group (${selected.length})`,
      color: '#94a3b8',
      visible: true,
      meshIds: [],
      isGroup: true,
      childIds: selected.map(p => p.id),
    };
    const newParts = parts.map(p =>
      selectedPartIds.includes(p.id) ? { ...p, parentId: groupId } : p
    );
    const insertAt = newParts.findIndex(p => p.id === selected[0].id);
    newParts.splice(insertAt, 0, newGroup);
    setParts(newParts);
    setSelectedPartIds([groupId]);
    setLastClickedMeshId(groupId);
    if (sceneRef.current) {
      const threeGroup = new THREE.Group();
      threeGroup.name = groupId;
      const childMeshIds = selected.flatMap(p => p.meshIds);
      const meshObjs = childMeshIds
        .map(mid => findObjectInScene(sceneRef.current!, mid))
        .filter((o): o is THREE.Object3D => o !== null);
      sceneRef.current.add(threeGroup);
      meshObjs.forEach(obj => threeGroup.attach(obj));
    }
  }, [parts, selectedPartIds, setParts]);

  const handleTransformChange = useCallback((tv: TransformValues) => {
    // Update the Transform panel UI only.
    // Do NOT call writeTransformValues here — TransformControls already modified
    // the Three.js object directly. Calling writeTransformValues would fight
    // with TransformControls (each overwriting the other's position), causing
    // the mesh to appear frozen. The old viewer (old_viewer.jsx) never wrote
    // back during drag for the same reason.
    setTransform(tv);
  }, []); // no deps — only updates local UI state

  // Drag start: intentionally a no-op (no pause needed)
  const handleTransformDragStart = useCallback(() => {
    /* no-op — snapshot is committed on drag END only */
  }, []);

  // Drag end: capture the new transform state imperatively.
  const handleTransformDragEnd = useCallback(() => {
    if (!sceneRef.current || !lastClickedMeshId) return;
    const obj = findObjectInScene(sceneRef.current, lastClickedMeshId);
    if (!obj) return;

    // Push new overall snapshot to the imperative history stack
    captureTransformSnapshot('dragEnd');
  }, [lastClickedMeshId, captureTransformSnapshot]);

  const handlePanelRename = useCallback((id: string, name: string) => {
    // Update the parts state (for UI display)
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    // Also rename the Three.js object so export reflects the change
    if (sceneRef.current) {
      const obj = findObjectInScene(sceneRef.current, id);
      if (obj) {
        console.log('[SegmentPage] Renaming Three.js object:', obj.name, 'to', name);
        obj.name = name;
      }
    }
  }, [setParts, sceneRef]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!sceneRef.current || !activeAssetId) return;
    setIsSaving(true);
    try {
      const scene = sceneRef.current!;

      // Determine the asset type based on current state (needed for metadata injection)
      const activeAsset = assets.find(a => a.id === activeAssetId);
      let assetType: Asset['type'] = 'textured';
      if (activeAsset) {
        if (activeAsset.isOrganized) {
          assetType = 'organized';
        } else if (parts.length > 0 && viewMode === 'colored') {
          assetType = 'segmented';
        }
      }

      // Build Phidias metadata — injected into the exported GLB so the file
      // can be re-imported and recognised as segmented/organised.
      const segmentMeta: Partial<PhidiasMetadata> | undefined =
        (assetType === 'segmented' || assetType === 'organized')
          ? {
            segmented: true,
            numParts: activeAsset?.segmentation?.numParts ?? parts.filter(p => !p.isGroup).length,
            organized: assetType === 'organized',
            organizedAt: activeAsset?.organizedAt ?? null,
            segmentedAt: activeAsset?.segmentation?.segmentedAt ?? new Date().toISOString(),
          }
          : undefined;

      // exportSceneToGlb handles material swap (orig ↔ segment-colour) and metadata injection.
      const glb = await exportSceneToGlb(scene, segmentMeta);

      const blob = new Blob([glb], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);

      updateAsset(activeAssetId, {
        modelUrl: url,
        pipelineUsed: 'segment',
        type: assetType,
      });
      // Clear undo/redo history — saved state is the new baseline
      transformHistoryRef.current = [];
      historyIndexRef.current = -1;
      setCanUndoTransform(false);
      setCanRedoTransform(false);
      useSegmentStore.temporal.getState().clear();
    } catch (err) {
      console.error('[Save] GLTFExporter error:', err);
    } finally {
      setIsSaving(false);
    }
    // isSaving excluded intentionally — prevents re-entry via state is handled by button disabled state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssetId, updateAsset, assets, parts, viewMode]);

  // ── Job store for async pattern ────────────────────────────────────────────
  const addJob = usePhidiasStore((s) => s.addJob);
  const incrementConnection = usePhidiasStore((s) => s.incrementConnection);
  const isP3SAMAvailable = useConnectionAvailability('p3sam');
  const p3samConnectionCount = useConnectionCount('p3sam');
  const p3samRemainingSlots = Math.max(0, 2 - p3samConnectionCount);
  const jobs = usePhidiasStore((s) => s.jobs);
  const apiBaseUrl = usePhidiasStore((s) => s.apiBaseUrl);
  const processedP3samJobIds = usePhidiasStore((s) => s.processedP3samJobIds);
  const markP3samJobProcessed = usePhidiasStore((s) => s.markP3samJobProcessed);

  // Ref to track processed job IDs without re-renders (sync with store)
  const processedP3samJobIdsRef = useRef<Set<string>>(processedP3samJobIds);
  useEffect(() => {
    processedP3samJobIdsRef.current = processedP3samJobIds;
  }, [processedP3samJobIds]);

  // ── Auto-download completed p3sam jobs ─────────────────────────────────────
  // Downloads segmented GLB when p3sam job completes, displays in current viewport
  useEffect(() => {
    const completed = jobs.filter(
      (j) =>
        j.service === 'p3sam' &&
        j.status === 'completed' &&
        j.result &&
        !processedP3samJobIdsRef.current.has(j.jobId),
    );

    if (completed.length === 0) return;

    async function downloadCompletedJobs() {
      for (const job of completed) {
        processedP3samJobIdsRef.current.add(job.jobId);
        markP3samJobProcessed(job.jobId);

        const result = job.result as Record<string, unknown>;
        const segGlb = result.segmented_glb as string | undefined;
        if (!segGlb) {
          console.warn('[SegmentPage] No segmented GLB in completed job:', job.jobId);
          continue;
        }

        const fileName = segGlb.split('/').pop() || 'segmented.glb';
        const numParts = result.num_parts as number | undefined;
        const assetName = `Segmented (${numParts ?? '?'} parts)`;

        try {
          // Build download URL: {apiBaseUrl}/phidias/p3sam/download/{jobId}/{fileName}
          const baseUrl = apiBaseUrl ?? '';
          const downloadUrl = `${baseUrl}/phidias/p3sam/download/${job.jobId}/${fileName}`;

          const { client } = await import('@/lib/api/client');
          const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 120000 });
          const blobUrl = URL.createObjectURL(blob);

          // Use sourceAssetId if present, otherwise create new asset
          const sourceAssetId = job.metadata?.assetId as string | undefined;
          if (sourceAssetId) {
            // Update existing asset (same logic as NavActions)
            const segmentedAt = new Date().toISOString();
            updateAsset(sourceAssetId, {
              modelUrl: blobUrl,
              type: 'segmented',
              status: 'ready',
              pipelineUsed: 'segment',
              fileSize: blob.size,
              segmentation: numParts !== undefined ? { numParts, segmentedAt } : undefined,
            });
            setActiveAssetId(sourceAssetId);
          } else {
            // Create new asset
            const assetId = addAsset({
              name: assetName,
              modelUrl: blobUrl,
              type: 'segmented',
              status: 'ready',
              pipelineUsed: 'segment',
              fileSize: blob.size,
              jobId: job.jobId, // Store jobId so NavActions can find this asset later
              ...(numParts !== undefined && {
                segmentation: { numParts, segmentedAt: new Date().toISOString() },
              }),
            });
            setActiveAssetId(assetId);
          }

          console.log('[SegmentPage] Auto-downloaded segmented model:', assetName);
        } catch (err) {
          console.error('[SegmentPage] Failed to auto-download segmented model:', err);
        }
      }
    }

    downloadCompletedJobs().catch((err) => {
      console.error('[SegmentPage] Auto-download error:', err);
    });
  }, [jobs, apiBaseUrl, addAsset, setActiveAssetId, updateAsset, markP3samJobProcessed]);

  // ── AI Segmentation ────────────────────────────────────────────────────────

  const handleStartSegmentation = useCallback(async (params: P3SAMParams) => {
    // Clear any previous errors - errors are now shown in NavActions panel via job store
    setIsSegmenting(true);
    setSegmentProgress(0);
    setAiResults([]);

    // Update asset status to 'segmenting'
    if (activeAssetId) {
      updateAsset(activeAssetId, { status: 'segmenting', type: 'segmented' });
    }

    if (!isP3SAMAvailable) {
      // Show error in NavActions panel by creating a failed job entry
      addJob({
        jobId: `error-${Date.now()}`,
        service: 'p3sam',
        status: 'failed',
        type: 'segment',
        queuePosition: null,
        error: { error_code: 'QUEUE_FULL', message: 'P3-SAM service at max capacity. Please wait for existing jobs to complete.' },
        metadata: { assetId: activeAssetId },
      });
      setIsSegmenting(false);
      if (activeAssetId) {
        updateAsset(activeAssetId, { status: 'ready' });
      }
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!sceneRef.current || !activeAssetId) throw new Error('No model loaded');

      // 1. Export current scene as GLB
      const glbBuffer = await exportSceneToGlb(sceneRef.current!);

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // 2. POST to P3-SAM (async job submission) - pass abort signal
      const glbFile = new File([glbBuffer], 'model.glb', { type: 'model/gltf-binary' });
      const segResult: JobSubmitResponse = await segment3D(
        glbFile,
        {
          point_num: params.point_num,
          prompt_num: params.prompt_num,
          threshold: params.threshold,
          post_process: params.post_process,
          clean_mesh: params.clean_mesh,
          seed: params.seed,
          prompt_bs: params.prompt_bs,
        },
        controller.signal,
      );

      // 3. Add job to store for polling
      // Include asset thumbnail so NavActions can display it in the job notification
      // Use activeAssetRef for fresh data without creating reactive deps
      const sourceAsset = activeAssetRef.current;
      addJob({
        jobId: segResult.job_id,
        service: 'p3sam',
        status: segResult.status,
        type: 'segment',
        queuePosition: segResult.queue_position,
        metadata: {
          assetId: activeAssetId,
          params,
          thumbnail: sourceAsset?.thumbnail,
          assetName: sourceAsset?.name,
        },
      });

      incrementConnection('p3sam');

      // Mark as submitted - actual processing happens in background via polling
      setIsSegmenting(false);

      // Note: Results will be set when job completes via polling
      // For now, set placeholder results
      const results: SegmentResult[] = [{
        id: 'p3sam-job-' + segResult.job_id,
        name: 'Processing...',
        color: SEGMENT_PALETTE[0],
        score: 1.0,
        meshIds: [],
      }];
      setAiResults(results);
      setSelectedPartIds([]);
      setLastClickedMeshId(null);

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled - reset UI state
        setSegmentProgress(0);
        // Reset asset status back to 'ready' if it was set to 'segmenting'
        if (activeAssetId) {
          updateAsset(activeAssetId, { status: 'ready' });
        }
      } else {
        // Show error in NavActions panel by creating a failed job entry
        addJob({
          jobId: `error-${Date.now()}`,
          service: 'p3sam',
          status: 'failed',
          type: 'segment',
          queuePosition: null,
          error: {
            error_code: 'SEGMENT_FAILED',
            message: err instanceof Error ? err.message : 'Segmentation failed. Is the backend running?',
          },
          metadata: { assetId: activeAssetId },
        });
      }
      setIsSegmenting(false);
    }
    // setIsSaving and updateAsset excluded - setIsSaving is local setter that doesn't change, updateAsset from context is stable
    // activeAssetRef used for fresh thumbnail data (not reactive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssetId, addJob, incrementConnection, isP3SAMAvailable]);

  const handleCancelSegmentation = useCallback(() => {
    abortRef.current?.abort();
    setIsSegmenting(false);
    setSegmentProgress(0);
  }, []);

  // ── Smart Organize (VLM auto-name + auto-group) ─────────────────────────────

  const handleSmartOrganize = useCallback(async () => {
    if (!sceneRef.current || parts.length === 0) return;
    // Clear selection before starting - prevents moving parts during Smart Organize
    setLastClickedMeshId(null);
    setSelectedPartIds([]);
    setTransform(null);
    setIsOrganizing(true);
    // Clear any previous errors - errors are now shown in NavActions panel via job store

    try {
      // 1. Read material colours from the Three.js meshes
      const meshColors = getMeshColors(sceneRef.current);

      // 2. Capture multi-angle screenshots (original + colored)
      const { original, colored } = await captureMultiViewScreenshots(sceneRef.current, parts);

      // 3. Call VLM API with all images
      const response = await smartOrganize(
        meshColors.map(mc => ({ id: mc.id, color: mc.color })),
        original,
        colored,
        CAPTURE_ANGLES.map(([, , label]) => label),
      );
      const results: SmartOrganizeResult[] = response.parts;

      // 4. Rename parts
      let newParts = parts.map((p) => {
        const match = results.find((r) => r.id === p.id);
        return match ? { ...p, name: match.name } : p;
      });

      // 5. Build groups from VLM suggestions
      const groupMap = new Map<string, string[]>();
      for (const r of results) {
        if (!r.group) continue;
        if (!groupMap.has(r.group)) groupMap.set(r.group, []);
        groupMap.get(r.group)!.push(r.id);
      }

      for (const [groupName, memberIds] of Array.from(groupMap.entries())) {
        if (memberIds.length < 2) continue; // only group 2+ parts
        const groupId = `group_${groupName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const groupPart: Part = {
          id: groupId,
          name: groupName,
          color: '',
          visible: true,
          meshIds: [],
          isGroup: true,
          childIds: memberIds,
        };
        // Set parentId on children
        newParts = newParts.map((p) =>
          memberIds.includes(p.id) ? { ...p, parentId: groupId } : p,
        );
        // Insert group before its first child
        const firstIdx = newParts.findIndex((p) => memberIds.includes(p.id));
        newParts.splice(firstIdx, 0, groupPart);
      }

      setParts(newParts);

      // Rebuild Three.js groups to match the VLM-assigned structure.
      // IMPORTANT: we also rename every non-group mesh object to match the
      // part name so that the renamed hierarchy is preserved when the scene
      // is exported to GLB and re-imported.
      if (sceneRef.current) {
        // Step 1: rename individual mesh objects to match part names
        for (const part of newParts) {
          if (part.isGroup) continue;
          for (const meshId of part.meshIds) {
            const obj = findObjectInScene(sceneRef.current, meshId);
            if (obj) obj.name = part.name;
          }
        }

        // Step 2: build Three.js Group nodes for each logical group
        for (const part of newParts) {
          if (!part.isGroup || !part.childIds || part.childIds.length < 2) continue;
          const threeGroup = new THREE.Group();
          // Use meaningful name so it survives GLB export/import
          threeGroup.name = `group_${part.name.toLowerCase().replace(/\s+/g, '_')}`;
          const childMeshIds = part.childIds.flatMap(
            (cid) => newParts.find((p) => p.id === cid)?.meshIds ?? [],
          );
          const meshObjs = childMeshIds
            .map((mid) => findObjectInScene(sceneRef.current!, mid))
            .filter((o): o is THREE.Object3D => o !== null);
          sceneRef.current.add(threeGroup);
          meshObjs.forEach((obj) => threeGroup.attach(obj));
        }
      }

      // Update asset store metadata
      const organizedAt = new Date().toISOString();
      if (activeAssetId) {
        updateAsset(activeAssetId, {
          type: 'organized',
          isOrganized: true,
          organizedAt,
        });
      }

      // Auto-save: re-export the scene so asset.modelUrl carries the renamed
      // hierarchy and the __PHIDIAS_METADATA__ node with organized=true.
      // Without this, downloading the asset would replay the pre-organize GLB.
      if (sceneRef.current && activeAssetId) {
        try {
          const activeAsset = assets.find(a => a.id === activeAssetId);
          const glb = await exportSceneToGlb(sceneRef.current, {
            segmented: true,
            numParts: newParts.filter(p => !p.isGroup).length,
            organized: true,
            organizedAt,
            segmentedAt: activeAsset?.segmentation?.segmentedAt ?? organizedAt,
          });
          const blob = new Blob([glb], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          updateAsset(activeAssetId, { modelUrl: url });
        } catch (saveErr) {
          console.warn('[SmartOrganize] Auto-save failed:', saveErr);
        }
      }
    } catch (err) {
      // Show error in NavActions panel by creating a failed job entry
      addJob({
        jobId: `error-${Date.now()}`,
        service: 'smart-organization',
        status: 'failed',
        type: 'smart-organize',
        queuePosition: null,
        error: {
          error_code: 'SMART_ORGANIZE_FAILED',
          message: err instanceof Error ? err.message : 'Smart organize failed',
        },
        metadata: { assetId: activeAssetId },
      });
    } finally {
      setIsOrganizing(false);
    }
  }, [parts, setParts, activeAssetId, updateAsset, assets, addJob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ── Handle assets pushed from NavActions "View 3D" button ──────────────────
  const pendingAssetsForSegment = usePhidiasStore((s) => s.pendingAssetsForSegment);
  const setPendingAssetsForSegment = usePhidiasStore((s) => s.setPendingAssetsForSegment);
  const processingAssetsRef = useRef(false);
  const processedUrlsRef = useRef<Set<string>>(new Set());
  const processedJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pendingAssetsForSegment || pendingAssetsForSegment.length === 0) return;
    if (processingAssetsRef.current) return; // Prevent re-processing while already handling

    processingAssetsRef.current = true;

    (async () => {
      for (const { url, name, service, fileSize, sourceAssetId, numParts: payloadNumParts, jobId, assetId: existingAssetId } of pendingAssetsForSegment) {
        // If assetId is provided, this is a navigation from NavActions to an existing asset - just set it as active
        if (existingAssetId) {
          console.log('[SegmentWorkspace] Setting active asset from NavActions:', existingAssetId);
          const asset = assets.find(a => a.id === existingAssetId);
          if (asset) {
            setActiveAssetId(existingAssetId);
          }
          continue;
        }

        // Skip if this URL has already been processed (prevents duplicate assets in Strict Mode)
        if (processedUrlsRef.current.has(url)) {
          console.log('[SegmentWorkspace] Skipping already processed URL:', url);
          continue;
        }
        processedUrlsRef.current.add(url);

        // Check if this job has already been processed by jobId
        if (jobId && processedJobIdsRef.current.has(jobId)) {
          console.log('[SegmentWorkspace] Job already processed, skipping:', jobId);
          // Just navigate to the existing asset in workspace (set as active if found)
          if (name) {
            const existingAsset = assets.find(a => a.name === name);
            if (existingAsset) {
              setActiveAssetId(existingAsset.id);
            }
          }
          continue;
        }

        if (jobId) {
          processedJobIdsRef.current.add(jobId);
        }

        const segmentedAt = new Date().toISOString();
        let processedUrl = url;
        // Use numParts from the payload (NavActions passes job.result.num_parts) as the
        // reliable source of truth. splitSegmentedGlb may refine this count.
        let numParts: number | undefined = payloadNumParts;

        // P3-SAM returns either:
        //   (a) a single mesh with COLOR_0 vertex attributes — split into per-segment meshes
        //   (b) a multi-mesh GLB already split by the server
        // splitSegmentedGlb handles both: it re-exports the scene and counts total meshes.
        if (service === 'p3sam') {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            const { blob: splitBlob, partCount } = await splitSegmentedGlb(blob);
            if (partCount > 1) {
              processedUrl = URL.createObjectURL(splitBlob);
              numParts = partCount; // prefer mesh-derived count
              console.log(`[SegmentWorkspace] P3-SAM processed: ${partCount} parts`);
            }
            // If partCount === 1, keep original URL and use payloadNumParts
          } catch (err) {
            console.warn('[SegmentWorkspace] splitSegmentedGlb failed, using original URL:', err);
            // numParts already set to payloadNumParts — metadata will still be embedded
          }
        }

        if (sourceAssetId) {
          // Auto-colour is always applied in /segment — no suppression needed here.
          // Update the original asset in place — no new card in AssetsPanel.
          // Writing segmentation here (after actual download + split) is the ONLY place
          // that should set this field — NOT when the polling job completes.
          updateAsset(sourceAssetId, {
            modelUrl: processedUrl,
            type: 'segmented',
            status: 'ready',
            pipelineUsed: 'segment',
            fileSize,
            ...(numParts !== undefined && {
              segmentation: { numParts, segmentedAt },
            }),
          });
          setActiveAssetId(sourceAssetId);
        } else {
          // Reconviagen or unknown origin — create a new asset as before
          const pipelineUsed = service === 'reconviagen' ? 'trellis' : 'segment';
          const assetType: Asset['type'] = numParts !== undefined ? 'segmented' : 'textured';
          const assetId = addAsset({
            name,
            modelUrl: processedUrl,
            type: assetType,
            status: 'ready',
            pipelineUsed: pipelineUsed as 'trellis' | 'segment',
            fileSize,
            jobId, // Store jobId so NavActions can find this asset later
            ...(numParts !== undefined && {
              segmentation: { numParts, segmentedAt },
            }),
          });
          setActiveAssetId(assetId);
        }

        // Clean up pendingSegmentedModel if it pointed to this URL
        if (pendingSegmentedModel?.modelUrl === url) {
          setPendingSegmentedModel(null);
        }
      }

      // Clear pending assets after processing
      setPendingAssetsForSegment(null);
      processingAssetsRef.current = false;
    })();
    // Dependencies omitted - store selectors are stable, refs are stable, other deps cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAssetsForSegment]);

  // ── Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) {
        // Redo
        if (canRedoTransform) {
          redoTransform();
        } else if (useSegmentStore.temporal.getState().futureStates.length > 0) {
          useSegmentStore.temporal.getState().redo();
        }
      } else {
        // Undo
        if (canUndoTransform) {
          undoTransform();
        } else if (useSegmentStore.temporal.getState().pastStates.length > 0) {
          useSegmentStore.temporal.getState().undo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canUndoTransform, canRedoTransform, undoTransform, redoTransform]);

  // ── Navigation guard: prevent navigation during Smart Organize ─────────────
  // Block browser back/forward, tab close, and internal link clicks during smart organizing
  useEffect(() => {
    if (!isOrganizing) return;

    // 1. Block browser close/refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return 'Smart Organize is in progress. Leaving now may cause data loss. Are you sure you want to leave?';
    };

    // 2. Block browser back/forward buttons
    const handlePopState = () => {
      const confirmed = window.confirm(
        'Smart Organize is in progress. Leaving now may cause data loss. Are you sure you want to leave?'
      );
      if (!confirmed) {
        window.history.pushState(null, '', window.location.href);
      }
    };

    // 3. Block internal link clicks (Next.js App Router navigation)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Find closest anchor tag
      const anchor = target.closest('a');
      if (!anchor) return;

      // Only block internal navigation (same origin, not external)
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return; // Allow external links
      }

      const confirmed = window.confirm(
        'Smart Organize is in progress. Leaving now may cause data loss. Are you sure you want to leave?'
      );
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Set up all blockers
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick, true); // Use capture phase

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isOrganizing]);

  // ── Publish to shared panels ───────────────────────────────────────────────

  useEffect(() => {
    setSceneGraph({
      items: partsToHierarchyItems(parts),
      selectedId: selectedPartId,
      selectedIds: selectedPartIds,
      transform,
      onSelect: handlePanelSelect,
      onMultiSelect: handlePanelMultiSelect,
      onVisibilityToggle: handleVisibilityToggle,
      onTransformChange: handleTransformChange,
      onRename: handlePanelRename,
    });
  }, [
    parts, selectedPartId, selectedPartIds, transform,
    handlePanelSelect, handlePanelMultiSelect, handleVisibilityToggle, handleTransformChange,
    handlePanelRename,
    setSceneGraph,
  ]);
  useEffect(() => () => setSceneGraph(null), [setSceneGraph]);

  useEffect(() => {
    setSegmentHierarchy(partsToHierarchyItems(parts));
  }, [parts, setSegmentHierarchy]);

  // NOTE: We intentionally do NOT update asset.segmentation when the P3SAM job
  // completes (polling end). The segmentation badge, part count, and metadata
  // are only written AFTER the result GLB is actually downloaded, split into
  // individual meshes, and the asset modelUrl is updated — this happens in the
  // pendingAssetsForSegment handler below when the user clicks "View 3D".

  const modelLoaded = parts.length > 0;

  return (
    <div className="flex h-full overflow-hidden relative" style={{ background: '#1a1a2e' }}>

      {/* ── Left Panel ────────────────────────────────────────────────────── */}
      <aside
        className="w-[260px] flex-shrink-0 overflow-hidden flex flex-col border-r"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          <SegmentAIPanel
            isEnabled={modelLoaded}
            isSegmenting={isSegmenting}
            progress={segmentProgress}
            results={aiResults}
            onStart={handleStartSegmentation}
            onCancel={handleCancelSegmentation}
            onSmartOrganize={handleSmartOrganize}
            isOrganizing={isOrganizing}
            isConnectionAvailable={isP3SAMAvailable}
            remainingSlots={p3samRemainingSlots}
            isAssetSegmented={
              // Show Smart Organize ONLY when segmentation is confirmed to have
              // completed and the GLB result has been downloaded — i.e. the
              // asset has a real segmentation object in the store.  Do NOT
              // enable it just because results[] has a placeholder entry
              // (that gets set as soon as the job is submitted).
              !!(assets.find(a => a.id === activeAssetId)?.segmentation)
            }
          />
        </div>
      </aside>

      {/* ── Center Viewport ───────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden">
        <Suspense fallback={null}>
          <ThreeViewport
            modelUrl={activeModelUrl ?? ''}
            showGrid={false}
            transformMode={(isOrganizing || exploded) ? null : (lastClickedMeshId ? 'translate' : null)}
            selectedObjectId={lastClickedMeshId ?? undefined}
            selectedObjectIds={highlightedMeshIds}
            onObjectSelect={handleObjectSelect}
            onObjectMultiSelect={handleObjectMultiSelect}
            onTransformChange={useCallback((t: import('@/lib/api/types').TransformData) => {
              // Stable callback — new ref only when handleTransformChange changes.
              // An inline arrow here would cause a new ref on every render,
              // triggering MainScene's useEffect([selectedObject, onTransformChange])
              // on every re-render and creating a runaway update loop.
              handleTransformChange(transformDataToValues(t));
            }, [handleTransformChange])}
            onTransformDragStart={handleTransformDragStart}
            onTransformDragEnd={handleTransformDragEnd}
            onSceneReady={handleSceneReady}
            onSceneGraphChange={handleSceneGraphChange}
            segmentColors={segmentColors}
            isGenerating={isSegmenting}
            generatingProgress={segmentProgress}
            generatingLabel="Segmenting"
            onThumbnailReady={(dataUrl) => { if (activeAssetId) updateAssetThumbnail(activeAssetId, dataUrl); }}
            onHasSkinnedMesh={(v) => { if (activeAssetId) updateAsset(activeAssetId, { hasSkinnedMesh: v }); }}
            colorViewMode={!isSegmenting ? viewMode : undefined}
            onColorViewModeChange={handleViewModeChange}
            className="w-full h-full"
          />
        </Suspense>

        {/* Bottom Toolbar */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full z-10"
          style={{ background: 'rgba(13,13,24,0.95)', border: '1px solid #333355' }}
        >
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${(useSegmentStore.temporal.getState().pastStates.length > 0 || canUndoTransform)
              ? 'text-[#94a3b8] hover:text-white hover:bg-[#252542]'
              : 'text-[#3d3d5c] cursor-not-allowed'
              }`}
            title="Undo (CTRL+Z)"
            onClick={() => {
              // Prioritize transform undo, fallback to Zundo part undo
              if (canUndoTransform) {
                undoTransform();
              } else if (useSegmentStore.temporal.getState().pastStates.length > 0) {
                useSegmentStore.temporal.getState().undo();
              }
            }}
            disabled={useSegmentStore.temporal.getState().pastStates.length === 0 && !canUndoTransform}
          >
            ↩
          </button>
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${(useSegmentStore.temporal.getState().futureStates.length > 0 || canRedoTransform)
              ? 'text-[#94a3b8] hover:text-white hover:bg-[#252542]'
              : 'text-[#3d3d5c] cursor-not-allowed'
              }`}
            title="Redo (CTRL+SHIFT+Z)"
            onClick={() => {
              if (canRedoTransform) {
                redoTransform();
              } else if (useSegmentStore.temporal.getState().futureStates.length > 0) {
                useSegmentStore.temporal.getState().redo();
              }
            }}
            disabled={useSegmentStore.temporal.getState().futureStates.length === 0 && !canRedoTransform}
          >
            ↪
          </button>
          {/* <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors"
                        title="Paint"
                    >
                        🖌
                    </button> */}
          <div className="h-5 w-px bg-[#333355]" />
          <button
            onClick={handleMerge}
            disabled={
              selectedPartIds.filter(id => !parts.find(p => p.id === id)?.isGroup).length < 2
            }
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              selectedPartIds.filter(id => !parts.find(p => p.id === id)?.isGroup).length >= 2
                ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]'
                : 'bg-[#252542] text-[#64748b] cursor-not-allowed'
            )}
          >
            🔗 Merge{selectedPartIds.length >= 2 ? ` (${selectedPartIds.length})` : ''}
          </button>
          <button
            onClick={handleGroup}
            disabled={
              selectedPartIds.filter(id => !parts.find(p => p.id === id)?.parentId).length < 2
            }
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              selectedPartIds.filter(id => !parts.find(p => p.id === id)?.parentId).length >= 2
                ? 'bg-[#0E243E] text-white border border-[#D5B451] hover:bg-[#152d4a]'
                : 'bg-[#252542] text-[#64748b] cursor-not-allowed'
            )}
          >
            📁 Group{selectedPartIds.length >= 2 ? ` (${selectedPartIds.length})` : ''}
          </button>
          <div className="h-5 w-px bg-[#333355]" />
          <button
            data-testid="explode-toggle"
            onClick={() => setExploded((v) => !v)}
            disabled={topLevelPartCount < 2}
            title="Exploded view (dilate parts outward / converge back)"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              topLevelPartCount < 2
                ? 'bg-[#252542] text-[#64748b] cursor-not-allowed'
                : exploded
                  ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]'
                  : 'bg-[#252542] text-[#94a3b8] hover:text-white'
            )}
          >
            💥 Explode
          </button>
          {exploded && (
            <input
              data-testid="explode-amount"
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={explodeAmount}
              onChange={(e) => setExplodeAmount(parseFloat(e.target.value))}
              title={`Explosion amount: ${explodeAmount.toFixed(2)}`}
              className="w-24 accent-[#7c3aed] cursor-pointer"
            />
          )}
          {/* Quick AI trigger shortcut */}
          {/* <button
                        onClick={() => setLeftMode(m => m === 'ai' ? 'edit' : 'ai')}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                            leftMode === 'ai'
                                ? 'bg-[#D5B451] text-[#0E243E]'
                                : 'bg-[#252542] text-[#94a3b8] hover:text-[#D5B451]'
                        )}
                        title="Toggle AI Segmentation panel"
                    >
                        ⚙ AI
                    </button> */}
          <div className="h-5 w-px bg-[#333355]" />
          <button
            onClick={handleSave}
            disabled={isSaving || !activeAssetId || exploded}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
              isSaving || !activeAssetId || exploded
                ? 'bg-[#16a34a]/50 text-[#1a1a2e]/60 cursor-not-allowed'
                : 'bg-[#22c55e] text-[#1a1a2e] hover:bg-[#16a34a]'
            )}
          >
            {isSaving ? (
              <><span className="w-3 h-3 border border-[#1a1a2e] border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : 'Save'}
          </button>
          {/* <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#f5a623] hover:bg-[#252542] transition-colors">
            ★
          </button>
          <span className="text-xs text-[#f5a623] font-bold">⚡ 55</span> */}
          <ExportDropdown sceneRef={sceneRef} disabled={exploded} />
        </div>
      </main>
    </div>
  );
}
