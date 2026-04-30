/**
 * Three.js loader / exporter utilities.
 *
 * This is the single source of truth for all GLB / USDZ / PLY
 * loading, exporting, and downloading helpers.  Components should
 * import from here rather than duplicating logic locally.
 *
 * For React components that only need to load a model, prefer
 * useGLTF from @react-three/drei.
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import type { Asset } from '@/lib/workspace-context';
import { usePhidiasStore } from '@/store/phidias-store';

// ─── GLB / GLTF Loading ─────────────────────────────────────────────────────

/**
 * Load a GLB/GLTF file and return the parsed GLTF object.
 * For use outside of React component trees.
 */
export function loadGLTF(
  url: string,
  onProgress?: (event: ProgressEvent) => void,
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(url, resolve, onProgress, reject);
  });
}

// ─── PLY Point Cloud Loading ─────────────────────────────────────────────────

/**
 * Load a PLY file and return the parsed BufferGeometry.
 * Automatically computes vertex normals and centers the geometry.
 */
export function loadPLY(
  url: string,
  onProgress?: (event: ProgressEvent) => void,
): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();
        resolve(geometry);
      },
      onProgress,
      reject,
    );
  });
}

// ─── Phidias Metadata ────────────────────────────────────────────────────────

/**
 * The metadata shape embedded in the __PHIDIAS_METADATA__ node's userData.
 * Written by exportSceneToGlb / downloadAssetGlb and read by detectGlbMetadata.
 */
export interface PhidiasMetadata {
  segmented: boolean;
  numParts: number;
  organized: boolean;
  organizedAt: string | null;
  segmentedAt: string | null;
}

// ─── GLB Metadata Detection ──────────────────────────────────────────────────

/**
 * Parse a GLB/GLTF URL and return Phidias segmentation metadata when a
 * __PHIDIAS_METADATA__ (or legacy __phidias_meta__) node is present.
 *
 * Used to restore SEGMENTED / ORGANIZED badges when a previously-exported GLB
 * is re-imported into AssetsPanel.
 */
export async function detectGlbMetadata(url: string): Promise<Partial<Asset> | null> {
  try {
    return await new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          // Strategy 1: read from the scene-level userData (written by exportSceneToGlb
          // via scene.userData.phidiasMetadata).  This is the most reliable path because
          // GLTFExporter always serialises scene-level extras.
          const sceneUd = gltf.scene.userData?.phidiasMetadata as Partial<PhidiasMetadata> | undefined;

          // Strategy 2: fallback — look for the named Object3D node (belt-and-suspenders
          // for loaders that don't expose scene extras in userData, and for GLBs exported
          // by older Phidias builds that only used the node approach).
          const metaNode =
            gltf.scene.getObjectByName('__PHIDIAS_METADATA__') ??
            gltf.scene.getObjectByName('__phidias_meta__');
          console.log('[detectGlbMetadata] scene.userData.phidiasMetadata:', sceneUd, 'metaNode:', metaNode);

          // Merge both sources, scene-level wins
          const raw: Record<string, unknown> = {
            ...(metaNode?.userData ?? {}),
            ...(sceneUd ?? {}),
          };

          if (!raw || Object.keys(raw).length === 0) { resolve(null); return; }

          const ud = raw as {
            segmented?: boolean;
            numParts?: number;
            organized?: boolean;
            organizedAt?: string | null;
            segmentedAt?: string | null;
            // Legacy field names (backward compat)
            phidia_segmented?: boolean;
            phidia_num_parts?: number;
            phidia_organized?: boolean;
            phidia_organized_at?: string;
            phidia_segmented_at?: string;
          };
          const isSegmented = ud.segmented ?? ud.phidia_segmented ?? false;
          if (!isSegmented) { resolve(null); return; }
          const numParts = ud.numParts ?? ud.phidia_num_parts;
          const isOrganized = ud.organized ?? ud.phidia_organized ?? false;
          const organizedAt = (ud.organizedAt ?? ud.phidia_organized_at) || undefined;
          const segmentedAt = (ud.segmentedAt ?? ud.phidia_segmented_at) || undefined;
          resolve({
            type: (isOrganized ? 'organized' : 'segmented') as Asset['type'],
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
        },
        undefined,
        () => resolve(null),
      );
    });
  } catch {
    return null;
  }
}

