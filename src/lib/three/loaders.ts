/**
 * Three.js loader utilities for non-React contexts.
 * For React components, prefer useGLTF from @react-three/drei.
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

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

// ─── GLB Export ──────────────────────────────────────────────────────────────

/**
 * Export a Three.js scene or object as a GLB blob and trigger a browser download.
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

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
