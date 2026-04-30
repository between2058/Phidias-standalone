'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { usePhysicsStore } from '@/store/physics-store';

const _TYPE_COLORS: Record<string, string> = {
  base: '#f5a623',
  link: '#3b82f6',
  tool: '#22c55e',
  joint: '#a855f7',
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function PhysicsMaterialsPanel() {
  const parts = usePhysicsStore((s) => s.parts);
  const selectedPartId = usePhysicsStore((s) => s.selectedPartId);
  const setSelectedPartId = usePhysicsStore((s) => s.setSelectedPartId);
  const materialPresets = usePhysicsStore((s) => s.materialPresets);
  const applyMaterialPreset = usePhysicsStore((s) => s.applyMaterialPreset);

  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Part list ──────────────────────────────────────────────── */}
      <div className="w-[200px] flex-shrink-0 flex flex-col border-r border-[#333355]">
        <div className="px-3 py-1.5 border-b border-[#333355]">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            Parts ({parts.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {parts.map((part) => (
            <div
              key={part.id}
              onClick={() =>
                setSelectedPartId(part.id === selectedPartId ? null : part.id)
              }
              className={cn(
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-[#333355]/50',
                part.id === selectedPartId
                  ? 'bg-[#7c3aed]/15 border-l-2 border-l-[#7c3aed]'
                  : 'hover:bg-white/5',
              )}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/10"
                style={{ background: part.color }}
              />
              <span className="flex-1 text-xs text-white/80 truncate">
                {part.name}
              </span>
              {/* Material badge */}
              {part.materialId ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7c3aed]/20 text-[#a78bfa] flex-shrink-0">
                  {materialPresets.find((m) => m.id === part.materialId)?.name ?? '?'}
                </span>
              ) : (
                <span className="text-[9px] text-white/20 flex-shrink-0">--</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: Material preset grid ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
          Material Presets
          {!selectedPart && (
            <span className="ml-2 text-[#f5a623]">select a part</span>
          )}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {materialPresets.map((preset) => {
            const isActive = selectedPart?.materialId === preset.id;
            return (
              <button
                key={preset.id}
                disabled={!selectedPart}
                onClick={() =>
                  selectedPart && applyMaterialPreset(selectedPart.id, preset.id)
                }
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all border',
                  isActive
                    ? 'ring-2 ring-[#7c3aed] bg-[#7c3aed]/10 border-[#7c3aed]/40'
                    : 'bg-white/5 hover:bg-white/10 border-[#333355] disabled:opacity-30 disabled:hover:bg-white/5',
                )}
                title={`${preset.name} — ${preset.density} kg/m3`}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-md"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${preset.color}ff, ${preset.color}88)`,
                    boxShadow: `0 2px 8px ${preset.color}44`,
                    border: isActive
                      ? `2px solid ${preset.color}`
                      : '2px solid transparent',
                  }}
                />
                <span className="text-[9px] text-white/60 font-medium truncate w-full text-center">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Current material info ─────────────────────────────────── */}
      <div className="w-[180px] flex-shrink-0 border-l border-[#333355] p-3">
        {selectedPart ? (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                Current Material
              </p>
              <p className="text-xs text-white/80 font-medium">
                {selectedPart.materialId
                  ? materialPresets.find((m) => m.id === selectedPart.materialId)?.name ?? 'Custom'
                  : 'None'}
                {selectedPart.isMaterialCustom && (
                  <span className="ml-1 text-[#f5a623] text-[10px]">(modified)</span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[10px] text-white/40">Density</span>
                <span className="text-[10px] text-white/60 font-mono">
                  {selectedPart.density} kg/m3
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-white/40">Static Fr.</span>
                <span className="text-[10px] text-white/60 font-mono">
                  {selectedPart.staticFriction.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-white/40">Dynamic Fr.</span>
                <span className="text-[10px] text-white/60 font-mono">
                  {selectedPart.dynamicFriction.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-white/40">Restitution</span>
                <span className="text-[10px] text-white/60 font-mono">
                  {selectedPart.restitution.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-white/30 text-center">
              No part selected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
