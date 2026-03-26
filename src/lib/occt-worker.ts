// @ts-nocheck — Web Worker context has different type environment
/**
 * Web Worker for OCCT STEP/IGES/BREP file import.
 * Runs occt-import-js in a separate thread to keep UI responsive.
 */

// occt-import-js exposes a factory function
// @ts-expect-error — no types for occt-import-js
import occtImportJsFactory from 'occt-import-js';

interface ImportMessage {
  taskId: number;
  type: 'import';
  buffer: ArrayBuffer;
  fileName: string;
  fileSize?: number;
}

interface OcctNode {
  name: string;
  meshes: number[];
  children?: OcctNode[];
}

interface OcctMesh {
  name: string;
  color?: number[];
  brep_faces?: Array<{
    first: number;
    last: number;
    color?: number[] | null;
  }>;
  attributes: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index: { array: number[] };
}

interface OcctResult {
  success: boolean;
  root: OcctNode;
  meshes: OcctMesh[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let occtInstance: Record<string, (...args: unknown[]) => OcctResult> | null = null;

async function getOcct() {
  if (!occtInstance) {
    occtInstance = await occtImportJsFactory({
      locateFile: (name: string) => {
        // In the browser worker context, resolve WASM from public/wasm
        if (name.endsWith('.wasm')) {
          return '/wasm/occt-import-js.wasm';
        }
        return name;
      },
    });
  }
  return occtInstance;
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

// ─── Adaptive deflection based on file size ─────────────────────────────────

function getDeflectionParams(fileSize: number) {
  if (fileSize > 200 * 1024 * 1024) {
    // >200MB — coarse tessellation
    return { linearDeflection: 0.01, angularDeflection: 2.0 };
  }
  if (fileSize > 50 * 1024 * 1024) {
    // >50MB — medium tessellation
    return { linearDeflection: 0.005, angularDeflection: 1.0 };
  }
  // Default — fine tessellation
  return { linearDeflection: 0.001, angularDeflection: 0.5 };
}

let nodeIdCounter = 0;

interface ConvertedNode {
  id: string;
  name: string;
  meshIndices: number[];
  children: ConvertedNode[];
}

function convertNode(node: OcctNode): ConvertedNode {
  const id = `cad-node-${nodeIdCounter++}`;
  return {
    id,
    name: node.name || 'Unnamed',
    meshIndices: node.meshes || [],
    children: (node.children || []).map(convertNode),
  };
}

interface ConvertedMesh {
  index: number;
  name: string;
  color: [number, number, number] | null;
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array;
  brepFaces: Array<{ first: number; last: number; color: [number, number, number] | null }>;
}

function convertMesh(mesh: OcctMesh, index: number): ConvertedMesh {
  return {
    index,
    name: mesh.name || '',
    color: mesh.color ? [mesh.color[0], mesh.color[1], mesh.color[2]] : null,
    positions: new Float32Array(mesh.attributes.position.array),
    normals: mesh.attributes.normal
      ? new Float32Array(mesh.attributes.normal.array)
      : null,
    indices: new Uint32Array(mesh.index.array),
    brepFaces: (mesh.brep_faces || []).map(f => ({
      first: f.first,
      last: f.last,
      color: f.color ? [f.color[0], f.color[1], f.color[2]] : null,
    })),
  };
}

self.onmessage = async (e: MessageEvent<ImportMessage>) => {
  const { taskId, buffer, fileName, fileSize } = e.data;
  nodeIdCounter = 0;

  const actualFileSize = fileSize ?? buffer.byteLength;

  try {
    self.postMessage({ taskId, type: 'progress', stage: 'Loading OCCT engine...', percent: 10 });
    const occt = await getOcct();

    self.postMessage({ taskId, type: 'progress', stage: 'Parsing CAD file...', percent: 30 });
    const fileBuffer = new Uint8Array(buffer);

    const ext = getFileExtension(fileName);
    const deflection = getDeflectionParams(actualFileSize);
    let result: OcctResult;

    if (ext === 'stp' || ext === 'step') {
      result = occt.ReadStepFile(fileBuffer, {
        linearUnit: 'millimeter',
        linearDeflectionType: 'bounding_box_ratio',
        linearDeflection: deflection.linearDeflection,
        angularDeflection: deflection.angularDeflection,
      });
    } else if (ext === 'igs' || ext === 'iges') {
      result = occt.ReadIgesFile(fileBuffer, null);
    } else if (ext === 'brep' || ext === 'brp') {
      result = occt.ReadBrepFile(fileBuffer, null);
    } else {
      throw new Error(`Unsupported file format: .${ext}`);
    }

    if (!result.success) {
      throw new Error('OCCT failed to parse the file');
    }

    self.postMessage({ taskId, type: 'progress', stage: 'Building hierarchy...', percent: 70 });

    const root = convertNode(result.root);

    // Convert meshes with granular progress
    const totalMeshes = result.meshes.length;
    const meshes: ConvertedMesh[] = [];
    for (let i = 0; i < totalMeshes; i++) {
      meshes.push(convertMesh(result.meshes[i], i));

      // Report progress every 50 meshes
      if (i > 0 && i % 50 === 0) {
        const meshPercent = 70 + Math.round((i / totalMeshes) * 25);
        self.postMessage({
          taskId,
          type: 'progress',
          stage: `Converting meshes... (${i}/${totalMeshes})`,
          percent: meshPercent,
        });
      }
    }

    self.postMessage({ taskId, type: 'progress', stage: 'Done', percent: 100 });

    // Transfer array buffers for performance
    const transferables: ArrayBuffer[] = [];
    for (const mesh of meshes) {
      transferables.push(mesh.positions.buffer);
      if (mesh.normals) transferables.push(mesh.normals.buffer);
      transferables.push(mesh.indices.buffer);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    self.postMessage({ taskId, type: 'result', data: { root, meshes } }, transferables as unknown as Transferable[]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ taskId, type: 'error', error: message });
  }
};
