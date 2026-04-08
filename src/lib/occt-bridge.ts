/**
 * OCCT Bridge — Isolated interface for OpenCascade STEP/IGES/BREP import.
 *
 * All OCCT/WASM logic runs in a Web Worker to avoid blocking the main thread.
 * This module is the ONLY place that depends on occt-import-js — swap it out
 * to replace the underlying CAD engine.
 */

import * as THREE from 'three';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface CADNode {
  id: string;
  name: string;
  meshIndices: number[];
  children: CADNode[];
}

export interface CADMesh {
  index: number;
  name: string;
  color: [number, number, number] | null;
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array;
  brepFaces: Array<{
    first: number;
    last: number;
    color: [number, number, number] | null;
  }>;
}

export interface CADImportResult {
  root: CADNode;
  meshes: CADMesh[];
}

export interface CADImportProgress {
  stage: string;
  percent: number;
}

// ─── Hierarchy Expansion ─────────────────────────────────────────────────────

/**
 * When a node has meshes but no children (flat STEP structure), create virtual
 * child nodes so the tree is always browsable down to individual parts.
 */
let virtualIdCounter = 0;

function expandFlatNodes(node: CADNode, meshes: CADMesh[]): CADNode {
  // Recurse into existing children first
  const expandedChildren = node.children.map(c => expandFlatNodes(c, meshes));

  // If this node directly owns multiple meshes and has no children,
  // promote each mesh into its own child node
  if (node.meshIndices.length > 1 && node.children.length === 0) {
    const virtualChildren: CADNode[] = node.meshIndices.map(idx => {
      const mesh = meshes[idx];
      return {
        id: `cad-virtual-${virtualIdCounter++}`,
        name: mesh?.name || `Part ${idx}`,
        meshIndices: [idx],
        children: [],
      };
    });
    return {
      ...node,
      meshIndices: [], // meshes now belong to children
      children: virtualChildren,
    };
  }

  return { ...node, children: expandedChildren };
}

export function expandHierarchy(result: CADImportResult): CADImportResult {
  virtualIdCounter = 0;
  return {
    ...result,
    root: expandFlatNodes(result.root, result.meshes),
  };
}

// ─── Geometry Hash for Duplicate Detection ───────────────────────────────────

export function hashMesh(mesh: CADMesh): string {
  // Use vertex count + index count + first 12 position values as fingerprint
  const vCount = mesh.positions.length;
  const iCount = mesh.indices.length;
  const sample = Array.from(mesh.positions.slice(0, 12)).map(v => v.toFixed(4)).join(',');
  return `${vCount}:${iCount}:${sample}`;
}

export interface DuplicateGroup {
  hash: string;
  meshIndices: number[];
  count: number;
  name: string;
}

export function detectDuplicates(meshes: CADMesh[]): DuplicateGroup[] {
  const hashMap = new Map<string, number[]>();
  for (const mesh of meshes) {
    const h = hashMesh(mesh);
    const group = hashMap.get(h) || [];
    group.push(mesh.index);
    hashMap.set(h, group);
  }

  return Array.from(hashMap.entries())
    .filter(([, indices]) => indices.length > 1)
    .map(([hash, indices]) => ({
      hash,
      meshIndices: indices,
      count: indices.length,
      name: meshes[indices[0]].name || `Part ${indices[0]}`,
    }));
}

// ─── Three.js Conversion ─────────────────────────────────────────────────────

const DEFAULT_COLOR = new THREE.Color(0.7, 0.7, 0.7);

function createMeshObject(mesh: CADMesh): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  if (mesh.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

  // Use per-face colors if available, otherwise mesh color
  const color = mesh.color
    ? new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
    : DEFAULT_COLOR;

  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  const obj = new THREE.Mesh(geometry, material);
  obj.name = mesh.name || `Mesh_${mesh.index}`;
  return obj;
}

