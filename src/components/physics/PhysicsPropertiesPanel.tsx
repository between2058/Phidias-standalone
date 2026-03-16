'use client';

import React from 'react';
import { PillGroup } from '@/components/ui/ProgressBar';
import type { PhysicsPart } from '@/app/workspace/_physics/page';

const COLLISION_TYPES = [
  { value: 'convexHull', label: 'Convex Hull (Recommended)' },
  { value: 'mesh', label: 'Triangle Mesh (Slow)' },
  { value: 'convexDecomposition', label: 'Convex Decomposition' },
  { value: 'none', label: 'None (No Collision)' },
];

const PART_TYPES = [
  { value: 'link', label: 'Link — Movable rigid body' },
  { value: 'base', label: 'Base — Fixed root part' },
  { value: 'tool', label: 'Tool — End effector' },
  { value: 'joint', label: 'Joint — Connection point' },
];

const ROLES = [
  { value: 'other', label: 'Other' },
  { value: 'actuator', label: 'Actuator' },
  { value: 'support', label: 'Support' },
  { value: 'gripper', label: 'Gripper' },
  { value: 'sensor', label: 'Sensor' },
];

const MOBILITY_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'revolute', label: 'Revolute (rotates)' },
  { value: 'prismatic', label: 'Prismatic (slides)' },
];

interface PhysicsPropertiesPanelProps {
  selectedPart: PhysicsPart | null;
  onUpdatePart: (id: string, updates: Partial<PhysicsPart>) => void;
}

function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#94a3b8]">{label}</span>
        <span className="text-xs text-white font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-[#333355] accent-[#7c3aed]"
      />
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  step = 0.001,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[#94a3b8]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 bg-[#252542] border border-[#333355] rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-[#7c3aed]"
        step={step}
      />
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="py-1.5">
      <p className="text-xs text-[#94a3b8] mb-1">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PhysicsPropertiesPanel({
  selectedPart,
  onUpdatePart,
}: PhysicsPropertiesPanelProps) {
  if (!selectedPart) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-3xl mb-3">🏷️</p>
        <p className="text-sm text-white font-medium">No Part Selected</p>
        <p className="text-xs text-[#64748b] mt-1">
          Select a part from the list to edit its physics properties
        </p>
      </div>
    );
  }

  const update = (field: keyof PhysicsPart, value: unknown) => {
    onUpdatePart(selectedPart.id, { [field]: value } as Partial<PhysicsPart>);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      <div className="p-3 space-y-4">
        {/* Selected part info */}
        <div
          className="flex items-center gap-2 p-2 rounded-lg"
          style={{ background: '#252542', border: '1px solid #333355' }}
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: selectedPart.color }}
          />
          <span className="text-xs text-white font-medium truncate">
            {selectedPart.name}
          </span>
        </div>

        {/* Classification */}
        <div>
          <p className="text-xs font-semibold text-[#f5a623] mb-2">
            Classification
          </p>
          <SelectRow
            label="Type"
            value={selectedPart.type}
            onChange={(v) => update('type', v)}
            options={PART_TYPES}
          />
          <SelectRow
            label="Role"
            value={selectedPart.role}
            onChange={(v) => update('role', v)}
            options={ROLES}
          />
          <SelectRow
            label="Mobility"
            value={selectedPart.mobility}
            onChange={(v) => update('mobility', v)}
            options={MOBILITY_TYPES}
          />
        </div>

        {/* Collision */}
        <div className="border-t border-[#333355] pt-3">
          <p className="text-xs font-semibold text-[#f5a623] mb-2">Collision</p>
          <SelectRow
            label="Collider Type"
            value={selectedPart.collisionType}
            onChange={(v) => update('collisionType', v)}
            options={COLLISION_TYPES}
          />
        </div>

        {/* Mass & Density */}
        <div className="border-t border-[#333355] pt-3">
          <p className="text-xs font-semibold text-[#f5a623] mb-2">
            Mass &amp; Density
          </p>
          <PillGroup
            options={['Auto', 'Manual']}
            value={selectedPart.mass !== null ? 'Manual' : 'Auto'}
            onChange={(v) => update('mass', v === 'Manual' ? 1.0 : null)}
          />
          <div className="mt-2">
            {selectedPart.mass !== null ? (
              <NumberRow
                label="Mass (kg)"
                value={selectedPart.mass}
                onChange={(v) => update('mass', v)}
                step={0.1}
              />
            ) : (
              <NumberRow
                label="Density (kg/m³)"
                value={selectedPart.density}
                onChange={(v) => update('density', v)}
                step={100}
              />
            )}
          </div>
          <div className="py-1.5">
            <p className="text-xs text-[#94a3b8] mb-1">Vertices</p>
            <p className="text-xs text-white font-mono">
              {selectedPart.vertexCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Surface */}
        <div className="border-t border-[#333355] pt-3">
          <p className="text-xs font-semibold text-[#f5a623] mb-2">
            Surface Physics
          </p>
          <SliderRow
            label="Static Friction"
            value={selectedPart.staticFriction}
            onChange={(v) => update('staticFriction', v)}
          />
          <SliderRow
            label="Dynamic Friction"
            value={selectedPart.dynamicFriction}
            onChange={(v) => update('dynamicFriction', v)}
          />
          <SliderRow
            label="Restitution (Bounce)"
            value={selectedPart.restitution}
            onChange={(v) => update('restitution', v)}
          />
          <p className="text-[10px] text-[#64748b] mt-1">
            Ref: Rubber=0.9, Plastic=0.4, Ice=0.05 · Bounce: Rubber=0.8,
            Metal=0.3
          </p>
        </div>
      </div>
    </div>
  );
}