// ─── GLB Export ──────────────────────────────────────────────────────────────

/**
 * Export a Three.js scene/group to a GLB ArrayBuffer.
 *
 * - Temporarily swaps segment-colour material overrides back to originals
 *   (stored in `child.userData.__origMaterial`) so the export always carries
 *   the original textures.
 * - Injects a hidden __PHIDIAS_METADATA__ child node when `segmentMeta` is
 *   provided, so the file can be re-imported and recognised as
 *   segmented / organised without relying on the in-memory store.
 */
/**
 * Validate and fix material properties to ensure they're compatible with GLTFExporter.
 * Some materials (especially after Smart Organize) may have corrupted color properties
 * that aren't proper THREE.Color instances.
 */
/**
 * Rebuild a THREE.Texture from a potentially cross-module texture object.
 *
 * When __origMaterial comes from R3F's bundled THREE instance, Texture objects
 * are plain-object copies: they have `image` but `source` is undefined (the Source
 * class constructor was never called on our module's side).  GLTFExporter reads
 * `texture.source.mimeType` and crashes.  Rebuilding from the raw image bypasses this.
 */
function rebuildTexture(texData: unknown): THREE.Texture | null {
  if (!texData || typeof texData !== 'object') return null;
  const t = texData as Record<string, unknown>;
  if (!t.image) return null;

  const tex = new THREE.Texture(t.image as TexImageSource);
  if (typeof t.wrapS === 'number') tex.wrapS = t.wrapS as THREE.Wrapping;
  if (typeof t.wrapT === 'number') tex.wrapT = t.wrapT as THREE.Wrapping;
  if (t.repeat && typeof t.repeat === 'object') {
    const r = t.repeat as Record<string, number>;
    tex.repeat.set(r.x ?? 1, r.y ?? 1);
  }
  if (t.offset && typeof t.offset === 'object') {
    const o = t.offset as Record<string, number>;
    tex.offset.set(o.x ?? 0, o.y ?? 0);
  }
  if (typeof t.rotation === 'number') tex.rotation = t.rotation;
  if (typeof t.flipY === 'boolean') tex.flipY = t.flipY;
  if (typeof t.colorSpace === 'string') tex.colorSpace = t.colorSpace as THREE.ColorSpace;
  if (typeof t.magFilter === 'number') tex.magFilter = t.magFilter as THREE.MagnificationTextureFilter;
  if (typeof t.minFilter === 'number') tex.minFilter = t.minFilter as THREE.MinificationTextureFilter;
  tex.needsUpdate = true;
  return tex;
}

const TEXTURE_MAP_KEYS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
  'aoMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap',
  'specularMap', 'gradientMap',
] as const;

/**
 * Create a brand-new native-module MeshStandardMaterial from a cross-module
 * material's raw property bag.
 *
 * Cross-module materials (from R3F's bundled THREE) fail GLTFExporter's
 * `isMeshStandardMaterial` check even after Object.setPrototypeOf because the
 * flag or texture Source objects may still belong to a foreign module instance.
 * The safest fix is to construct a fresh material with our own THREE so every
 * class check and Source initialisation works correctly.
 */
