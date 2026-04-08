'use client';

import React, { useState, useMemo } from 'react';
import { X, Filter, Plus, Minus, RefreshCw, Check } from 'lucide-react';
import type { DiffResult, DiffStatus } from '@/lib/cad-diff';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CADDiffPanelProps {
    diff: DiffResult;
    onClose: () => void;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DiffStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    added:     { color: '#22c55e', bg: '#22c55e10', icon: <Plus size={10} />,      label: 'Added' },
    removed:   { color: '#ef4444', bg: '#ef444410', icon: <Minus size={10} />,     label: 'Removed' },
    modified:  { color: '#eab308', bg: '#eab30810', icon: <RefreshCw size={10} />, label: 'Modified' },
    unchanged: { color: '#6b7280', bg: '#6b728010', icon: <Check size={10} />,     label: 'Unchanged' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CADDiffPanel({ diff, onClose }: CADDiffPanelProps) {
    const [showChangesOnly, setShowChangesOnly] = useState(false);

    const filteredEntries = useMemo(() => {
        if (!showChangesOnly) return diff.entries;
        return diff.entries.filter(e => e.status !== 'unchanged');
    }, [diff.entries, showChangesOnly]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#333355]">
                <span className="text-[11px] font-medium text-white">STP Diff</span>
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-[#ffffff10] text-[#64748b]"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#333355] text-[10px]">
                <span className="text-[#22c55e] font-mono">+{diff.added}</span>
                <span className="text-[#ef4444] font-mono">-{diff.removed}</span>
                <span className="text-[#eab308] font-mono">~{diff.modified}</span>
                <span className="text-[#6b7280] font-mono">={diff.unchanged}</span>

                <div className="flex-1" />

                {/* Filter toggle */}
                <button
                    onClick={() => setShowChangesOnly(v => !v)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] transition-colors ${
                        showChangesOnly
                            ? 'bg-[#D5B451]/20 text-[#D5B451]'
                            : 'text-[#64748b] hover:text-[#94a3b8]'
                    }`}
                >
                    <Filter size={9} />
                    Changes only
                </button>
            </div>

            {/* Diff tree */}
            <div className="flex-1 overflow-y-auto py-1">
                {filteredEntries.map((entry, i) => {
                    const cfg = STATUS_CONFIG[entry.status];
                    return (
                        <div
                            key={`${entry.name}-${i}`}
                            className="flex items-center gap-2 px-3 py-1 hover:bg-[#ffffff08]"
                            style={{ background: cfg.bg }}
                        >
                            <span style={{ color: cfg.color }} className="flex-shrink-0">
                                {cfg.icon}
                            </span>
                            <span className="text-[11px] truncate flex-1" style={{ color: cfg.color }}>
                                {entry.name}
                            </span>
                            <span className="text-[9px] font-mono" style={{ color: cfg.color }}>
                                {cfg.label}
                            </span>
                        </div>
                    );
                })}
                {filteredEntries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-[#4b5563]">
                        <p className="text-[10px]">No changes detected</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Viewport colors helper ──────────────────────────────────────────────────

/** Generate segmentColors map from diff result for viewport coloring. */
export function diffToSegmentColors(diff: DiffResult): Record<string, string> {
    const colors: Record<string, string> = {};
    const DIFF_COLORS: Record<DiffStatus, string> = {
        added: '#22c55e',
        removed: '#ef4444',
        modified: '#eab308',
        unchanged: '#6b7280',
    };

    for (const entry of diff.entries) {
        const color = DIFF_COLORS[entry.status];
        // Color meshes in the B (new) model, or A for removed
        const indices = entry.meshIndicesB ?? entry.meshIndicesA ?? [];
        for (const idx of indices) {
            colors[`Mesh_${idx}`] = color;
        }
    }

    return colors;
}
