'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { clsx } from 'clsx';
import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  joints: JointSpec[];
  pose: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

const CYCLE_SECONDS = 6;

export function CADJointControls({ joints, pose, onChange }: Props) {
  const movable = joints.filter(
    (j) => j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous',
  );
  const [animating, setAnimating] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Cycle every movable joint sinusoidally between its lower and upper limits.
  // Each joint gets a phase offset so they don't all peak at the same instant.
  useEffect(() => {
    if (!animating || movable.length === 0) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const next: Record<string, number> = {};
      for (let i = 0; i < movable.length; i++) {
        const j = movable[i];
        const phase = (i / Math.max(1, movable.length)) * Math.PI * 2;
        const half = (j.upper - j.lower) / 2;
        const mid = (j.upper + j.lower) / 2;
        next[j.name] = mid + half * Math.sin((t / CYCLE_SECONDS) * Math.PI * 2 + phase);
      }
      onChangeRef.current(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating, movable]);

  if (movable.length === 0) {
    return <div className="text-slate-500">No movable joints.</div>;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setAnimating((v) => !v)}
        aria-pressed={animating}
        className={clsx(
          'flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm transition',
          animating
            ? 'bg-[var(--accent-purple)]/30 text-white'
            : 'bg-black/30 text-slate-300 hover:bg-black/40',
        )}
      >
        {animating ? <Pause size={14} /> : <Play size={14} />}
        {animating ? 'Pause motion' : 'Preview motion'}
      </button>

      {movable.map((j) => {
        const value = pose[j.name] ?? 0;
        const span = j.upper - j.lower;
        const step = span > 0 ? span / 200 : 0.01;
        return (
          <div key={j.name}>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">{j.name}</span>
              <span>{value.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label={j.name}
              min={j.lower}
              max={j.upper}
              step={step}
              value={value}
              disabled={animating}
              onChange={(e) => onChange({ ...pose, [j.name]: Number(e.target.value) })}
              className="w-full accent-[var(--accent-purple)] disabled:opacity-60"
            />
          </div>
        );
      })}
    </div>
  );
}
