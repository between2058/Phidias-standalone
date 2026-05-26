'use client';

/**
 * Phidias MCP server frontend client.
 *
 * The MCP server is a user-configured HTTP endpoint (separate from the
 * Phidias backend services). URL + token live in localStorage under the
 * same keys used by AgentLiveProvider / useMcpStream, so the SSE channel
 * and the state-push channel share one config.
 */

const LS_URL = 'phidias.mcp_stream_url';
const LS_TOKEN = 'phidias.mcp_stream_token';
// Mirror AgentLiveProvider's default so an unconfigured localStorage still
// reaches the production MCP server. Users who want a different endpoint
// set phidias.mcp_stream_url explicitly via the AgentLive panel.
const DEFAULT_URL = 'http://172.18.245.177:7777';

function readBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const ls = (window.localStorage.getItem(LS_URL) ?? '').trim();
    return (ls || DEFAULT_URL).replace(/\/+$/, '');
  } catch {
    return DEFAULT_URL;
  }
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(LS_TOKEN) ?? '';
  } catch {
    return '';
  }
}

function authHeader(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface McpUploadResult {
  asset_id: string;
  file_path: string;
  file_url: string | null;
}

export async function uploadImageToMcp(file: File): Promise<McpUploadResult> {
  const baseUrl = readBaseUrl();
  if (!baseUrl) {
    throw new Error('MCP stream URL is not configured (localStorage phidias.mcp_stream_url)');
  }
  const filename = encodeURIComponent(file.name || 'upload');
  const res = await fetch(`${baseUrl}/api/upload?filename=${filename}`, {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`MCP upload failed: HTTP ${res.status} ${msg}`);
  }
  return res.json();
}

export async function setMcpActiveImage(assetId: string | null): Promise<void> {
  const baseUrl = readBaseUrl();
  if (!baseUrl) {
    throw new Error('MCP stream URL is not configured');
  }
  const body =
    assetId === null
      ? JSON.stringify({ activeImage: null })
      : JSON.stringify({ activeImage: { assetId } });
  const res = await fetch(`${baseUrl}/api/state`, {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': 'application/json',
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`MCP setActiveImage failed: HTTP ${res.status} ${msg}`);
  }
}

export function isMcpConfigured(): boolean {
  return Boolean(readBaseUrl());
}
