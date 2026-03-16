'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { mockGetPhysicsMaterials } from '@/lib/api/mock';
import type { PhysicsMaterial } from '@/lib/api/types';
import type { PhysicsPart } from '@/app/workspace/_physics/page';

interface PhysicsMaterialsPanelProps {
  selectedPart: PhysicsPart | null;
  onApplyMaterial: (
    partId: string,
    material: {
      id: string;
      staticFriction: number;
      dynamicFriction: number;
      restitution: number;
      density: number;
    },
  ) => void;
}

export default function PhysicsMaterialsPanel({
  selectedPart,
  onApplyMaterial,
}: PhysicsMaterialsPanelProps) {
  const materials = mockGetPhysicsMaterials();

  if (!selectedPart) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-3xl mb-3">🎨</p>
        <p className="text-sm text-white font-medium">No Part Selected</p>
        <p className="text-xs text-[#64748b] mt-1">
          Select a part from the list to apply a physics material
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#333355]">
        <p className="text-xs font-semibold text-white">Material Library</p>
        <p className="text-[10px] text-[#64748b] mt-0.5">
          Applying to:{' '}
          <span style={{ color: selectedPart.color }}>{selectedPart.name}</span>
        </p>
      </div>

      {/* Material grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        <div className="grid grid-cols-2 gap-2">
          {materials.map((mat: PhysicsMaterial) => {
            const isSelected = selectedPart.materialId === mat.id;
            return (
              <button
                key={mat.id}
                onClick={() =>
                  onApplyMaterial(selectedPart.id, {
                    id: mat.id,
                    staticFriction: mat.staticFriction,
                    dynamicFriction: mat.dynamicFriction,
                    restitution: mat.restitution,
                    density: mat.density,
                  })
                }
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl transition-all text-left border',
                  isSelected
                    ? 'ring-2 ring-[#f5a623] bg-[#f5a623]/10 border-[#f5a623]/40'
                    : 'bg-[#252542] hover:bg-[#2a2a4a] border-[#333355]',
                )}
                title={`Density: ${mat.density} kg/m³ · Friction: ${mat.staticFriction}`}
              >
                {/* Sphere preview */}
                <div
                  className="w-10 h-10 rounded-full flex-shrink-0 shadow-lg"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${mat.color}ff, ${mat.color}88)`,
                    boxShadow: `0 4px 12px ${mat.color}44`,
                    border: isSelected
                      ? `2px solid ${mat.color}`
                      : '2px solid transparent',
                  }}
                />
                <div className="w-full text-center">
                  <p className="text-[10px] text-white font-medium truncate">
                    {mat.name}
                  </p>
                  <p className="text-[9px] text-[#64748b]">
                    ρ {mat.density} kg/m³
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Properties Footer */}
      <div
        className="p-3 border-t border-[#333355]"
        style={{ background: '#1a1a2e' }}
      >
        <p className="text-[10px] font-semibold text-white mb-2">
          {selectedPart.name} — Current Properties
          {selectedPart.isMaterialCustom && (
            <span className="ml-1 text-[#f5a623]">(customized)</span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#64748b]">Density</span>
            <span className="text-white">{selectedPart.density} kg/m³</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Mass</span>
            <span className="text-white">
              {selectedPart.mass ? `${selectedPart.mass} kg` : 'Auto'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Static Fr.</span>
            <span className="text-white">{selectedPart.staticFriction}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Restitution</span>
            <span className="text-white">{selectedPart.restitution}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
