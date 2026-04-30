'use client';

import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { Upload, Box, ChevronDown, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace-context';
import {
  type PhidiasMetadata,
  downloadGlbFromScene,
  downloadGlbFromUrl,
  triggerDownload,
  validateAndFixMaterials,
} from '@/lib/three/loaders';

interface ExportDropdownProps {
  className?: string;
  /** When provided, export the live Three.js scene instead of the raw modelUrl. */
  sceneRef?: MutableRefObject<THREE.Group | null>;
}


/** Ensure every mesh in the scene has vertex normals (required by USDZExporter). */
function ensureNormals(scene: THREE.Object3D) {
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry as THREE.BufferGeometry;
      if (!geo.attributes.normal) {
        geo.computeVertexNormals();
      }
    }
  });
}

/** Load the GLB via GLTFLoader then convert to USDZ with USDZExporter. */
async function downloadUsdz(modelUrl: string, baseName: string) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');

  const gltf = await new Promise<{ scene: import('three').Group }>((resolve, reject) => {
    new GLTFLoader().load(modelUrl, resolve, undefined, reject);
  });

  ensureNormals(gltf.scene);

  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(gltf.scene);
  const blob = new Blob([arraybuffer], { type: 'model/vnd.usdz+zip' });

  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${baseName}.usdz`);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Export the live Three.js scene and download as USDZ.
 *  Injects a hidden __PHIDIAS_METADATA__ node when segmentMeta is provided so the
 *  file carries segmentation metadata (readable via the node's userData/extras). */
async function downloadUsdzFromScene(scene: THREE.Group, baseName: string, segmentMeta?: Partial<PhidiasMetadata>) {
  // Swap segment-color materials → original materials
  const overrides: { mesh: THREE.Mesh; coloredMat: THREE.Material | THREE.Material[] }[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.__origMaterial) {
      overrides.push({ mesh: child, coloredMat: child.material });
      child.material = child.userData.__origMaterial;
    }
  });

  // Fix any corrupted color properties after restoring original materials
  validateAndFixMaterials(scene);

  // Inject metadata node (mirrors GLB export behaviour)
  let metaNode: THREE.Object3D | null = null;
  if (segmentMeta?.segmented) {
    metaNode = new THREE.Object3D();
    metaNode.name = '__PHIDIAS_METADATA__';
    metaNode.visible = false;
    metaNode.userData = {
      segmented: segmentMeta.segmented,
      numParts: segmentMeta.numParts ?? 0,
      organized: segmentMeta.organized ?? false,
      organizedAt: segmentMeta.organizedAt ?? null,
      segmentedAt: segmentMeta.segmentedAt ?? null,
    };
    scene.add(metaNode);
  }

  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');

  ensureNormals(scene);

  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(scene);

  // Clean up metadata node from live scene
  if (metaNode) scene.remove(metaNode);

  // Restore segment-color materials
  for (const { mesh, coloredMat } of overrides) {
    mesh.material = coloredMat;
  }

  const blob = new Blob([arraybuffer], { type: 'model/vnd.usdz+zip' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${baseName}.usdz`);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ExportDropdown({ className, sceneRef }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { assets, activeAssetId } = useWorkspace();

  const activeAsset = assets.find(a => a.id === activeAssetId) ?? null;
  const disabled = !activeAsset || activeAsset.status !== 'ready' || !activeAsset.modelUrl;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      // Use composedPath() instead of e.target to handle Shadow DOM event retargeting.
      // When events cross the shadow boundary, e.target is retargeted to the shadow host,
      // causing contains() to always return false and immediately closing the dropdown.
      const path = e.composedPath();
      if (
        containerRef.current &&
        !path.includes(containerRef.current) &&
        !path.some((el) => el instanceof Node && containerRef.current!.contains(el))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const baseName = activeAsset?.name.replace(/\.[^/.]+$/, '') ?? 'model';

  async function handleExport(format: 'glb' | 'usdz') {
    if (!activeAsset?.modelUrl || working) return;
    setWorking(true);
    setOpen(false);
    try {
      const liveScene = sceneRef?.current;
      // Build segment metadata for embedding in the exported GLB so re-imports
      // can identify this asset as segmented/organised without relying on the store.
      // Include organized-only assets (Smart Organize without explicit segmentation info).
      const segmentMeta: Partial<PhidiasMetadata> | undefined =
        (activeAsset.segmentation || activeAsset.isOrganized)
          ? {
            segmented: true,
            numParts: activeAsset.segmentation?.numParts ?? 0,
            organized: !!activeAsset.isOrganized,
            organizedAt: activeAsset.organizedAt ?? null,
            segmentedAt: activeAsset.segmentation?.segmentedAt ?? null,
          }
          : undefined;
      if (format === 'glb') {
        if (liveScene) {
          await downloadGlbFromScene(liveScene, baseName, segmentMeta);
        } else {
          await downloadGlbFromUrl(activeAsset.modelUrl, baseName);
        }
      } else {
        if (liveScene) {
          await downloadUsdzFromScene(liveScene, baseName, segmentMeta);
        } else {
          await downloadUsdz(activeAsset.modelUrl, baseName);
        }
      }
    } catch (err) {
      console.error(`[ExportDropdown] ${format} export failed:`, err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Split Button */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(245,166,35,0.4)', opacity: disabled || working ? 0.5 : 1 }}
      >
        {/* Main button — GLB */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-gold)', color: '#1a1a2e' }}
          disabled={disabled || working}
          onClick={() => handleExport('glb')}
          title={disabled ? 'No active asset' : `Export "${activeAsset?.name}" as .glb`}
        >
          <Upload size={12} />
          <span>{working ? 'Exporting…' : 'Export'}</span>
        </button>

        {/* Dropdown chevron */}
        <button
          className="px-2 py-1.5 text-[#1a1a2e] transition-opacity hover:opacity-80 border-l disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-gold)', borderColor: 'rgba(0,0,0,0.2)' }}
          disabled={disabled || working}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {open && !disabled && (
        <div
          className="absolute bottom-full mb-2 right-0 w-72 rounded-xl py-1.5 z-50 shadow-2xl"
          style={{ background: '#0d0d18', border: '1px solid var(--border)' }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[11px] text-text-tertiary">Exporting</p>
            <p className="text-xs font-medium text-text-primary truncate">{activeAsset?.name}</p>
          </div>

          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
            onClick={() => handleExport('glb')}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary"><Box size={14} /></span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-text-primary mb-0.5">.glb (default)</div>
              <div className="text-[11px] text-text-tertiary leading-tight">
                Binary glTF
              </div>
            </div>
          </button>

          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
            onClick={() => handleExport('usdz')}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary"><Globe size={14} /></span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-text-primary mb-0.5">.usdz</div>
              <div className="text-[11px] text-text-tertiary leading-tight">
                Universal Scene Description (iOS AR)
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
