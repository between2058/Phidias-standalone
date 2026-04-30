'use client';

/**
 * AgentLiveContent — the inner UI for the live MCP activity feed.
 * Used inside the TopNavBar popover. State and SSE stream live in the
 * AgentLiveProvider so this component is purely presentational.
 *
 * Two visual features beyond the raw event list:
 *
 *   • Chain collapse: derivative events sharing the same source chain
 *     (raw_model → segmented → merged → scaled → grounded → usdz →
 *     physics_config) are grouped into ONE expandable card. Image
 *     events are always their own card so the user always sees the
 *     reference image. Reduces a typical 8-step pipeline from 8
 *     scrollable cards to 2 (image + chain).
 *
 *   • Download icon per row: a small ⬇ button on each card AND each
 *     history row triggers an explicit file download via a temp anchor
 *     with the `download` attribute, regardless of whether the asset
 *     is loadable in the viewport.
 */

import React, { useMemo, useState } from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useAgentLive,
  isModelEvent,
  isImageEvent,
} from './AgentLiveProvider';
import type { McpStreamEvent, McpStreamStatus } from '@/hooks/useMcpStream';

const STATUS_LABEL: Record<McpStreamStatus, { dot: string; text: string }> = {
  idle: { dot: 'bg-gray-500', text: 'idle' },
  connecting: { dot: 'bg-yellow-500 animate-pulse', text: 'connecting' },
  connected: { dot: 'bg-green-500', text: 'live' },
  error: { dot: 'bg-red-500 animate-pulse', text: 'error' },
  disconnected: { dot: 'bg-gray-500', text: 'disconnected' },
};

