import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { UrdfVisualGeometry } from './urdf-parser';
import type { MeshResolver } from './MeshResolver';

const geometryTemplateCache = new Map<string, Promise<THREE.Object3D>>();

function cloneCachedObject(root: THREE.Object3D): THREE.Object3D {
  const clone = root.clone(true);

  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const material = child.material;
    if (Array.isArray(material)) {
      child.material = material.map((entry) => entry.clone());
      return;
    }

    if (material) {
      child.material = material.clone();
    }
  });

  return clone;
}

function loadGeometryTemplate(
  resolvedUrl: string,
  extension: string | undefined,
): Promise<THREE.Object3D> {
  const cached = geometryTemplateCache.get(resolvedUrl);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    if (extension === 'glb' || extension === 'gltf') {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(resolvedUrl);
      return gltf.scene;
    }

    if (extension === 'obj') {
      const loader = new OBJLoader();
      return loader.loadAsync(resolvedUrl);
    }

    throw new Error(`Unsupported mesh file format for ${resolvedUrl}`);
  })();

  geometryTemplateCache.set(resolvedUrl, pending);
  void pending.catch(() => {
    if (geometryTemplateCache.get(resolvedUrl) === pending) {
      geometryTemplateCache.delete(resolvedUrl);
    }
  });

  return pending;
}

function applyLoadedMeshPresentation(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    if (!child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
}

/**
 * Build a Three.js mesh from a URDF primitive geometry spec (box, cylinder, sphere).
 * Returns null for mesh-type geometries (use loadGeometryObject instead).
 */
export function buildPrimitiveMesh(
  geometry: UrdfVisualGeometry,
): THREE.Mesh | null {
  let bufferGeometry: THREE.BufferGeometry;

  switch (geometry.type) {
    case 'box': {
      const [x, y, z] = geometry.size ?? [1, 1, 1];
      bufferGeometry = new THREE.BoxGeometry(x, y, z);
      break;
    }
    case 'cylinder': {
      const radius = geometry.radius ?? 1;
      const length = geometry.length ?? 1;
      bufferGeometry = new THREE.CylinderGeometry(radius, radius, length, 32);
      // URDF cylinders are aligned to the Z axis; Three.js uses Y.
      bufferGeometry.rotateX(Math.PI / 2);
      break;
    }
    case 'sphere': {
      const radius = geometry.radius ?? 1;
      bufferGeometry = new THREE.SphereGeometry(radius, 32, 16);
      break;
    }
    default:
      return null;
  }

  const material = new THREE.MeshStandardMaterial({ color: 0xbcbcbc });
  const mesh = new THREE.Mesh(bufferGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Load an external mesh file (GLB/GLTF or OBJ) referenced by a URDF mesh geometry.
 * URL is resolved via the supplied MeshResolver.
 * Returns a promise that resolves to a THREE.Group containing the loaded model.
 */
export async function loadGeometryObject(
  geometry: UrdfVisualGeometry,
  resolver: MeshResolver,
  urdfPath?: string,
): Promise<THREE.Group> {
  if (geometry.type !== 'mesh' || !geometry.filename) {
    throw new Error(`loadGeometryObject requires a mesh geometry with a filename`);
  }

  const filename = geometry.filename;
  const resolvedUrl = resolver.resolve(filename, urdfPath);

  const extension = filename.split('.').pop()?.toLowerCase();
  const scale = geometry.scale ?? [1, 1, 1];
  if (extension !== 'glb' && extension !== 'gltf' && extension !== 'obj') {
    throw new Error(`Unsupported mesh file format: .${extension} (${filename})`);
  }

  const template = await loadGeometryTemplate(resolvedUrl, extension);
  const group = new THREE.Group();
  group.add(cloneCachedObject(template));
  group.scale.set(scale[0], scale[1], scale[2]);
  applyLoadedMeshPresentation(group);
  return group;
}
