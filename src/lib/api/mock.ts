import type { ProgressUpdate } from './types';

/**
 * Stub mock for AgentChatPanel — returns a placeholder response.
 */
export async function mockAgentCommand(
  _command: string,
  _onProgress?: (update: ProgressUpdate) => void,
): Promise<{ text: string; modelUrl?: string }> {
  return { text: 'Agent is not yet connected.' };
}