function cloneCrossModuleMaterial(m: Record<string, unknown>): THREE.MeshStandardMaterial {
  // ── Base color ──────────────────────────────────────────────────────────────
  let color = new THREE.Color(1, 1, 1);
  const colorVal = m.color;
  if (colorVal instanceof THREE.Color) {
    color = colorVal.clone();
  } else if (typeof colorVal === 'number') {
    color = new THREE.Color(colorVal);
  } else if (colorVal && typeof colorVal === 'object') {
    const c = colorVal as Record<string, unknown>;
    if (typeof c.r === 'number') {
      color = new THREE.Color(
        c.r as number,
        typeof c.g === 'number' ? (c.g as number) : (c.r as number),
        typeof c.b === 'number' ? (c.b as number) : (c.r as number),
      );
    }
  }

  const newMat = new THREE.MeshStandardMaterial({ color });

  // ── Emissive ─────────────────────────────────────────────────────────────────
  const emissiveVal = m.emissive;
  if (emissiveVal instanceof THREE.Color) {
    newMat.emissive = emissiveVal.clone();
  } else if (typeof emissiveVal === 'number') {
    newMat.emissive = new THREE.Color(emissiveVal);
  } else if (emissiveVal && typeof emissiveVal === 'object') {
    const e = emissiveVal as Record<string, unknown>;
    if (typeof e.r === 'number') {
      newMat.emissive = new THREE.Color(
        e.r as number,
        typeof e.g === 'number' ? (e.g as number) : 0,
        typeof e.b === 'number' ? (e.b as number) : 0,
      );
    }
  }
  if (typeof m.emissiveIntensity === 'number') newMat.emissiveIntensity = m.emissiveIntensity;

  // ── Scalar PBR properties ────────────────────────────────────────────────────
  if (typeof m.roughness === 'number') newMat.roughness = m.roughness;
  if (typeof m.metalness === 'number') newMat.metalness = m.metalness;
  if (typeof m.opacity === 'number') newMat.opacity = m.opacity;
  if (typeof m.transparent === 'boolean') newMat.transparent = m.transparent;
  if (typeof m.alphaTest === 'number') newMat.alphaTest = m.alphaTest;
  if (typeof m.side === 'number') newMat.side = m.side as THREE.Side;
  if (typeof m.depthWrite === 'boolean') newMat.depthWrite = m.depthWrite;
  if (typeof m.depthTest === 'boolean') newMat.depthTest = m.depthTest;
  if (typeof m.wireframe === 'boolean') newMat.wireframe = m.wireframe;

  // ── Texture maps ─────────────────────────────────────────────────────────────
  // Rebuild each from its raw image data so the new Texture gets a proper
  // same-module Source instance that GLTFExporter can read without crashing.
  for (const key of TEXTURE_MAP_KEYS) {
    const tex = m[key];
    if (!tex || typeof tex !== 'object') continue;
    const rebuilt = rebuildTexture(tex);
    if (rebuilt) {
      (newMat as unknown as Record<string, unknown>)[key] = rebuilt;
    }
    // If rebuild fails (no image data), leave the slot as null (the newMat default).
    // A null slot is safe; an undefined-source Texture would crash GLTFExporter.
  }

  return newMat;
}

function isValidThreeColor(value: unknown): boolean {
  // Check if value is a valid THREE.Color without throwing
  // Use try-catch to safely check if toArray exists
  if (!value) return false;
  // If it's a primitive (number, string), it's not a THREE.Color
  if (typeof value !== 'object') return false;
  try {
    return typeof (value as THREE.Color).toArray === 'function';
  } catch {
    return false;
  }
}

