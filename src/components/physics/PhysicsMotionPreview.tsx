'use client';

import React, { useCallback, useMemo } from 'react';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsJoint } from '@/store/physics-store';

// ─── Props ─────────────────────────────────────────────────────────────────

interface PhysicsMotionPreviewProps {
  joint: PhysicsJoint;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PhysicsMotionPreview({ joint }: PhysicsMotionPreviewProps) {
  const jointPreviewValue = usePhysicsStore((s) => s.jointPreviewValue);
  const setJointPreviewValue = usePhysicsStore((s) => s.setJointPreviewValue);

  const handleReset = useCallback(() => {
    setJointPreviewValue(0);
  }, [setJointPreviewValue]);

  const isRevolute = joint.type === 'Revolute';
  const isPrismatic = joint.type === 'Prismatic';

  const { min, max, step, unit } = useMemo(() => {
    const r = isRevolute;
    return {
      min: joint.limitsEnabled ? joint.limitLower : (r ? -180 : -1),
      max: joint.limitsEnabled ? joint.limitUpper : (r ? 180 : 1),
      step: r ? 1 : 0.001,
      unit: r ? 'deg' : 'm',
    };
  }, [isRevolute, joint.limitsEnabled, joint.limitLower, joint.limitUpper]);

  if (!isRevolute && !isPrismatic) return null;

  const current = jointPreviewValue ?? 0;

  return (
    <div className="pt-2 border-t border-[#333355]">
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
        Motion Preview
      </p>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(e) => setJointPreviewValue(parseFloat(e.target.value))}
          onMouseUp={handleReset}
          onTouchEnd={handleReset}
          className="flex-1 h-1.5 rounded-full appearance-none bg-[#333355] accent-[#7c3aed]"
        />
        <span className="text-[10px] text-white/60 font-mono w-16 text-right">
          {isRevolute ? current.toFixed(0) : current.toFixed(3)} {unit}
        </span>
      </div>
    </div>
  );
}
