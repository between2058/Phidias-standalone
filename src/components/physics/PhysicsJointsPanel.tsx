'use client';

import React, { useCallback } from 'react';
import { RotateCw, ArrowRightLeft, Lock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsJoint } from '@/store/physics-store';
import PhysicsMotionPreview from './PhysicsMotionPreview';

// ─── Constants ─────────────────────────────────────────────────────────────

const JOINT_TYPES: PhysicsJoint['type'][] = ['Revolute', 'Prismatic', 'Fixed', 'Spherical', '6-DOF'];
const DRIVE_TYPES: PhysicsJoint['driveType'][] = ['position', 'velocity', 'none'];

const JOINT_ICON_MAP: Record<string, React.ReactNode> = {
  Revolute: <RotateCw size={14} />,
  Prismatic: <ArrowRightLeft size={14} />,
  Fixed: <Lock size={14} />,
};

const AXIS_PRESETS: { label: string; value: [number, number, number] }[] = [
  { label: 'X', value: [1, 0, 0] },
  { label: 'Y', value: [0, 1, 0] },
  { label: 'Z', value: [0, 0, 1] },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function PhysicsJointsPanel() {
  const parts = usePhysicsStore((s) => s.parts);
  const joints = usePhysicsStore((s) => s.joints);
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId);
  const setSelectedJointId = usePhysicsStore((s) => s.setSelectedJointId);
  const addJoint = usePhysicsStore((s) => s.addJoint);
  const updateJoint = usePhysicsStore((s) => s.updateJoint);
  const removeJoint = usePhysicsStore((s) => s.removeJoint);

  const selectedJoint = joints.find((j) => j.id === selectedJointId) ?? null;

  // Find default parent/child for new joints
  const basePart = parts.find((p) => p.type === 'base');
  const otherPart = parts.find((p) => p.type !== 'base') ?? parts[0];

  const handleAddJoint = useCallback(() => {
    const newJoint: PhysicsJoint = {
      id: crypto.randomUUID(),
      name: `Joint_${joints.length + 1}`,
      type: 'Revolute',
      parentPartId: basePart?.id ?? parts[0]?.id ?? '',
      childPartId: otherPart?.id ?? parts[0]?.id ?? '',
      axis: [0, 0, 1],
      anchor: [0, 0, 0],
      limitsEnabled: false,
      limitLower: -90,
      limitUpper: 90,
      driveStiffness: 0,
      driveDamping: 0,
      driveMaxForce: 1000,
      driveType: 'none',
      disableCollision: true,
    };
    addJoint(newJoint);
    setSelectedJointId(newJoint.id);
  }, [addJoint, setSelectedJointId, joints.length, basePart, otherPart, parts]);

  const handleDeleteJoint = useCallback(
    (id: string) => {
      removeJoint(id);
      if (selectedJointId === id) setSelectedJointId(null);
    },
    [removeJoint, selectedJointId, setSelectedJointId],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Joint list ─────────────────────────────────────────────── */}
      <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-[#333355]">
        {/* Header + Add button */}
        <div className="px-3 py-2 border-b border-[#333355] flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            Joints ({joints.length})
          </span>
          <button
            onClick={handleAddJoint}
            disabled={parts.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7c3aed] text-white text-[10px] font-medium hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>

        {/* Joint list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {joints.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <p className="text-xs text-white/40 text-center">
                No joints defined. Click + Add to create one.
              </p>
            </div>
          )}
          {joints.map((joint) => (
            <div
              key={joint.id}
              onClick={() =>
                setSelectedJointId(joint.id === selectedJointId ? null : joint.id)
              }
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-[#333355]/50',
                joint.id === selectedJointId
                  ? 'bg-[#7c3aed]/15 border-l-2 border-l-[#7c3aed]'
                  : 'hover:bg-white/5',
              )}
            >
              {/* Icon */}
              <span className="text-white/50 flex-shrink-0">
                {JOINT_ICON_MAP[joint.type] ?? <RotateCw size={14} />}
              </span>
              {/* Name */}
              <span className="flex-1 text-xs text-white/80 font-medium truncate">
                {joint.name}
              </span>
              {/* Type badge */}
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{ background: '#7c3aed22', color: '#a78bfa' }}
              >
                {joint.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Selected joint editor ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {selectedJoint ? (
          <div className="p-3 space-y-3">
            {/* Name + Type row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedJoint.name}
                  onChange={(e) => updateJoint(selectedJoint.id, { name: e.target.value })}
                  className="w-full bg-white/5 border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                  Type
                </label>
                <select
                  value={selectedJoint.type}
                  onChange={(e) =>
                    updateJoint(selectedJoint.id, { type: e.target.value as PhysicsJoint['type'] })
                  }
                  className="w-full bg-white/5 border border-[#333355] rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                >
                  {JOINT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parent / Child selects */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                  Parent
                </label>
                <select
                  value={selectedJoint.parentPartId}
                  onChange={(e) =>
                    updateJoint(selectedJoint.id, { parentPartId: e.target.value })
                  }
                  className="w-full bg-white/5 border border-[#333355] rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                  Child
                </label>
                <select
                  value={selectedJoint.childPartId}
                  onChange={(e) =>
                    updateJoint(selectedJoint.id, { childPartId: e.target.value })
                  }
                  className="w-full bg-white/5 border border-[#333355] rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Axis presets + manual */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                Axis
              </label>
              <div className="flex gap-1 mb-1.5">
                {AXIS_PRESETS.map((preset) => {
                  const isActive =
                    selectedJoint.axis[0] === preset.value[0] &&
                    selectedJoint.axis[1] === preset.value[1] &&
                    selectedJoint.axis[2] === preset.value[2];
                  return (
                    <button
                      key={preset.label}
                      onClick={() => updateJoint(selectedJoint.id, { axis: preset.value })}
                      className={cn(
                        'px-3 py-1 rounded text-[10px] font-medium transition-colors',
                        isActive
                          ? 'bg-[#7c3aed] text-white'
                          : 'bg-white/5 text-white/50 hover:bg-white/10',
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Anchor [x, y, z] */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                Anchor
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['X', 'Y', 'Z'] as const).map((label, i) => (
                  <div key={label}>
                    <input
                      type="number"
                      value={selectedJoint.anchor[i]}
                      onChange={(e) => {
                        const newAnchor: [number, number, number] = [...selectedJoint.anchor] as [number, number, number];
                        newAnchor[i] = parseFloat(e.target.value) || 0;
                        updateJoint(selectedJoint.id, { anchor: newAnchor });
                      }}
                      className="w-full bg-white/5 border border-[#333355] rounded px-2 py-1.5 text-xs text-white/80 text-center focus:outline-none focus:border-[#7c3aed]"
                      step={0.01}
                    />
                    <p className="text-[9px] text-center text-white/30 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Limits */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedJoint.limitsEnabled}
                  onChange={(e) =>
                    updateJoint(selectedJoint.id, { limitsEnabled: e.target.checked })
                  }
                  className="rounded accent-[#7c3aed]"
                />
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  Enable Limits
                </span>
              </label>
              {selectedJoint.limitsEnabled && (
                <div className="grid grid-cols-2 gap-2 mt-2 ml-4">
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Lower</label>
                    <input
                      type="number"
                      value={selectedJoint.limitLower}
                      onChange={(e) =>
                        updateJoint(selectedJoint.id, { limitLower: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white/5 border border-[#333355] rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Upper</label>
                    <input
                      type="number"
                      value={selectedJoint.limitUpper}
                      onChange={(e) =>
                        updateJoint(selectedJoint.id, { limitUpper: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white/5 border border-[#333355] rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drive params */}
            <div className="pt-2 border-t border-[#333355]">
              <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block">
                Drive
              </label>
              <select
                value={selectedJoint.driveType}
                onChange={(e) =>
                  updateJoint(selectedJoint.id, { driveType: e.target.value as PhysicsJoint['driveType'] })
                }
                className="w-full bg-white/5 border border-[#333355] rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed] mb-2"
              >
                {DRIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {selectedJoint.driveType !== 'none' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-white/40 mb-1 block">Stiffness</label>
                    <input
                      type="number"
                      value={selectedJoint.driveStiffness}
                      onChange={(e) =>
                        updateJoint(selectedJoint.id, { driveStiffness: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white/5 border border-[#333355] rounded px-1.5 py-1 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                      step={10}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-white/40 mb-1 block">Damping</label>
                    <input
                      type="number"
                      value={selectedJoint.driveDamping}
                      onChange={(e) =>
                        updateJoint(selectedJoint.id, { driveDamping: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white/5 border border-[#333355] rounded px-1.5 py-1 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                      step={10}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-white/40 mb-1 block">Max Force</label>
                    <input
                      type="number"
                      value={selectedJoint.driveMaxForce}
                      onChange={(e) =>
                        updateJoint(selectedJoint.id, { driveMaxForce: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white/5 border border-[#333355] rounded px-1.5 py-1 text-xs text-white/80 focus:outline-none focus:border-[#7c3aed]"
                      step={10}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Collision toggle */}
            <div className="pt-2 border-t border-[#333355]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedJoint.disableCollision}
                  onChange={(e) =>
                    updateJoint(selectedJoint.id, { disableCollision: e.target.checked })
                  }
                  className="rounded accent-[#7c3aed]"
                />
                <span className="text-[10px] text-white/60">
                  Disable collision between parent/child
                </span>
              </label>
            </div>

            {/* Motion preview */}
            {(selectedJoint.type === 'Revolute' || selectedJoint.type === 'Prismatic') && (
              <PhysicsMotionPreview joint={selectedJoint} />
            )}

            {/* Delete button */}
            <button
              onClick={() => handleDeleteJoint(selectedJoint.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10 transition-colors mt-2"
            >
              <Trash2 size={12} />
              Delete Joint
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-white/40">
              Select a joint to edit, or add a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