export function validateAndFixMaterials(scene: THREE.Group): void {
  let meshCount = 0;
  let fixCount = 0;
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    meshCount++;
    const mat = child.material;
    if (!mat) return;

    const materials = Array.isArray(mat) ? mat : [mat];
    for (const m of materials) {
      // Use duck-type check instead of instanceof to handle materials from
      // different THREE.js module instances (e.g. R3F's bundled THREE vs loaders.ts's THREE)
      if (!m || typeof m !== 'object') continue;

      // Use unknown to bypass strict type checking
      const material = m as unknown as Record<string, unknown>;

      // Fix corrupted color property - GLTFExporter expects THREE.Color
      // Handle ALL non-THREE.Color values: numbers, strings, invalid objects
      if ('color' in material && material.color !== undefined && material.color !== null) {
        const colorProp = material.color;
        let needsFix = false;

        // Check if it's NOT a valid THREE.Color
        console.log('[colorProp]', colorProp);
        if (typeof colorProp !== 'object') {
          needsFix = true; // number, string, etc.
        } else if (!isValidThreeColor(colorProp)) {
          needsFix = true; // invalid object
        }

        if (needsFix) {
          fixCount++;
          if (fixCount <= 3) {
            console.log('[validateAndFixMaterials] Fixing corrupted color:', child.name, 'original:', colorProp, typeof colorProp);
          }
          // Convert to proper THREE.Color - handle numbers, strings
          let colorValue = '#cccccc'; // default
          try {
            if (typeof colorProp === 'number') {
              // 16777215 -> 0xffffff -> #ffffff
              const hex = colorProp.toString(16).padStart(6, '0');
              colorValue = '#' + hex;
            } else if (typeof colorProp === 'string') {
              colorValue = colorProp.startsWith('#') ? colorProp : '#' + colorProp;
            } else if (colorProp && typeof colorProp === 'object') {
              // Try to get RGB values from object
              const obj = colorProp as Record<string, unknown>;
              if (typeof obj.r === 'number') {
                const r = Math.round(((obj.r as number) <= 1 ? (obj.r as number) * 255 : (obj.r as number)));
                const g = Math.round(((obj.g as number) ?? obj.r) <= 1 ? ((obj.g as number) ?? obj.r) * 255 : ((obj.g as number) ?? obj.r));
                const b = Math.round(((obj.b as number) ?? obj.r) <= 1 ? ((obj.b as number) ?? obj.r) * 255 : ((obj.b as number) ?? obj.r));
                colorValue = '#' + [r, g, b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
              } else if (typeof obj.value === 'number') {
                const hex = obj.value.toString(16).padStart(6, '0');
                colorValue = '#' + hex;
              }
            }
          } catch (e) {
            console.warn('[validateAndFixMaterials] Failed to parse color:', colorProp, e);
          }
          (material as unknown as THREE.MeshStandardMaterial).color = new THREE.Color(colorValue);
          if (fixCount <= 3) {
            console.log('[validateAndFixMaterials] Fixed to:', colorValue);
          }
        }
      }

      // Fix emissive color if present
      if ('emissive' in material && material.emissive !== undefined && material.emissive !== null) {
        const emissiveProp = material.emissive;
        if (!isValidThreeColor(emissiveProp)) {
          fixCount++;
          if (fixCount <= 3) {
            console.log('[validateAndFixMaterials] Fixing corrupted emissive:', child.name, 'original:', emissiveProp, typeof emissiveProp);
          }
          // Emissive is corrupted - set to black (no emission)
          (material as unknown as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
        }
      }
    }
  });
  if (meshCount > 0) {
    console.log('[validateAndFixMaterials] Scanned', meshCount, 'meshes, fixed', fixCount, 'materials');
  }
}

