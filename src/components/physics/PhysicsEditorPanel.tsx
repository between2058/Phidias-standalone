'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Layers, Palette, Link2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhysicsStore } from '@/store/physics-store';
import PhysicsExportButtons from '@/components/physics/PhysicsExportButtons';
import PhysicsPartsPanel from '@/components/physics/PhysicsPartsPanel';
import PhysicsMaterialsPanel from '@/components/physics/PhysicsMaterialsPanel';
import PhysicsJointsPanel from '@/components/physics/PhysicsJointsPanel';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EditorTab = 'parts' | 'materials' | 'joints';

interface PhysicsEditorPanelProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 280;
const COLLAPSED_HEIGHT = 36;

const TABS: { key: EditorTab; label: string; icon: React.ReactNode }[] = [
  { key: 'parts', label: 'Parts', icon: <Layers size={14} /> },
  { key: 'materials', label: 'Materials', icon: <Palette size={14} /> },
  { key: 'joints', label: 'Joints', icon: <Link2 size={14} /> },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function PhysicsEditorPanel({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
}: PhysicsEditorPanelProps) {
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const displayHeight = collapsed ? COLLAPSED_HEIGHT : panelHeight;

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t overflow-hidden"
      style={{
        height: displayHeight,
        borderColor: '#333355',
        background: 'rgba(26,26,46,0.96)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* ── Resize handle ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="h-1.5 flex-shrink-0 cursor-ns-resize group flex items-center justify-center"
        >
          <div className="w-10 h-0.5 rounded-full bg-[#333355] group-hover:bg-[#7c3aed]/60 transition-colors" />
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center h-9 flex-shrink-0 border-b px-2 gap-1"
        style={{ borderColor: '#333355' }}
      >
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-6 h-6 rounded text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors mr-1"
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Tabs */}
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                onTabChange(tab.key);
                if (collapsed) onToggleCollapse();
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors',
                isActive
                  ? 'bg-[#7c3aed]/20 text-[#a78bfa]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#252542]',
              )}
            >
              <span
                className={cn(
                  'transition-colors',
                  isActive ? 'text-[#7c3aed]' : 'text-[#64748b]',
                )}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auto-play button */}
        <AutoPlayButton />

        <div className="h-4 w-px bg-[#333355] mx-1" />

        {/* Export buttons */}
        <PhysicsExportButtons />
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'parts' && <PhysicsPartsPanel />}
          {activeTab === 'materials' && <PhysicsMaterialsPanel />}
          {activeTab === 'joints' && <PhysicsJointsPanel />}
        </div>
      )}
    </div>
  );
}

// ─── Auto-play button ──────────────────────────────────────────────────────

function AutoPlayButton() {
  const isAutoPlaying = usePhysicsStore((s) => s.isAutoPlaying);
  const setAutoPlaying = usePhysicsStore((s) => s.setAutoPlaying);
  const joints = usePhysicsStore((s) => s.joints);
  const hasAnimatable = joints.some(
    (j) => j.type === 'Revolute' || j.type === 'Prismatic',
  );

  return (
    <button
      onClick={() => setAutoPlaying(!isAutoPlaying)}
      disabled={!hasAnimatable}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
        isAutoPlaying
          ? 'bg-[#f5a623]/20 text-[#f5a623]'
          : 'text-[#94a3b8] hover:text-white hover:bg-[#252542] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#94a3b8]',
      )}
      title={isAutoPlaying ? 'Stop motion preview' : 'Play all joints'}
    >
      {isAutoPlaying ? <Pause size={12} /> : <Play size={12} />}
      {isAutoPlaying ? 'Stop' : 'Play'}
    </button>
  );
}
