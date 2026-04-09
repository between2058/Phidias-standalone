'use client';

import React, { useCallback } from 'react';
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

  const isRevolute = joint.type === 'Revolute';
  const isPrismatic = joint.type === 'Prismatic';

  if (!isRevolute && !isPrismatic) return null;

  const min = joint.limitsEnabled ? joint.limitLower : (isRevolute ? -180 : -1);
  const max = joint.limitsEnabled ? joint.limitUpper : (isRevolute ? 180 : 1);
  const step = isRevolute ? 1 : 0.001;
  const unit = isRevolute ? 'deg' : 'm';
  const current = jointPreviewValue ?? 0;

  const handleReset = useCallback(() => {
    setJointPreviewValue(0);
  }, [setJointPreviewValue]);

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
