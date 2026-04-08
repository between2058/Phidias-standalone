import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/ProgressBar';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface P3SAMParams {
  // P3-SAM / Auto params
  point_num: number;
  prompt_num: number;
  threshold: number;
  prompt_bs: number;
  post_process: boolean;
  clean_mesh: boolean;
  seed: number;
  randomize_seed: boolean;
}

export interface SegmentResult {
  id: string;
  name: string;
  color: string;
  score: number; // IoU confidence, 0–1
  meshIds: string[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: P3SAMParams = {
  // P3-SAM defaults from auto_mask.py
  point_num: 100000,
  prompt_num: 400,
  threshold: 0.95,
  prompt_bs: 32,
  post_process: true,
  clean_mesh: true,
  seed: 0,
  randomize_seed: true,
};

// ─── Low-level UI primitives ──────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-[#94a3b8]">{label}</span>
        <span className="text-[11px] text-white font-mono">
          {display(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-[#333355] accent-[#D5B451]"
      />
    </div>
  );
}

function SeedTooltip() {
  return (
    <span className="relative group inline-flex items-center">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#333355] text-[#94a3b8] text-[9px] font-bold cursor-help select-none leading-none">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-52 rounded-lg bg-[#1a1a2e] border border-[#333355] px-3 py-2 text-[11px] text-[#cbd5e1] leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        Enable this to let the AI start from a new point each time for fresh,
        unpredictable results. Disable it to lock the AI&apos;s path, ensuring
        you get the same consistent response every time.
        <span className="absolute top-full left-3 border-4 border-transparent border-t-[#333355]" />
      </span>
    </span>
  );
}

// ─── Results Row ─────────────────────────────────────────────────────────────

function ResultRow({ result }: { result: SegmentResult }) {
  const scoreColor =
    result.score >= 0.9
      ? '#22c55e'
      : result.score >= 0.7
        ? '#f59e0b'
        : '#ef4444';

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#252542] transition-colors">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: result.color }}
      />
      <span className="flex-1 text-xs text-white truncate">{result.name}</span>
      <span
        className="text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ background: `${scoreColor}22`, color: scoreColor }}
      >
        {result.score.toFixed(2)}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SegmentAIPanelProps {
  /** Whether a model is loaded — enables the Start button */
  isEnabled: boolean;
  isSegmenting: boolean;
  progress: number;
  error: string | null;
  results: SegmentResult[];
  onStart: (params: P3SAMParams) => void;
  onCancel: () => void;
  onSmartOrganize?: () => void;
  isOrganizing?: boolean;
  hasMultipleParts?: boolean;
}

export default function SegmentAIPanel({
  isEnabled,
  isSegmenting,
  progress,
  error,
  results,
  onStart,
  onCancel,
  onSmartOrganize,
  isOrganizing,
  hasMultipleParts,
}: SegmentAIPanelProps) {
  const [params, setParams] = useState<P3SAMParams>(DEFAULT_PARAMS);

  const setParam = useCallback(
    <K extends keyof P3SAMParams>(key: K, value: P3SAMParams[K]) => {
      setParams(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleStart = () => {
    const finalParams =
      params.randomize_seed
        ? { ...params, seed: Math.floor(Math.random() * 2_147_483_647) }
        : params;
    onStart(finalParams);
  };

  const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v));


  return (
    <div className="flex flex-col h-full">
      <style jsx>{`
        .btn-gradient {
          position: relative;
          overflow: hidden;
        }
        .gradient-bg {
          position: absolute;
          inset: 0;
          border-radius: inherit;
        }
        .bg1 {
          background: linear-gradient(135deg, #22c55e, #f5a623);
        }
        .bg2 {
          background: linear-gradient(135deg, #f5a623, #22c55e);
          opacity: 0;
        }

        @keyframes bgFade {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .bg2.animate {
          animation: bgFade 1s ease-in-out infinite;
        }

        .btn-content {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.12);
          border-top-color: #1a1a2e;
          border-radius: 50%;
          display: inline-block;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        button.disabled-btn .btn-content {
          opacity: 0.5;
        }
        button.disabled-btn .gradient-bg {
          filter: grayscale(1) opacity(0.2);
        }
      `}</style>
      {/* ── Scrollable Params ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin px-4 py-3 space-y-4">
        {/* ──────── AUTO MODE PARAMS ──────── */}
        <div className="space-y-2 pb-1">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
            Sampling
          </p>
          <div className="space-y-3">
            <SliderRow
              label="Point Density"
              value={params.point_num}
              min={10000}
              max={500000}
              step={10000}
              display={fmtK}
              onChange={(v) => setParam('point_num', v)}
            />
            <SliderRow
              label="Prompt Points"
              value={params.prompt_num}
              min={50}
              max={1000}
              step={50}
              display={(v) => String(v)}
              onChange={(v) => setParam('prompt_num', v)}
            />
          </div>
        </div>

        <div className="border-t border-[#333355] pt-3 space-y-2 pb-1">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
            Detection
          </p>
          <div className="space-y-3">
            <SliderRow
              label="Area Threshold"
              value={params.threshold}
              min={0}
              max={1}
              step={0.01}
              display={(v) => v.toFixed(2)}
              onChange={(v) => setParam('threshold', v)}
            />
            <SliderRow
              label="Batch Size"
              value={params.prompt_bs}
              min={4}
              max={128}
              step={4}
              display={(v) => String(v)}
              onChange={(v) => setParam('prompt_bs', v)}
            />
          </div>
        </div>

        <div className="border-t border-[#333355] pt-3 space-y-2 pb-1">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
            Post-Processing
          </p>
          <div className="space-y-0">
            <Toggle
              label="Post-Process"
              checked={params.post_process}
              onChange={(v) => setParam('post_process', v)}
            />
            <Toggle
              label="Clean Mesh"
              checked={params.clean_mesh}
              onChange={(v) => setParam('clean_mesh', v)}
            />
          </div>
        </div>

        <div className="border-t border-[#333355] pt-3 space-y-2 pb-1">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
            Advanced
          </p>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1">
                  <span className="text-[11px] text-[#94a3b8]">Seed</span>
                  <SeedTooltip />
                </span>
                <Toggle
                  label="Random"
                  checked={params.randomize_seed}
                  onChange={(v) => setParam('randomize_seed', v)}
                />
              </div>
              {!params.randomize_seed && (
                <input
                  type="number"
                  value={params.seed}
                  onChange={(e) =>
                    setParam('seed', Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#D5B451]"
                  min={0}
                  max={2147483647}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA / Progress ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 p-3 border-t space-y-2.5"
        style={{ borderColor: '#333355' }}
      >
        {/* Error banner */}
        {error && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid #ef4444',
              color: '#f87171',
            }}
          >
            <span className="flex-shrink-0 mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Main Action */}
        <button
          onClick={isSegmenting ? onCancel : handleStart}
          disabled={!isEnabled && !isSegmenting}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] transition-opacity hover:opacity-90 btn-gradient',
            !isEnabled && !isSegmenting
              ? 'disabled-btn cursor-not-allowed'
              : 'cursor-pointer shadow-[0_4px_20px_rgba(34,197,94,0.3)]',
            isSegmenting ? 'generating' : '',
          )}
        >
          <span className="gradient-bg bg1" aria-hidden />
          <span
            className={`gradient-bg bg2${isSegmenting ? ' animate' : ''}`}
            aria-hidden
          />

          <span className="btn-content">
            {isSegmenting ? (
              <>
                <span className="spinner" aria-hidden />
                <span>
                  Segmenting... {Math.round(progress)}%{' '}
                  <span className="text-xs opacity-70 ml-1">(Cancel)</span>
                </span>
              </>
            ) : (
              <span>⚙ Start Segmentation</span>
            )}
          </span>
        </button>

        {!isEnabled && !isSegmenting && (
          <p className="text-center text-[10px]" style={{ color: '#4b5563' }}>
            Load a 3D model first
          </p>
        )}
      </div>

      {/* ── Smart Organize ─────────────────────────────────────────────── */}
      {(results.length > 0 || hasMultipleParts) && !isSegmenting && onSmartOrganize && (
        <div
          className="flex-shrink-0 p-3 border-t"
          style={{ borderColor: '#333355' }}
        >
          <button
            onClick={onSmartOrganize}
            disabled={isOrganizing}
            className={cn(
              'w-full py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90',
              isOrganizing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            )}
            style={{
              background: isOrganizing
                ? '#252542'
                : 'linear-gradient(135deg, #7c3aed, #D5B451)',
              color: isOrganizing ? '#64748b' : '#fff',
            }}
          >
            {isOrganizing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Organizing...
              </span>
            ) : (
              'Smart Organize'
            )}
          </button>
          <p
            className="text-center text-[9px] mt-1.5"
            style={{ color: '#4b5563' }}
          >
            Uses VLM to auto-name parts &amp; create groups
          </p>
        </div>
      )}

    </div>
  );
}
