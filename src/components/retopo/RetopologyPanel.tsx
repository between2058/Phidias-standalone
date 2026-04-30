'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ProgressBar, Toggle, PillGroup } from '@/components/ui/ProgressBar';
import type { ProgressUpdate } from '@/lib/api/types';

interface RetopologyPanelProps {
  onRetopo: (targetFaces: number, topology: string) => void;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  originalFaces?: number;
}

export default function RetopologyPanel({
  onRetopo,
  isProcessing,
  progress,
  originalFaces = 1935274,
}: RetopologyPanelProps) {
  const [topology, setTopology] = useState('Triangle');
  const [polyMode, setPolyMode] = useState('Fixed');
  const [preset, setPreset] = useState('10K');
  const [polycount, setPolycount] = useState(10000);
  const [smartLowPoly, setSmartLowPoly] = useState(false);
  const [preserveUV, setPreserveUV] = useState(true);
  const [symmetry, setSymmetry] = useState(false);
  const [symmetryAxis, setSymmetryAxis] = useState('X');

  const handlePreset = (p: string) => {
    setPreset(p);
    const vals: Record<string, number> = {
      '3K': 3000,
      '10K': 10000,
      '30K': 30000,
      '100K': 100000,
    };
    if (vals[p]) setPolycount(vals[p]);
  };

  const formatFaces = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(0)}K`
        : String(n);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>⊞</span> Retopology
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
        {/* Topology type */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#94a3b8]">Topology</span>
            <span
              className="text-[#64748b] text-xs cursor-help"
              title="Quad produces cleaner mesh for animation"
            >
              ⓘ
            </span>
          </div>
          <PillGroup
            options={['Quad', 'Triangle']}
            value={topology}
            onChange={setTopology}
          />
        </div>

        {/* Polygon Count */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs text-[#f5a623]">👑</span>
            <span className="text-xs text-[#94a3b8]">Polygon Count</span>
            <span
              className="text-[#64748b] text-xs cursor-help"
              title="Target polygon count"
            >
              ⓘ
            </span>
          </div>
          <PillGroup
            options={['Fixed', 'Adaptive']}
            value={polyMode}
            onChange={setPolyMode}
          />

          {polyMode === 'Fixed' && (
            <div className="mt-3 space-y-2">
              {/* Presets */}
              <div className="flex gap-1">
                {['Custom', '3K', '10K', '30K', '100K'].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePreset(p)}
                    className={cn(
                      'flex-1 py-1.5 text-[10px] rounded-lg transition-colors',
                      preset === p
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-[#252542] text-[#94a3b8] hover:bg-[#333355]',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#64748b]">500</span>
                  <span className="text-xs text-white font-mono">
                    {polycount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#64748b]">200K</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={500}
                    max={200000}
                    step={500}
                    value={polycount}
                    onChange={(e) => {
                      setPolycount(parseInt(e.target.value));
                      setPreset('Custom');
                    }}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-[#333355] accent-[#7c3aed]"
                  />
                  <button
                    className="px-2 py-1 text-[10px] rounded bg-[#252542] text-[#94a3b8] hover:bg-[#333355] transition-colors"
                    onClick={() => {
                      setPolycount(10000);
                      setPreset('10K');
                    }}
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Options */}
        <div className="border-t border-[#333355] pt-3 space-y-0">
          <p className="text-xs text-[#94a3b8] mb-2">Advanced Options</p>
          <Toggle
            label="Smart Low Poly"
            checked={smartLowPoly}
            onChange={setSmartLowPoly}
            crown
            badge="v2"
          />
          <Toggle
            label="Preserve UV"
            checked={preserveUV}
            onChange={setPreserveUV}
          />
          <Toggle label="Symmetry" checked={symmetry} onChange={setSymmetry} />
          {symmetry && (
            <div className="pl-4 mt-1">
              <PillGroup
                options={['X', 'Y', 'Z']}
                value={symmetryAxis}
                onChange={setSymmetryAxis}
              />
            </div>
          )}
        </div>

        {/* Preview info */}
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: '#252542', border: '1px solid #333355' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#94a3b8]">Estimated time</span>
            <span className="text-white">~2 min</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#94a3b8]">Cost</span>
            <span className="text-[#f5a623]">⚡ 30 credits</span>
          </div>
          <div className="border-t border-[#333355] pt-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">Before</span>
              <span className="text-white font-mono">
                {formatFaces(originalFaces)} faces
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-0.5">
              <span className="text-[#94a3b8]">After</span>
              <span className="text-[#22c55e] font-mono">
                {polycount.toLocaleString()} faces
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="p-4 border-t border-[#333355]">
        {isProcessing && progress ? (
          <ProgressBar
            percent={progress.percent}
            stage={progress.stage}
            color="green"
          />
        ) : (
          <button
            onClick={() => onRetopo(polycount, topology.toLowerCase())}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #22c55e, #84cc16)' }}
          >
            ✓ Confirm Retopology
          </button>
        )}
      </div>
    </div>
  );
}
