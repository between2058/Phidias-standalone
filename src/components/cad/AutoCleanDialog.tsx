'use client';

import React, { useState } from 'react';
import { X, Trash2, FolderTree, Type, Sparkles } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutoCleanDialogProps {
    duplicateCount: number;
    duplicateGroupCount: number;
    onRun: (options: AutoCleanOptions) => void;
    onClose: () => void;
}

export interface AutoCleanOptions {
    removeDuplicates: boolean;
    autoGroup: boolean;
    semanticNaming: boolean;
}

export interface AutoCleanReport {
    duplicatesRemoved: number;
    groupsAffected: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutoCleanDialog({
    duplicateCount,
    duplicateGroupCount,
    onRun,
    onClose,
}: AutoCleanDialogProps) {
    const [removeDuplicates, setRemoveDuplicates] = useState(true);
    const [report, setReport] = useState<AutoCleanReport | null>(null);

    const canRun = removeDuplicates && duplicateCount > 0;

    function handleRun() {
        onRun({
            removeDuplicates,
            autoGroup: false,
            semanticNaming: false,
        });
        setReport({
            duplicatesRemoved: removeDuplicates ? duplicateCount : 0,
            groupsAffected: removeDuplicates ? duplicateGroupCount : 0,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
                className="w-[380px] rounded-xl shadow-2xl overflow-hidden"
                style={{ background: '#1e1e36', border: '1px solid #333355' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#333355]">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#D5B451]" />
                        <span className="text-sm font-medium text-white">Auto Clean</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-[#ffffff10] text-[#64748b]"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Steps */}
                <div className="px-4 py-3 space-y-3">
                    {/* Remove Duplicates */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={removeDuplicates}
                            onChange={(e) => setRemoveDuplicates(e.target.checked)}
                            className="mt-0.5 accent-[#D5B451]"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Trash2 size={12} className="text-[#ef4444]" />
                                <span className="text-xs font-medium text-white">Remove Duplicates</span>
                            </div>
                            <p className="text-[10px] text-[#64748b] mt-0.5">
                                Hide {duplicateCount} duplicate part{duplicateCount !== 1 ? 's' : ''} across {duplicateGroupCount} group{duplicateGroupCount !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </label>

                    {/* Auto Group — placeholder */}
                    <label className="flex items-start gap-3 opacity-40 cursor-not-allowed">
                        <input type="checkbox" disabled className="mt-0.5" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <FolderTree size={12} className="text-[#3b82f6]" />
                                <span className="text-xs font-medium text-white">Auto Group</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#333355] text-[#64748b]">Coming soon</span>
                            </div>
                            <p className="text-[10px] text-[#64748b] mt-0.5">
                                Automatically group related parts by proximity
                            </p>
                        </div>
                    </label>

                    {/* Semantic Naming — placeholder */}
                    <label className="flex items-start gap-3 opacity-40 cursor-not-allowed">
                        <input type="checkbox" disabled className="mt-0.5" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Type size={12} className="text-[#22c55e]" />
                                <span className="text-xs font-medium text-white">Semantic Naming</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#333355] text-[#64748b]">Coming soon</span>
                            </div>
                            <p className="text-[10px] text-[#64748b] mt-0.5">
                                Rename parts based on geometry classification
                            </p>
                        </div>
                    </label>
                </div>

                {/* Report */}
                {report && (
                    <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20">
                        <p className="text-[11px] text-[#22c55e] font-medium">Clean complete</p>
                        <p className="text-[10px] text-[#94a3b8] mt-0.5">
                            Removed {report.duplicatesRemoved} duplicate{report.duplicatesRemoved !== 1 ? 's' : ''} ({report.groupsAffected} group{report.groupsAffected !== 1 ? 's' : ''})
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#333355]">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg text-xs text-[#94a3b8] hover:bg-[#ffffff08]"
                    >
                        {report ? 'Done' : 'Cancel'}
                    </button>
                    {!report && (
                        <button
                            onClick={handleRun}
                            disabled={!canRun}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-40"
                            style={{ background: '#D5B451', color: '#1a1a2e' }}
                        >
                            Run Clean
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