export async function exportSceneToGlb(
  scene: THREE.Group,
  segmentMeta?: Partial<PhidiasMetadata>,
): Promise<ArrayBuffer> {
  // Validate and fix any corrupted materials before export
  // This fixes the "material.color.toArray is not a function" error that occurs
  // after Smart Organize when materials have been swapped between color modes
  validateAndFixMaterials(scene);

  // Swap segment-colour material overrides → original materials
  const overrides: { mesh: THREE.Mesh; coloredMat: THREE.Material | THREE.Material[] }[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.__origMaterial) {
      overrides.push({ mesh: child, coloredMat: child.material });
      child.material = child.userData.__origMaterial;
    }
  });

  // Validate materials again after restoring originals
  validateAndFixMaterials(scene);

  // Write Phidias metadata in TWO places for maximum reliability:
  //
  // 1. scene.userData.phidiasMetadata — GLTFExporter serialises the top-level
  //    Group/Scene's userData into the GLTF scene's "extras" object, which
  //    GLTFLoader exposes back as scene.userData. This is the most reliable
  //    round-trip path and works even if the named node is pruned.
  //
  // 2. A named child Object3D (__PHIDIAS_METADATA__) with the same data in
  //    its userData — belt-and-suspenders for older builds and tools that
  //    don't expose scene-level extras.
  //
  // IMPORTANT: keep the node VISIBLE (visible=true). GLTFExporter skips
  // invisible nodes that have no geometry, causing silent data loss.
  // Temporarily detach any pre-existing __PHIDIAS_METADATA__ nodes so we don't export duplicates
  // (which causes loaders to find the old node first and ignore the new data).
  const staleNodes: { parent: THREE.Object3D; child: THREE.Object3D }[] = [];
  scene.traverse((child) => {
    if (child.name === '__PHIDIAS_METADATA__' || child.name === '__phidias_meta__') {
      if (child.parent) staleNodes.push({ parent: child.parent, child });
    }
  });
  for (const { parent, child } of staleNodes) {
    parent.remove(child);
  }

  const prevSceneUd = scene.userData.phidiasMetadata;
  let metaNode: THREE.Object3D | null = null;

  if (segmentMeta?.segmented) {
    const meta: PhidiasMetadata = {
      segmented: segmentMeta.segmented,
      numParts: segmentMeta.numParts ?? 0,
      organized: segmentMeta.organized ?? false,
      organizedAt: segmentMeta.organizedAt ?? null,
      segmentedAt: segmentMeta.segmentedAt ?? null,
    };

    // Strategy 1: scene-level extras
    scene.userData.phidiasMetadata = meta;

    // Strategy 2: named child node (visible so exporter includes it)
    metaNode = new THREE.Object3D();
    metaNode.name = '__PHIDIAS_METADATA__';
    metaNode.visible = true;  // must be true — exporter prunes invisible empty nodes
    metaNode.userData = { ...meta };
    scene.add(metaNode);
  }

  // Final safety pass: replace cross-module materials with fresh native-module instances.
  //
  // GLTFExporter uses `isMeshStandardMaterial` / `instanceof` checks to decide whether
  // to take the full PBR export path (map, roughnessMap, normalMap, etc.).  Materials
  // from R3F's bundled THREE fail these checks because they belong to a different module
  // instance.  Object.setPrototypeOf doesn't reliably fix this — the `isMeshStandard`
  // flag or texture Source objects may still be foreign.
  //
  // The safest fix is to construct a brand-new MeshStandardMaterial with our own THREE
  // for every cross-module material, copying all scalar PBR properties and rebuilding
  // every texture from its raw image data (so Source is also from our module).
  //
  // We also strip __origMaterial / __origMaterialSaved from child.userData before export
  // to prevent GLTFExporter's JSON serialisation from tripping on cross-module Euler /
  // Vector objects stored there (which cause "toArray is not a function" warnings).

  // ── Strip private userData keys that confuse GLTFExporter serialisation ──────
  const userDataBackups: Array<{ child: THREE.Object3D; backup: Record<string, unknown> }> = [];
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const keysToRemove = ['__origMaterial', '__origMaterialSaved'];
    if (keysToRemove.some(k => k in child.userData)) {
      const backup: Record<string, unknown> = {};
      for (const k of keysToRemove) {
        if (k in child.userData) {
          backup[k] = child.userData[k];
          delete child.userData[k];
        }
      }
      userDataBackups.push({ child, backup });
    }
  });

  // ── Replace cross-module materials ───────────────────────────────────────────
  let preExportCheck = 0;
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = mats.map((mat) => {
      if (!mat || typeof mat !== 'object') return mat;

      // Same-module materials: just guard against colour stored as raw number
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
        const m = mat as unknown as Record<string, unknown>;
        if (typeof m.color === 'number') (mat as THREE.MeshStandardMaterial).color = new THREE.Color(m.color as number);
        if (typeof m.emissive === 'number') (mat as THREE.MeshStandardMaterial).emissive = new THREE.Color(m.emissive as number);
        return mat;
      }

      // Cross-module material: create a fresh native instance
      preExportCheck++;
      const m = mat as Record<string, unknown>;
      console.log('[exportSceneToGlb] Replacing cross-module material:', child.name,
        String((m.type as string | undefined) ?? ''));
      return cloneCrossModuleMaterial(m);
    });

    child.material = Array.isArray(child.material) ? newMats : newMats[0];
  });

  if (preExportCheck > 0) {
    console.warn('[exportSceneToGlb] Replaced', preExportCheck, 'cross-module materials before export');
  }

  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (data) => resolve(data as ArrayBuffer),
      (error) => reject(error),
      { binary: true },
    );
  });

  // Restore scene userData and remove temporary metaNode
  if (metaNode) scene.remove(metaNode);

  // Restore private userData keys that were stripped before export
  for (const { child, backup } of userDataBackups) {
    Object.assign(child.userData, backup);
  }

  // Restore pre-existing stale metadata nodes to the live scene graph
  for (const { parent, child } of staleNodes) {
    parent.add(child);
  }

  if (prevSceneUd !== undefined) {
    scene.userData.phidiasMetadata = prevSceneUd;
  } else {
    delete scene.userData.phidiasMetadata;
  }
  for (const { mesh, coloredMat } of overrides) {
    mesh.material = coloredMat;
  }

  return result;
}

