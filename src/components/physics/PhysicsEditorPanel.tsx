'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Layers, Palette, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PhysicsExportButtons from '@/components/physics/PhysicsExportButtons';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EditorTab = 'parts' | 'materials' | 'joints';

interface PhysicsEditorPanelProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  height: number;
}

// ─── Tab definitions ────────────────────────────────────────────────────────

const TABS: { key: EditorTab; label: string; icon: React.ReactNode }[] = [
  { key: 'parts', label: 'Parts', icon: <Layers size={14} /> },
  { key: 'materials', label: 'Materials', icon: <Palette size={14} /> },
  { key: 'joints', label: 'Joints', icon: <Link2 size={14} /> },
];

// ─── Placeholder panels (Tasks 9-11 will replace these) ────────────────────

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-[#64748b] text-xs">
      {label} panel — coming soon
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PhysicsEditorPanel({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  height,
}: PhysicsEditorPanelProps) {
  return (
    <div
      className="flex-shrink-0 flex flex-col border-t transition-[height] duration-200 ease-in-out overflow-hidden"
      style={{
        height,
        borderColor: '#333355',
        background: 'rgba(26,26,46,0.96)',
        backdropFilter: 'blur(12px)',
      }}
    >
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
                // Auto-expand if collapsed
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

        {/* Export buttons (stub) */}
        <PhysicsExportButtons />
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'parts' && <PlaceholderPanel label="Parts" />}
          {activeTab === 'materials' && (
            <PlaceholderPanel label="Materials" />
          )}
          {activeTab === 'joints' && <PlaceholderPanel label="Joints" />}
        </div>
      )}
    </div>
  );
}
