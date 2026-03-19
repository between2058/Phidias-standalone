'use client';

import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { Upload, Box, ChevronDown, Globe, FileBox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace-context';
import { convertToFbx } from '@/lib/api/phidias';

interface ExportDropdownProps {
  className?: string;
  /** When provided, export the live Three.js scene instead of the raw modelUrl. */
  sceneRef?: MutableRefObject<THREE.Group | null>;
}

// ── Export helpers ─────────────────────────────────────────────────────────────

/** Export a Three.js scene to a GLB ArrayBuffer.
 *  Temporarily restores original materials so the export always
 *  contains the original textures, not segment-color overrides. */
async function exportSceneToGlb(scene: THREE.Group): Promise<ArrayBuffer> {
  // Swap segment-color materials → original materials
  const overrides: { mesh: THREE.Mesh; coloredMat: THREE.Material | THREE.Material[] }[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.__origMaterial) {
      overrides.push({ mesh: child, coloredMat: child.material });
      child.material = child.userData.__origMaterial;
    }
  });

  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (r) => resolve(r as ArrayBuffer),
      (err) => reject(err),
      { binary: true },
    );
  });

  // Restore segment-color materials
  for (const { mesh, coloredMat } of overrides) {
    mesh.material = coloredMat;
  }

  return result;
}

/** Download the raw blob URL — already a valid GLB. */
function downloadGlb(modelUrl: string, baseName: string) {
  const a = document.createElement('a');
  a.href = modelUrl;
  a.download = `${baseName}.glb`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Export the live Three.js scene and download as GLB. */
async function downloadGlbFromScene(scene: THREE.Group, baseName: string) {
  const glb = await exportSceneToGlb(scene);
  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.glb`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Load the GLB via GLTFLoader then convert to USDZ with USDZExporter. */
async function downloadUsdz(modelUrl: string, baseName: string) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');

  const gltf = await new Promise<{ scene: import('three').Group }>((resolve, reject) => {
    new GLTFLoader().load(modelUrl, resolve, undefined, reject);
  });

  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(gltf.scene);
  const blob = new Blob([arraybuffer], { type: 'model/vnd.usdz+zip' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.usdz`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Export the live Three.js scene and download as USDZ. */
async function downloadUsdzFromScene(scene: THREE.Group, baseName: string) {
  // Swap segment-color materials → original materials
  const overrides: { mesh: THREE.Mesh; coloredMat: THREE.Material | THREE.Material[] }[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.__origMaterial) {
      overrides.push({ mesh: child, coloredMat: child.material });
      child.material = child.userData.__origMaterial;
    }
  });

  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(scene);

  // Restore segment-color materials
  for (const { mesh, coloredMat } of overrides) {
    mesh.material = coloredMat;
  }

  const blob = new Blob([arraybuffer], { type: 'model/vnd.usdz+zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.usdz`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Export the live Three.js scene as GLB, convert to FBX server-side, and download. */
async function downloadFbxFromScene(scene: THREE.Group, baseName: string) {
  const glb = await exportSceneToGlb(scene);
  const glbBlob = new Blob([glb], { type: 'model/gltf-binary' });
  const fbxBlob = await convertToFbx(glbBlob);
  const url = URL.createObjectURL(fbxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.fbx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Fetch GLB from URL, convert to FBX server-side, and download. */
async function downloadFbx(modelUrl: string, baseName: string) {
  const res = await fetch(modelUrl);
  const glbBlob = await res.blob();
  const fbxBlob = await convertToFbx(glbBlob);
  const url = URL.createObjectURL(fbxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.fbx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ExportDropdown({ className, sceneRef }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | false>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { assets, activeAssetId } = useWorkspace();

  const activeAsset = assets.find(a => a.id === activeAssetId) ?? null;
  const disabled = !activeAsset || activeAsset.status !== 'ready' || !activeAsset.modelUrl;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const baseName = activeAsset?.name.replace(/\.[^/.]+$/, '') ?? 'model';

  async function handleExport(format: 'glb' | 'usdz' | 'fbx') {
    if (!activeAsset?.modelUrl || working) return;
    setWorking(format);
    setOpen(false);
    try {
      const liveScene = sceneRef?.current;
      if (format === 'glb') {
        if (liveScene) {
          await downloadGlbFromScene(liveScene, baseName);
        } else {
          downloadGlb(activeAsset.modelUrl, baseName);
        }
      } else if (format === 'usdz') {
        if (liveScene) {
          await downloadUsdzFromScene(liveScene, baseName);
        } else {
          await downloadUsdz(activeAsset.modelUrl, baseName);
        }
      } else if (format === 'fbx') {
        if (liveScene) {
          await downloadFbxFromScene(liveScene, baseName);
        } else {
          await downloadFbx(activeAsset.modelUrl, baseName);
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
        style={{ border: '1px solid rgba(245,166,35,0.4)', opacity: disabled || !!working ? 0.5 : 1 }}
      >
        {/* Main button — GLB */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-gold)', color: '#1a1a2e' }}
          disabled={disabled || !!working}
          onClick={() => handleExport('glb')}
          title={disabled ? 'No active asset' : `Export "${activeAsset?.name}" as .glb`}
        >
          <Upload size={12} />
          <span>{working ? (working === 'fbx' ? 'Converting…' : 'Exporting…') : 'Export'}</span>
        </button>

        {/* Dropdown chevron */}
        <button
          className="px-2 py-1.5 text-[#1a1a2e] transition-opacity hover:opacity-80 border-l disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-gold)', borderColor: 'rgba(0,0,0,0.2)' }}
          disabled={disabled || !!working}
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

          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
            onClick={() => handleExport('fbx')}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary"><FileBox size={14} /></span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-text-primary mb-0.5">.fbx</div>
              <div className="text-[11px] text-text-tertiary leading-tight">
                Autodesk FBX (requires converter service)
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
