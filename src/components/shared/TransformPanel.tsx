'use client';

import { RotateCcw, PlusCircle, RefreshCw, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TransformValues {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

interface TransformPanelProps {
  transform?: TransformValues;
  onChange?: (transform: TransformValues) => void;
  className?: string;
}

const defaultTransform: TransformValues = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
  color: string;
}

function NumberInput({ value, onChange, label, color }: NumberInputProps) {
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <span className="text-[10px] font-bold shrink-0" style={{ color }}>
        {label}
      </span>
      <input
        type="number"
        value={value.toFixed(2)}
        step={0.01}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={cn(
          'w-full bg-bg-card border border-phidias-border rounded text-text-primary text-[11px] px-1.5 py-1',
          'focus:outline-none focus:border-accent-purple transition-colors',
          'min-w-0',
        )}
        style={{ appearance: 'textfield' }}
      />
    </div>
  );
}

export default function TransformPanel({
  transform,
  onChange,
  className,
}: TransformPanelProps) {
  const handleChange = (
    key: keyof TransformValues,
    axis: 'x' | 'y' | 'z',
    value: number,
  ) => {
    if (!onChange || !transform) return;
    onChange({
      ...transform,
      [key]: {
        ...transform[key],
        [axis]: value,
      },
    });
  };

  const handleReset = () => {
    onChange?.(defaultTransform);
  };

  if (!transform) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-phidias-border">
          <span className="text-xs font-semibold text-text-primary">
            Transform
          </span>
        </div>
        <div className="flex items-center justify-center py-4">
          <p className="text-[11px] text-text-tertiary opacity-60">
            No object selected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-phidias-border">
        <span className="text-xs font-semibold text-text-primary">
          Transform
        </span>
        <button
          onClick={handleReset}
          className="p-1 rounded hover:bg-bg-hover transition-colors text-text-tertiary hover:text-text-secondary"
          title="Reset Transform"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-3 py-2">
        {/* Position Row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center shrink-0">
            <PlusCircle size={14} className="text-text-tertiary" />
          </div>
          <div className="flex gap-1 flex-1 min-w-0">
            <NumberInput
              label="X"
              color="#ef4444"
              value={transform.position.x}
              onChange={(v) => handleChange('position', 'x', v)}
            />
            <NumberInput
              label="Y"
              color="#22c55e"
              value={transform.position.y}
              onChange={(v) => handleChange('position', 'y', v)}
            />
            <NumberInput
              label="Z"
              color="#3b82f6"
              value={transform.position.z}
              onChange={(v) => handleChange('position', 'z', v)}
            />
          </div>
        </div>

        {/* Rotation Row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center shrink-0">
            <RefreshCw size={14} className="text-text-tertiary" />
          </div>
          <div className="flex gap-1 flex-1 min-w-0">
            <NumberInput
              label="X"
              color="#ef4444"
              value={transform.rotation.x}
              onChange={(v) => handleChange('rotation', 'x', v)}
            />
            <NumberInput
              label="Y"
              color="#22c55e"
              value={transform.rotation.y}
              onChange={(v) => handleChange('rotation', 'y', v)}
            />
            <NumberInput
              label="Z"
              color="#3b82f6"
              value={transform.rotation.z}
              onChange={(v) => handleChange('rotation', 'z', v)}
            />
          </div>
        </div>

        {/* Scale Row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center shrink-0">
            <MinusCircle size={14} className="text-text-tertiary" />
          </div>
          <div className="flex gap-1 flex-1 min-w-0">
            <NumberInput
              label="X"
              color="#ef4444"
              value={transform.scale.x}
              onChange={(v) => handleChange('scale', 'x', v)}
            />
            <NumberInput
              label="Y"
              color="#22c55e"
              value={transform.scale.y}
              onChange={(v) => handleChange('scale', 'y', v)}
            />
            <NumberInput
              label="Z"
              color="#3b82f6"
              value={transform.scale.z}
              onChange={(v) => handleChange('scale', 'z', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