/**
 * Export the live Three.js scene and trigger a browser download as GLB.
 */
export async function downloadGlbFromScene(
  scene: THREE.Group,
  baseName: string,
  segmentMeta?: Partial<PhidiasMetadata>,
): Promise<void> {
  const buffer = await exportSceneToGlb(scene, segmentMeta);
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${baseName}.glb`);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * Trigger a browser download of a raw GLB URL (no re-encoding).
 * Fetches the URL as a blob first to ensure cross-origin downloads work
 * correctly inside Shadow DOM environments.
 */
export async function downloadGlbFromUrl(modelUrl: string, baseName: string): Promise<void> {
  const response = await fetch(modelUrl);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${baseName}.glb`);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * Download an asset as GLB.
 *
 * When the asset carries segmentation / organisation metadata, the GLB is
 * re-encoded with an injected __PHIDIAS_METADATA__ node so the round-trip
 * back into AssetsPanel can restore the badge automatically.
 *
 * When no metadata is needed the raw model URL is passed straight to the
 * browser to avoid the unnecessary re-encode.
 */
export async function downloadAssetGlb(asset: Asset): Promise<void> {
  if (!asset.modelUrl) return;
  const baseName = asset.name.replace(/\.[^/.]+$/, '');

  const needsMetadata =
    !!asset.segmentation || !!asset.isOrganized ||
    asset.type === 'segmented' || asset.type === 'organized';

  if (!needsMetadata) {
    await downloadGlbFromUrl(asset.modelUrl, baseName);
    return;
  }

  // Load the GLB, inject __PHIDIAS_METADATA__, re-export, then download
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    new GLTFLoader().load(asset.modelUrl!, resolve, undefined, reject);
  });

  // Remove any stale metadata nodes to avoid duplicates
  for (const name of ['__PHIDIAS_METADATA__', '__phidias_meta__']) {
    const stale = gltf.scene.getObjectByName(name);
    if (stale) gltf.scene.remove(stale);
  }

  const meta: PhidiasMetadata = {
    segmented: true,
    numParts: asset.segmentation?.numParts ?? 0,
    organized: !!asset.isOrganized,
    organizedAt: asset.organizedAt ?? null,
    segmentedAt: asset.segmentation?.segmentedAt ?? new Date().toISOString(),
  };

  // exportSceneToGlb handles the node injection + material swap logic
  const buffer = await exportSceneToGlb(gltf.scene as unknown as THREE.Group, meta);
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${baseName}.glb`);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * Export a Three.js scene or object as a GLB blob and trigger a browser download.
 * @deprecated Prefer downloadGlbFromScene or downloadAssetGlb.
 */
export async function exportGLB(
  object: THREE.Object3D,
  filename = 'export.glb',
): Promise<void> {
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      object,
      (data) => {
        if (data instanceof ArrayBuffer) {
          resolve(data);
        } else {
          // JSON mode fallback — convert to string blob
          const json = JSON.stringify(data, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename.replace('.glb', '.gltf'));
          URL.revokeObjectURL(url);
          reject(new Error('GLB export returned JSON — falling back to GLTF'));
        }
      },
      (error) => reject(error),
      { binary: true },
    );
  });
  const blob = new Blob([result], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

// ─── PLY Export ──────────────────────────────────────────────────────────────

/**
 * Export a Three.js BufferGeometry (or scene) as a PLY file.
 */
export function exportPLY(scene: THREE.Scene, filename = 'export.ply'): void {
  const exporter = new PLYExporter();
  // PLYExporter.parse with binary:true calls onDone with an ArrayBuffer
  exporter.parse(
    scene,
    (result: ArrayBuffer) => {
      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      URL.revokeObjectURL(url);
    },
    { binary: true },
  );
}

// ─── USDZ Export ─────────────────────────────────────────────────────────────

/**
 * Sanitize a Three.js Object3D subtree so USDZExporter doesn't choke on it.
 * - Clones the scene to avoid mutating the original
 * - Replaces interleaved / non-standard BufferAttributes with plain ones
 * - Clamps material opacity/roughness/metalness to [0,1]
 */
function sanitizeForUSDZ(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);

  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    // ── Geometry ────────────────────────────────────────────────────────────
    const geo = child.geometry as THREE.BufferGeometry;
    if (geo) {
      const attrs = geo.attributes as Record<string, THREE.BufferAttribute>;
      for (const [name, attr] of Object.entries(attrs)) {
        // Interleaved attributes need to be converted to plain ones
        const attrAny = attr as unknown as THREE.InterleavedBufferAttribute;
        if (attrAny.isInterleavedBufferAttribute) {
          const iba = attrAny;
          const { count } = iba;
          const { itemSize } = iba;
          const array = new Float32Array(count * itemSize);
          for (let i = 0; i < count; i++) {
            for (let j = 0; j < itemSize; j++) {
              array[i * itemSize + j] = iba.getComponent(i, j);
            }
          }
          geo.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
        }
        // Pad short arrays (e.g. uv2 with wrong count)
        const ba = geo.getAttribute(name) as THREE.BufferAttribute;
        const pos = geo.getAttribute('position') as THREE.BufferAttribute;
        if (ba && pos && ba.count < pos.count) {
          const padded = new Float32Array(pos.count * ba.itemSize);
          padded.set(ba.array);
          geo.setAttribute(
            name,
            new THREE.BufferAttribute(padded, ba.itemSize),
          );
        }
      }
    }

    // ── Material ────────────────────────────────────────────────────────────
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const sanitized = mats.map((m) => {
      if (!m) return m;
      const mat = m.clone() as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, Math.min(1, mat.opacity ?? 1));
      if ('roughness' in mat)
        (mat as THREE.MeshStandardMaterial).roughness = Math.max(
          0,
          Math.min(1, mat.roughness ?? 0.5),
        );
      if ('metalness' in mat)
        (mat as THREE.MeshStandardMaterial).metalness = Math.max(
          0,
          Math.min(1, mat.metalness ?? 0),
        );
      return mat;
    });
    child.material = Array.isArray(child.material) ? sanitized : sanitized[0];
  });

  return clone;
}

/**
 * Export a Three.js scene/group as USDZ for AR Quick Look / Isaac Sim.
 * Sanitizes materials and geometry before export to avoid common errors.
 */
export async function exportUSDZ(
  scene: THREE.Object3D,
  filename = 'export.usdz',
): Promise<void> {
  const sanitized = sanitizeForUSDZ(scene) as THREE.Scene;
  const exporter = new USDZExporter();
  const result = await exporter.parseAsync(sanitized);
  const blob = new Blob([result], { type: 'model/vnd.usdz+zip' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Find the appropriate container for download links.
 * In Web Component mode, returns the shadow root's portal target.
 * In Standalone mode, returns document.body.
 */
function getDownloadContainer(): HTMLElement {
  // Check mode via Zustand store (hostApp is null/undefined in standalone, set in WC)
  const hostApp = usePhidiasStore.getState().hostApp;
  const isStandalone = !hostApp || hostApp === 'standalone';

  if (!isStandalone) {
    // Web Component mode: find the portal target inside shadow root
    const phidiasWc = document.querySelector('phidias-app');
    if (phidiasWc?.shadowRoot) {
      const portalTarget = phidiasWc.shadowRoot.querySelector('[data-shadow-portal]') as HTMLElement | null;
      if (portalTarget) return portalTarget;

      // Fallback: use the shadow root's first child (the WC container)
      const shadowFirstChild = phidiasWc.shadowRoot.firstElementChild as HTMLElement | null;
      if (shadowFirstChild) return shadowFirstChild;
    }
  }

  // Standalone mode: use document.body
  return document.body;
}

/**
 * Trigger a browser download with Shadow DOM awareness.
 * In Web Component mode, the <a> element is appended inside the shadow root
 * to ensure the click event propagates correctly through the shadow boundary.
 */
export function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  const container = getDownloadContainer();
  container.appendChild(link);
  link.click();

  // Cleanup: remove the link after a short delay to ensure the download starts
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, 100);
}