function buildThreeHierarchy(
  node: CADNode,
  meshes: CADMesh[],
  duplicateHashes?: Map<string, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; count: number }>,
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = node.name || 'Assembly';

  // Add meshes belonging to this node
  for (const meshIdx of node.meshIndices) {
    const mesh = meshes[meshIdx];
    if (mesh) {
      if (duplicateHashes) {
        const h = hashMesh(mesh);
        const entry = duplicateHashes.get(h);
        if (entry && entry.count > 1) {
          // Use InstancedMesh for duplicates — share geometry
          const instancedMesh = new THREE.Mesh(entry.geometry, entry.material);
          instancedMesh.name = mesh.name || `Mesh_${mesh.index}`;
          group.add(instancedMesh);
          continue;
        }
      }
      group.add(createMeshObject(mesh));
    }
  }

  // Recurse children
  for (const child of node.children) {
    group.add(buildThreeHierarchy(child, meshes, duplicateHashes));
  }

  return group;
}

export function cadResultToThreeGroup(result: CADImportResult): THREE.Group {
  // Detect duplicates and pre-build shared geometries
  const duplicateGroups = detectDuplicates(result.meshes);
  const duplicateHashes = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; count: number }>();

  for (const group of duplicateGroups) {
    const mesh = result.meshes[group.meshIndices[0]];
    if (!mesh) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    if (mesh.normals) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

    const color = mesh.color
      ? new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
      : DEFAULT_COLOR;

    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.1,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    duplicateHashes.set(group.hash, { geometry, material, count: group.count });
  }

  const root = buildThreeHierarchy(result.root, result.meshes, duplicateHashes) as THREE.Group;

  // Auto-center and scale
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim > 0) {
    // Scale so the model fits within a ~4 unit bounding box
    const scale = 4 / maxDim;
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }

  // Log perf metrics
  let triCount = 0;
  let meshCount = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      meshCount++;
      const geo = (obj as THREE.Mesh).geometry;
      triCount += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
    }
  });
  const memMB = result.meshes.reduce((sum, m) => {
    return sum + m.positions.byteLength + (m.normals?.byteLength ?? 0) + m.indices.byteLength;
  }, 0) / (1024 * 1024);

  console.log(
    `[CAD Import] ${meshCount} parts, ${Math.round(triCount)} tris, ~${memMB.toFixed(1)} MB raw geometry`,
  );

  return root;
}

// ─── Memory Disposal ─────────────────────────────────────────────────────────

/**
 * Null out typed arrays from meshes after GLB conversion.
 * Keeps hierarchy metadata intact for the tree UI.
 */
export function disposeCADMeshBuffers(result: CADImportResult): void {
  for (const mesh of result.meshes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mesh as any).positions = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mesh as any).normals = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mesh as any).indices = null;
  }
}

// ─── GLB Export (for ThreeViewport compatibility) ────────────────────────────

/**
 * Convert a CADImportResult into a GLB blob URL that ThreeViewport can load.
 * This lets us reuse the shared viewport with all its features.
 */
export async function cadResultToGlbUrl(result: CADImportResult): Promise<string> {
  const group = cadResultToThreeGroup(result);
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (r) => resolve(r as ArrayBuffer),
      (err) => reject(err),
      { binary: true },
    );
  });
  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}

// ─── Worker-based Import ─────────────────────────────────────────────────────

let workerInstance: Worker | null = null;
let workerIdCounter = 0;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./occt-worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return workerInstance;
}

export function importStepFile(
  file: File,
  onProgress?: (p: CADImportProgress) => void,
): Promise<CADImportResult> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const taskId = ++workerIdCounter;

    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.taskId !== taskId) return;

      if (msg.type === 'progress') {
        onProgress?.({ stage: msg.stage, percent: msg.percent });
      } else if (msg.type === 'result') {
        worker.removeEventListener('message', handler);
        resolve(msg.data);
      } else if (msg.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(msg.error));
      }
    };

    worker.addEventListener('message', handler);

    file.arrayBuffer().then(buffer => {
      worker.postMessage(
        { taskId, type: 'import', buffer, fileName: file.name, fileSize: file.size },
        [buffer],
      );
    }).catch(reject);
  });
}

export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
