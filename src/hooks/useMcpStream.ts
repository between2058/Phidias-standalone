'use client';

import { useEffect, useRef, useState } from 'react';

// Mirrors phidias-mcp/src/event-bus.ts SessionEvent shape.
export interface McpStreamEvent {
  event: 'asset.created' | 'step.started' | 'step.completed';
  asset_id?: string;
  asset_type?: string;
  name?: string;
  file_url?: string | null;
  file_path?: string;
  source_asset_id?: string;
  tool?: string;
  ok?: boolean;
  message?: string;
  params_summary?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface SnapshotAsset {
  asset_id: string;
  asset_type: string;
  file_path: string;
  file_url: string | null;
  source_image_path?: string;
  prompt?: string;
  created_at: string;
}

export type McpStreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface UseMcpStreamResult {
  events: McpStreamEvent[]; // append-only, oldest first
  status: McpStreamStatus;
  error: string | null;
  reconnect: () => void;
}

function trimSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

function appendQueryToken(url: string, token: string | null): string {
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

/**
 * Subscribe to a phidias-mcp HTTP-mode server's live activity. Fetches
 * the existing session snapshot once on mount, then opens an SSE stream
 * that appends events as they arrive.
 *
 * Pass null/empty `baseUrl` to disconnect; the hook becomes idle.
 *
 * Browser EventSource cannot set custom headers, so token (if any) is
 * sent as ?token=… on the SSE URL. The MCP server's authorize() helper
 * accepts both Bearer header and query token.
 */
export function useMcpStream(
  baseUrl: string | null,
  token: string | null = null,
): UseMcpStreamResult {
  const [events, setEvents] = useState<McpStreamEvent[]>([]);
  const [status, setStatus] = useState<McpStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!baseUrl) {
      setStatus('idle');
      setEvents([]);
      setError(null);
      return;
    }
    const root = trimSlashes(baseUrl);
    let cancelled = false;
    setStatus('connecting');
    setError(null);
    setEvents([]);

    // 1. snapshot — so the panel isn't empty for users who join mid-flight
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${root}/api/session/assets`, { headers })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`snapshot HTTP ${r.status} ${r.statusText}`);
        }
        return r.json();
      })
      .then((data: { assets: SnapshotAsset[] }) => {
        if (cancelled) return;
        const initial: McpStreamEvent[] = (data.assets || []).map((a) => ({
          event: 'asset.created',
          asset_id: a.asset_id,
          asset_type: a.asset_type,
          name: a.asset_id,
          file_url: a.file_url,
          file_path: a.file_path,
          tool: 'phidias.snapshot',
          metadata: a.prompt ? { prompt: a.prompt } : undefined,
          timestamp: a.created_at,
        }));
        setEvents(initial);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          `snapshot: ${e instanceof Error ? e.message : String(e)}`,
        );
      });

    // 2. SSE
    const sseUrl = appendQueryToken(`${root}/api/events/stream`, token);
    const es = new EventSource(sseUrl);
    esRef.current = es;
    es.onopen = () => {
      if (!cancelled) setStatus('connected');
    };
    es.onerror = () => {
      if (cancelled) return;
      setStatus('error');
      setError('SSE connection error (browser will auto-reconnect)');
    };
    const append = (e: MessageEvent) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(e.data) as McpStreamEvent;
        setEvents((prev) => [...prev, data]);
      } catch {
        // ignore malformed payloads
      }
    };
    es.addEventListener('asset.created', append);
    es.addEventListener('step.started', append);
    es.addEventListener('step.completed', append);

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
      setStatus('disconnected');
    };
  }, [baseUrl, token, reconnectKey]);

  return {
    events,
    status,
    error,
    reconnect: () => setReconnectKey((k) => k + 1),
  };
}
