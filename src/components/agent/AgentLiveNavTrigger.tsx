'use client';

/**
 * AgentLiveNavTrigger — TopNavBar button that opens a popover containing
 * AgentLiveContent. The button's icon dot reflects the live SSE
 * connection status (idle / connecting / live / error) and a small
 * count badge surfaces the number of events received so the user knows
 * the agent has been busy without opening the popover.
 *
 * The actual stream + state lives in AgentLiveProvider so the connection
 * persists when the popover closes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import AgentLiveContent from './AgentLiveContent';
import { useAgentLive } from './AgentLiveProvider';

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-gray-500',
  connecting: 'bg-yellow-500 animate-pulse',
  connected: 'bg-green-500',
  error: 'bg-red-500 animate-pulse',
  disconnected: 'bg-gray-500',
};

export default function AgentLiveNavTrigger() {
  const { status, events } = useAgentLive();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside dismisses the popover.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ESC also closes the popover.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const dot = STATUS_DOT[status] ?? STATUS_DOT.idle;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        title="Agent Live — MCP activity stream"
      >
        <span className="relative inline-flex items-center justify-center">
          <Activity size={16} />
          <span
            className={`absolute -top-0.5 -right-1 inline-block h-2 w-2 rounded-full ring-2 ring-[var(--bg-darkest,#0e1421)] ${dot}`}
          />
        </span>
        <span className="text-[12px] hidden md:inline">Agent Live</span>
        {events.length > 0 && (
          <span className="text-[10px] px-1 rounded bg-purple-600/40 text-white">
            {events.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-96 max-h-[calc(100vh-6rem)] rounded-xl border border-purple-500/40 bg-[#1a1a2e]/95 backdrop-blur-md shadow-2xl z-50 flex flex-col"
          style={{ height: 'min(70vh, 640px)' }}
        >
          <AgentLiveContent />
        </div>
      )}
    </div>
  );
}
