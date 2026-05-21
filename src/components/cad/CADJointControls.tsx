'use client';

import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  joints: JointSpec[];
  pose: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

export function CADJointControls({ joints, pose, onChange }: Props) {
  const movable = joints.filter(
    (j) => j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous',
  );
  if (movable.length === 0) {
    return <div className="text-slate-500">No movable joints.</div>;
  }
  return (
    <div className="space-y-3">
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
              onChange={(e) => onChange({ ...pose, [j.name]: Number(e.target.value) })}
              className="w-full accent-[var(--accent-purple)]"
            />
          </div>
        );
      })}
    </div>
  );
}
