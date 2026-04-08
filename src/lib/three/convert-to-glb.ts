/**
 * Client-side mesh format → GLB converter.
 * Loads .obj / .fbx / .stl / .usdz with the matching Three.js loader,
 * then re-exports as a GLB Blob so the rest of the app can treat
 * every uploaded model uniformly via useGLTF.
 */

import * as THREE from 'three';

// Supported extensions that need conversion (everything except .glb/.gltf/.ply)
const CONVERTIBLE_EXTS = ['.obj', '.fbx', '.stl', '.usdz'] as const;

export type ConvertibleExt = (typeof CONVERTIBLE_EXTS)[number];

export function isConvertibleFormat(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return (CONVERTIBLE_EXTS as readonly string[]).includes(ext);
}

/**
 * Convert a mesh file to a GLB Blob.
 * Throws on unsupported format or loader/exporter errors.
 */
export async function convertToGlb(file: File): Promise<Blob> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase() as ConvertibleExt;
  const url = URL.createObjectURL(file);

  try {
    const scene = await loadWithLoader(url, ext);
    return await exportAsGlb(scene);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Loader dispatch ─────────────────────────────────────────────────────────

async function loadWithLoader(url: string, ext: ConvertibleExt): Promise<THREE.Object3D> {
  switch (ext) {
    case '.obj': {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const loader = new OBJLoader();
      return await loader.loadAsync(url);
    }

    case '.fbx': {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      return await loader.loadAsync(url);
    }

    case '.stl': {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(url);
      geometry.computeVertexNormals();
      // STLLoader returns raw BufferGeometry — wrap in a Mesh
      const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
      const mesh = new THREE.Mesh(geometry, material);
      const group = new THREE.Group();
      group.add(mesh);
      return group;
    }

    case '.usdz': {
      const { USDZLoader } = await import('three/examples/jsm/loaders/USDZLoader.js');
      const loader = new USDZLoader();
      return await loader.loadAsync(url);
    }

    default:
      throw new Error(`[convertToGlb] unsupported format: ${ext}`);
  }
}

// ── GLB export ──────────────────────────────────────────────────────────────

async function exportAsGlb(object: THREE.Object3D): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      object,
      (result) => resolve(result as ArrayBuffer),
      (error) => reject(error),
      { binary: true },
    );
  });
  return new Blob([buffer], { type: 'model/gltf-binary' });
}
