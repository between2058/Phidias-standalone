'use client';

/**
 * AgentLiveProvider — workspace-level context that owns the SSE stream
 * subscription, autoload state, and the chain-dedup workspace mapping
 * for assets created by phidias-mcp.
 *
 * Mounted once in workspace/layout.tsx so the SSE connection survives
 * popover open/close cycles. Both the TopNavBar trigger button and the
 * popover content read from this context.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMcpStream, type McpStreamEvent, type McpStreamStatus } from '@/hooks/useMcpStream';
import { useWorkspace } from '@/lib/workspace-context';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsPart, PhysicsJoint } from '@/store/physics-store';

const LS_URL = 'phidias.mcp_stream_url';
const LS_TOKEN = 'phidias.mcp_stream_token';
const LS_AUTOLOAD = 'phidias.mcp_stream_autoload';

function readLS(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeLS(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

// Loadable in the GLTF viewer? Only GLB ("model"); USDZ / USDA / physics
// configs are downloadable but the three.js viewer can't render them.
// Belt+suspenders: even when MCP labels something 'model', refuse if the
// URL extension says otherwise.
export function isModelEvent(e: McpStreamEvent): boolean {
  if (e.event !== 'asset.created' || e.asset_type !== 'model') return false;
  const url = e.file_url ?? '';
  if (!url) return true;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.glb') || lower.endsWith('.gltf');
}

export function isImageEvent(e: McpStreamEvent): boolean {
  return e.event === 'asset.created' && e.asset_type === 'image';
}

export function isPhysicsConfigEvent(e: McpStreamEvent): boolean {
  return e.event === 'asset.created' && e.asset_type === 'physics_config';
}

interface Ctx {
  // Stream
  events: McpStreamEvent[];
  status: McpStreamStatus;
  error: string | null;
  // Connection form state
  url: string;
  setUrl: (s: string) => void;
  token: string;
  setToken: (s: string) => void;
  activeUrl: string | null;
  activeToken: string | null;
  connect: () => void;
  disconnect: () => void;
  // Autoload + auto-import
  autoLoad: boolean;
  toggleAutoLoad: () => void;
  // Hydration flag (so consumers don't render persisted UI before mount)
  hydrated: boolean;
  // Manual model load action (used by clickable cards even when autoload off)
  loadModelInViewport: (e: McpStreamEvent) => void;
}

const AgentLiveContext = createContext<Ctx | null>(null);

export function useAgentLive(): Ctx {
  const ctx = useContext(AgentLiveContext);
  if (!ctx) throw new Error('useAgentLive must be inside AgentLiveProvider');
  return ctx;
}

export function AgentLiveProvider({ children }: { children: React.ReactNode }) {
  const envDefault = process.env.NEXT_PUBLIC_MCP_STREAM_URL ?? '';
  const [url, setUrl] = useState<string>(envDefault);
  const [token, setToken] = useState<string>('');
  const [activeUrl, setActiveUrl] = useState<string | null>(envDefault || null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [autoLoad, setAutoLoad] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  const { addAsset, updateAsset, setActiveAssetId } = useWorkspace();
  const setPhysicsParts = usePhysicsStore((s) => s.setParts);
  const setPhysicsJoints = usePhysicsStore((s) => s.setJoints);

  // Hydrate persisted state once on client mount.
  useEffect(() => {
    const lsUrl = readLS(LS_URL);
    const lsToken = readLS(LS_TOKEN);
    const lsAuto = readLS(LS_AUTOLOAD);
    if (lsUrl) {
      setUrl(lsUrl);
      setActiveUrl(lsUrl);
    }
    if (lsToken) {
      setToken(lsToken);
      setActiveToken(lsToken);
    }
    if (lsAuto !== '') setAutoLoad(lsAuto === '1');
    setHydrated(true);
  }, []);

  const { events, status, error } = useMcpStream(activeUrl, activeToken);

  const connect = useCallback(() => {
    writeLS(LS_URL, url);
    writeLS(LS_TOKEN, token);
    setActiveUrl(url || null);
    setActiveToken(token || null);
  }, [url, token]);

  const disconnect = useCallback(() => {
    setActiveUrl(null);
    setActiveToken(null);
  }, []);

  // Map MCP asset_id → workspace asset_id, so a chain of derivative assets
  // (raw_model → segmented → merged → scaled → grounded → …) collapses
  // into ONE entry in AssetsPanel that updates in place. New independent
  // assets (no source_asset_id chain back to a known one) get their own
  // workspace entry.
  const chainMapRef = useRef<Map<string, string>>(new Map());

  const loadModelInViewport = useCallback(
    (e: McpStreamEvent) => {
      if (!e.file_url || !e.asset_id) return;
      const ancestorWorkspaceId = e.source_asset_id
        ? chainMapRef.current.get(e.source_asset_id)
        : undefined;
      const displayName = e.name || e.asset_id;
      if (ancestorWorkspaceId) {
        updateAsset(ancestorWorkspaceId, {
          name: displayName,
          modelUrl: e.file_url,
          status: 'ready',
        });
        chainMapRef.current.set(e.asset_id, ancestorWorkspaceId);
        setActiveAssetId(ancestorWorkspaceId);
      } else {
        const id = addAsset({
          name: displayName,
          modelUrl: e.file_url,
          type: 'textured',
          pipelineUsed: 'unknown',
          status: 'ready',
        });
        chainMapRef.current.set(e.asset_id, id);
        setActiveAssetId(id);
      }
    },
    [addAsset, updateAsset, setActiveAssetId],
  );

  // Auto-load latest model
  const lastLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoLoad) return;
    const latest = [...events]
      .reverse()
      .find((e) => isModelEvent(e) && !!e.file_url);
    if (!latest || !latest.asset_id) return;
    if (lastLoadedRef.current === latest.asset_id) return;
    lastLoadedRef.current = latest.asset_id;
    loadModelInViewport(latest);
  }, [events, autoLoad, loadModelInViewport]);

  // Auto-import physics config
  const lastImportedConfigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoLoad) return;
    const latest = [...events]
      .reverse()
      .find((e) => isPhysicsConfigEvent(e) && !!e.file_url);
    if (!latest || !latest.asset_id) return;
    if (lastImportedConfigRef.current === latest.asset_id) return;
    lastImportedConfigRef.current = latest.asset_id;
    let cancelled = false;
    fetch(latest.file_url as string)
      .then((r) => {
        if (!r.ok) throw new Error(`physics JSON HTTP ${r.status}`);
        return r.json();
      })
      .then((cfg: { parts?: PhysicsPart[]; joints?: PhysicsJoint[] }) => {
        if (cancelled) return;
        if (!Array.isArray(cfg.parts) || !Array.isArray(cfg.joints)) {
          console.warn('[AgentLive] physics config missing parts/joints', cfg);
          return;
        }
        setPhysicsParts(cfg.parts);
        setPhysicsJoints(cfg.joints);
      })
      .catch((err) => {
        console.warn('[AgentLive] physics config auto-import failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [events, autoLoad, setPhysicsParts, setPhysicsJoints]);

  const toggleAutoLoad = useCallback(() => {
    setAutoLoad((v) => {
      const nv = !v;
      writeLS(LS_AUTOLOAD, nv ? '1' : '0');
      if (nv) {
        // Re-arm — pick up the latest model and physics config on next render.
        lastLoadedRef.current = null;
        lastImportedConfigRef.current = null;
      }
      return nv;
    });
  }, []);

  const value: Ctx = {
    events,
    status,
    error,
    url,
    setUrl,
    token,
    setToken,
    activeUrl,
    activeToken,
    connect,
    disconnect,
    autoLoad,
    toggleAutoLoad,
    hydrated,
    loadModelInViewport,
  };

  return (
    <AgentLiveContext.Provider value={value}>
      {children}
    </AgentLiveContext.Provider>
  );
}