function downloadUrl(url: string, suggestedName?: string) {
  if (typeof window === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  if (suggestedName) a.download = suggestedName;
  // Some browsers ignore `download` on cross-origin URLs; fall back to
  // opening in a new tab so the user can save manually.
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function suggestedFileName(e: McpStreamEvent): string | undefined {
  const url = e.file_url ?? '';
  if (!url) return undefined;
  // Use the URL's last segment as suggested name; the MCP serves files
  // named like `model_<ts>_output.glb`, which is informative enough.
  try {
    const u = new URL(url);
    return u.pathname.split('/').pop() || undefined;
  } catch {
    return undefined;
  }
}

interface ChainGroup {
  rootKey: string;        // chain root asset_id (or unique fallback)
  headline: McpStreamEvent; // newest event in the chain
  history: McpStreamEvent[]; // newest → oldest, includes headline
}

// Build chain groups from the raw event stream.
// Rules:
//   • Image events are always their own group (one per image).
//   • A non-image event's chain root is its earliest non-image ancestor
//     (walking back along source_asset_id).
function groupEventsByChain(events: McpStreamEvent[]): ChainGroup[] {
  const eventsById = new Map<string, McpStreamEvent>();
  for (const e of events) {
    if (e.asset_id) eventsById.set(e.asset_id, e);
  }
  const rootOf = (e: McpStreamEvent): string => {
    if (isImageEvent(e)) return e.asset_id ?? `img-${e.timestamp}`;
    let curr: McpStreamEvent = e;
    let lastNonImage = e;
    let safety = 0;
    while (curr.source_asset_id && safety++ < 100) {
      const parent = eventsById.get(curr.source_asset_id);
      if (!parent) break;
      if (isImageEvent(parent)) break;
      lastNonImage = parent;
      curr = parent;
    }
    return lastNonImage.asset_id ?? `chain-${lastNonImage.timestamp}`;
  };

  const groupsByRoot = new Map<string, McpStreamEvent[]>();
  for (const e of events) {
    const r = rootOf(e);
    const arr = groupsByRoot.get(r) ?? [];
    arr.push(e);
    groupsByRoot.set(r, arr);
  }

  const out: ChainGroup[] = [];
  for (const [rootKey, arr] of Array.from(groupsByRoot.entries())) {
    // Sort newest → oldest by timestamp (monotonic from MCP).
    const sorted = [...arr].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0,
    );
    out.push({ rootKey, headline: sorted[0], history: sorted });
  }
  // Order groups by their headline timestamp, newest first.
  out.sort((a, b) =>
    a.headline.timestamp < b.headline.timestamp
      ? 1
      : a.headline.timestamp > b.headline.timestamp
        ? -1
        : 0,
  );
  return out;
}

function EventRow({
  event,
  loadable,
  onLoad,
  showImageThumb = false,
}: {
  event: McpStreamEvent;
  loadable: boolean;
  onLoad?: (e: McpStreamEvent) => void;
  showImageThumb?: boolean;
}) {
  const fileName = suggestedFileName(event);
  return (
    <div
      className={`p-2 rounded border bg-black/20 transition-colors ${
        loadable
          ? 'cursor-pointer border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/10'
          : 'border-purple-500/10'
      }`}
      onClick={() => loadable && onLoad?.(event)}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide gap-1">
        <span className="text-purple-300 truncate max-w-[55%]">
          {event.tool ?? event.event}
        </span>
        <span className="text-gray-500 shrink-0">{event.asset_type ?? '—'}</span>
      </div>
      <div className="text-white text-xs mt-1 truncate" title={event.name}>
        {event.name ?? event.asset_id ?? '(unnamed)'}
      </div>
      {showImageThumb && isImageEvent(event) && event.file_url && (
        <img
          src={event.file_url}
          alt=""
          className="mt-1 w-full rounded border border-purple-500/20"
          loading="lazy"
        />
      )}
      <div className="flex items-center justify-between mt-1">
        <div className="text-[10px] text-gray-500">
          {new Date(event.timestamp).toLocaleTimeString()}
        </div>
        {event.file_url && (
          <button
            className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
            title={`Download ${fileName ?? 'asset'}`}
            onClick={(ev) => {
              ev.stopPropagation();
              downloadUrl(event.file_url as string, fileName);
            }}
          >
            <Download size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function ChainCard({
  group,
  onLoad,
}: {
  group: ChainGroup;
  onLoad: (e: McpStreamEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const { headline, history } = group;
  const isImg = isImageEvent(headline);
  const stages = history.length;
  // Find the newest loadable model in the chain so a click on the
  // headline (or auto-load behavior) targets it instead of e.g. a
  // physics config that can't render in the viewport.
  const newestModel = history.find((e) => isModelEvent(e) && !!e.file_url);
  const headlineLoadable = !!newestModel;

  const fileName = suggestedFileName(headline);

  return (
    <div className="rounded border border-purple-500/20 bg-black/20">
      <div
        className={`p-2 transition-colors ${
          headlineLoadable
            ? 'cursor-pointer hover:bg-purple-500/10'
            : ''
        }`}
        onClick={() => newestModel && onLoad(newestModel)}
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide gap-1">
          <span className="text-purple-300 truncate max-w-[55%]">
            {headline.tool ?? headline.event}
          </span>
          <span className="text-gray-500 shrink-0">
            {headline.asset_type ?? '—'}
          </span>
        </div>
        <div className="text-white text-xs mt-1 truncate" title={headline.name}>
          {headline.name ?? headline.asset_id ?? '(unnamed)'}
        </div>
        {isImg && headline.file_url && (
          <img
            src={headline.file_url}
            alt=""
            className="mt-1 w-full rounded border border-purple-500/20"
            loading="lazy"
          />
        )}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span>{new Date(headline.timestamp).toLocaleTimeString()}</span>
            {stages > 1 && (
              <button
                className="flex items-center gap-0.5 text-purple-300 hover:text-purple-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((v) => !v);
                }}
                title={open ? 'Hide stages' : 'Show stages'}
              >
                {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {stages} stages
              </button>
            )}
          </div>
          {headline.file_url && (
            <button
              className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
              title={`Download ${fileName ?? 'asset'}`}
              onClick={(e) => {
                e.stopPropagation();
                downloadUrl(headline.file_url as string, fileName);
              }}
            >
              <Download size={12} />
            </button>
          )}
        </div>
      </div>
      {open && stages > 1 && (
        <div className="border-t border-purple-500/20 p-2 space-y-1.5 bg-black/20">
          {history.map((h) => (
            <EventRow
              key={`${h.asset_id}-${h.timestamp}`}
              event={h}
              loadable={isModelEvent(h) && !!h.file_url}
              onLoad={onLoad}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentLiveContent() {
  const live = useAgentLive();
  const {
    events,
    status,
    error,
    url,
    setUrl,
    token,
    setToken,
    activeUrl,
    autoLoad,
    toggleAutoLoad,
    connect,
    disconnect,
    loadModelInViewport,
  } = live;

  const groups = useMemo(() => groupEventsByChain(events), [events]);
  const statusInfo = STATUS_LABEL[status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-500/20">
        <div className="flex items-center gap-2 text-white text-sm font-medium">
          <span
            className={`inline-block h-2 w-2 rounded-full ${statusInfo.dot}`}
          />
          Agent Live
          <span className="text-xs text-gray-400">
            ({statusInfo.text} · {events.length})
          </span>
        </div>
        <button
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            autoLoad
              ? 'bg-purple-600/40 border-purple-400 text-white'
              : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
          }`}
          onClick={toggleAutoLoad}
          title="Auto-load each new 3D model into the viewport as it arrives"
        >
          Auto-load {autoLoad ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Connection form */}
      <div className="p-2 border-b border-purple-500/20 space-y-2 shrink-0">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="MCP URL e.g. http://172.18.245.177:7777"
          className="w-full px-2 py-1 rounded bg-black/30 text-white text-xs border border-purple-500/30 focus:border-purple-500 focus:outline-none"
        />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token (optional)"
          type="password"
          className="w-full px-2 py-1 rounded bg-black/30 text-white text-xs border border-purple-500/30 focus:border-purple-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={connect}
            className="flex-1 px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
          >
            {activeUrl ? 'Reconnect' : 'Connect'}
          </button>
          {activeUrl && (
            <button
              onClick={disconnect}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
            >
              Disconnect
            </button>
          )}
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        {activeUrl && (
          <div
            className="text-[10px] text-gray-500 truncate"
            title={activeUrl}
          >
            → {activeUrl}
          </div>
        )}
      </div>

      {/* Chain-grouped event list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {groups.length === 0 && (
          <div className="text-gray-500 text-xs text-center py-8">
            {status === 'connected'
              ? 'Waiting for agent activity…'
              : status === 'idle'
              ? 'Enter MCP URL above and press Connect.'
              : status === 'connecting'
              ? 'Connecting…'
              : 'Not connected.'}
          </div>
        )}
        {groups.map((g) => (
          <ChainCard
            key={g.rootKey}
            group={g}
            onLoad={loadModelInViewport}
          />
        ))}
      </div>
    </div>
  );
}
