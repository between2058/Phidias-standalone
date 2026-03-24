import type { ProgressUpdate, HierarchyItem, PhysicsMaterial } from './types';

// ── Sample assets ───────────────────────────────────────────────────────────

export const SAMPLE_GLB = '/sample.glb';
export const SAMPLE_PLY = '/sample.ply';

// ── Agent ───────────────────────────────────────────────────────────────────

export async function mockAgentCommand(
  _command: string,
  _onProgress?: (update: ProgressUpdate) => void,
): Promise<{
  text: string;
  modelUrl?: string;
  canvasNodeType?: string;
}> {
  return { text: 'Agent is not yet connected.' };
}

// ── Publish ─────────────────────────────────────────────────────────────────

export async function mockPublishToPegaverse(
  _modelUrl?: string,
): Promise<{ data: { url: string } }> {
  return { data: { url: 'https://example.com/published' } };
}

// ── Hierarchy ───────────────────────────────────────────────────────────────

export function mockGetHierarchy(
  _modelUrl?: string,
): HierarchyItem[] {
  return [];
}

// ── Retopology ──────────────────────────────────────────────────────────────

export async function mockRetopology(
  _modelUrl?: string,
  _onProgress?: (update: ProgressUpdate) => void,
): Promise<{ data: { modelUrl: string; faces: number } }> {
  return { data: { modelUrl: '', faces: 0 } };
}

// ── Texture ─────────────────────────────────────────────────────────────────

export async function mockGenerateTexture(
  _modelUrl?: string,
  _onProgress?: (update: ProgressUpdate) => void,
): Promise<{ data: { modelUrl: string } }> {
  return { data: { modelUrl: '' } };
}

// ── Scene ───────────────────────────────────────────────────────────────────

export async function mockGenerateScene(
  _options?: unknown,
  _onProgress?: (update: ProgressUpdate) => void,
): Promise<{ sceneUrl: string }> {
  return { sceneUrl: '' };
}

// ── Physics ─────────────────────────────────────────────────────────────────

export function mockGetPhysicsMaterials(): PhysicsMaterial[] {
  return [];
}
