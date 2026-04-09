'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseGlbForPhysics } from '@/lib/api/phidias';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsPart } from '@/store/physics-store';

// ─── Constants ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  base: '#f5a623',
  link: '#3b82f6',
  tool: '#22c55e',
  joint: '#a855f7',
};

const PART_TYPES: { value: PhysicsPart['type']; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'base', label: 'Base' },
  { value: 'tool', label: 'Tool' },
  { value: 'joint', label: 'Joint' },
];

const ROLES: { value: PhysicsPart['role']; label: string }[] = [
  { value: 'other', label: 'Other' },
  { value: 'actuator', label: 'Actuator' },
  { value: 'support', label: 'Support' },
  { value: 'gripper', label: 'Gripper' },
  { value: 'sensor', label: 'Sensor' },
];

const MOBILITY_TYPES: { value: PhysicsPart['mobility']; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'revolute', label: 'Revolute' },
  { value: 'prismatic', label: 'Prismatic' },
];

const COLLISION_TYPES: { value: PhysicsPart['collisionType']; label: string }[] = [
  { value: 'convexHull', label: 'Convex Hull' },
  { value: 'mesh', label: 'Triangle Mesh' },
  { value: 'convexDecomposition', label: 'Convex Decomposition' },
  { value: 'none', label: 'None' },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function PhysicsPartsPanel() {
  const parts = usePhysicsStore((s) => s.parts);
  const selectedPartId = usePhysicsStore((s) => s.selectedPartId);
  const setSelectedPartId = usePhysicsStore((s) => s.setSelectedPartId);
  const setParts = usePhysicsStore((s) => s.setParts);
  const updatePart = usePhysicsStore((s) => s.updatePart);

  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? null;

  const filteredParts = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ── GLB upload handler ─────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.glb') && !file.name.endsWith('.gltf')) return;
      setUploading(true);
      try {
        const result = await parseGlbForPhysics(file);
        const newParts: PhysicsPart[] = result.parts.map((p, i) => ({
          id: p.id,
          name: p.name,
          color: `hsl(${(i * 360) / result.parts.length}, 70%, 60%)`,
          type: 'link' as const,
          role: 'other' as const,
          mobility: 'fixed' as const,
          mass: null,
          density: 1000,
          collisionType: 'convexHull' as const,
          staticFriction: 0.5,
          dynamicFriction: 0.4,
          restitution: 0.3,
          materialId: null,
          isMaterialCustom: false,
          originalMaterial: p.material,
          vertexCount: p.vertex_count,
        }));
        // Mark first part as base
        if (newParts.length > 0) {
          newParts[0].type = 'base';
        }
        setParts(newParts);
      } catch (err) {
        console.error('[PhysicsPartsPanel] GLB parse failed:', err);
      } finally {
        setUploading(false);
      }
    },
    [setParts],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ── Summary counts ─────────────────────────────────────────────────────

  const baseCount = parts.filter((p) => p.type === 'base').length;
  const linkCount = parts.filter((p) => p.type === 'link').length;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Part list ──────────────────────────────────────────────── */}
      <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-[#333355]">
        {/* Search */}
        <div className="px-3 py-2 border-b border-[#333355]">
          <input
            type="text"
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder-white/30 focus:outline-none focus:border-[#7c3aed]"
          />
        </div>

        {/* Part list or upload zone */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {parts.length === 0 ? (
            /* Upload drop zone */
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center h-full px-4 cursor-pointer group"
            >
              <div className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-[#333355] group-hover:border-[#7c3aed]/50 transition-colors">
                <Upload size={24} className="text-white/40 group-hover:text-[#7c3aed] transition-colors" />
                <div className="text-center">
                  <p className="text-xs text-white/60 font-medium">
                    {uploading ? 'Parsing...' : 'Drop GLB file here'}
                  </p>
                  <p className="text-[10px] text-white/30 mt-1">
                    or click to browse
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          ) : (
            /* Part list */
            filteredParts.map((part) => (
              <div
                key={part.id}
                onClick={() =>
                  setSelectedPartId(part.id === selectedPartId ? null : part.id)
                }
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors border-b border-[#333355]/50',
                  part.id === selectedPartId
                    ? 'bg-[#7c3aed]/15 border-l-2 border-l-[#7c3aed]'
                    : 'hover:bg-white/5',
                )}
              >
                {/* Color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/10"
                  style={{ background: part.color }}
                />
                {/* Name */}
                <span className="flex-1 text-xs text-white/80 font-medium truncate">
                  {part.name}
                </span>
                {/* Type badge */}
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{
                    background: `${TYPE_COLORS[part.type] ?? '#64748b'}22`,
                    color: TYPE_COLORS[part.type] ?? '#64748b',
                  }}
                >
                  {part.type}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer summary */}
        {parts.length > 0 && (
          <div className="px-3 py-2 border-t border-[#333355]">
            <span className="text-[10px] text-white/40">
              {parts.length} parts | {baseCount} base | {linkCount} links
            </span>
          </div>
        )}
      </div>

      {/* ── Right: Selected part properties ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {selectedPart ? (
          <div className="p-3 space-y-3">
            {/* Name input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                Name
              </label>
              <input
                type="text"
                value={selectedPart.name}
                onChange={(e) => updatePart(selectedPart.id, { name: e.target.value })}
                className="w-full bg-white/5 border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
              />
            </div>

            {/* Type / Role / Mobility — 3 columns */}
            <div className="grid grid-cols-3 gap-2">
              <SelectField
                label="Type"
                value={selectedPart.type}
                options={PART_TYPES}
                onChange={(v) => updatePart(selectedPart.id, { type: v as PhysicsPart['type'] })}
              />
              <SelectField
                label="Role"
                value={selectedPart.role}
                options={ROLES}
                onChange={(v) => updatePart(selectedPart.id, { role: v as PhysicsPart['role'] })}
              />
              <SelectField
                label="Mobility"
                value={selectedPart.mobility}
                options={MOBILITY_TYPES}
                onChange={(v) => updatePart(selectedPart.id, { mobility: v as PhysicsPart['mobility'] })}
              />
            </div>

            {/* Mass / Density — 2 columns */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                  Mass (kg)
                </label>
                <input
                  type="number"
                  value={selectedPart.mass ?? ''}
                  placeholder="Auto"
                  onChange={(e) => {
                    const val = e.target.value;
                    updatePart(selectedPart.id, {
                      mass: val === '' ? null : parseFloat(val) || 0,
                    });
                  }}
                  className="w-full bg-white/5 border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                  step={0.1}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                  Density (kg/m3)
                </label>
                <input
                  type="number"
                  value={selectedPart.density}
                  onChange={(e) =>
                    updatePart(selectedPart.id, { density: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white/5 border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                  step={100}
                />
              </div>
            </div>

            {/* Collision type */}
            <SelectField
              label="Collision"
              value={selectedPart.collisionType}
              options={COLLISION_TYPES}
              onChange={(v) => updatePart(selectedPart.id, { collisionType: v as PhysicsPart['collisionType'] })}
            />

            {/* Friction / Restitution sliders — 3 columns */}
            <div className="grid grid-cols-3 gap-2">
              <SliderField
                label="Static Fr."
                value={selectedPart.staticFriction}
                onChange={(v) => updatePart(selectedPart.id, { staticFriction: v, isMaterialCustom: true })}
              />
              <SliderField
                label="Dynamic Fr."
                value={selectedPart.dynamicFriction}
                onChange={(v) => updatePart(selectedPart.id, { dynamicFriction: v, isMaterialCustom: true })}
              />
              <SliderField
                label="Restitution"
                value={selectedPart.restitution}
                onChange={(v) => updatePart(selectedPart.id, { restitution: v, isMaterialCustom: true })}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-white/40">
              Select a part to edit properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-[#333355] rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
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

function SliderField({
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
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] uppercase tracking-wider text-white/40">
          {label}
        </label>
        <span className="text-[10px] text-white/60 font-mono">
          {value.toFixed(2)}
        </span>
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
