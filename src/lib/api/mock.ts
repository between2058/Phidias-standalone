import type { ProgressUpdate, HierarchyItem, PhysicsMaterial } from './types';

// ── Sample assets ───────────────────────────────────────────────────────────

export const SAMPLE_GLB = '/sample.glb';
export const SAMPLE_PLY = '/sample.ply';

// ── Agent ───────────────────────────────────────────────────────────────────

export async function mockAgentCommand(
  _command: string,
  _onProgress?: (update: ProgressUpdate) => void,
): Promise<{ text: string; modelUrl?: string }> {
  return { text: 'Agent is not yet connected.' };
}

// ── Publish ─────────────────────────────────────────────────────────────────

export async function mockPublishToPegaverse(
  _modelUrl: string,
): Promise<{ success: boolean }> {
  return { success: true };
}

// ── Hierarchy ───────────────────────────────────────────────────────────────

export async function mockGetHierarchy(
  _modelUrl: string,
): Promise<HierarchyItem[]> {
  return [];
}

// ── Retopology ──────────────────────────────────────────────────────────────

export async function mockRetopology(
  _modelUrl: string,
  _options?: Record<string, unknown>,
): Promise<{ modelUrl: string }> {
  return { modelUrl: '' };
}

// ── Texture ─────────────────────────────────────────────────────────────────

export async function mockGenerateTexture(
  _modelUrl: string,
  _options?: Record<string, unknown>,
): Promise<{ modelUrl: string }> {
  return { modelUrl: '' };
}

// ── Scene ───────────────────────────────────────────────────────────────────

export async function mockGenerateScene(
  _options?: Record<string, unknown>,
): Promise<{ sceneUrl: string }> {
  return { sceneUrl: '' };
}

// ── Physics ─────────────────────────────────────────────────────────────────

export async function mockGetPhysicsMaterials(): Promise<PhysicsMaterial[]> {
  return [];
}
