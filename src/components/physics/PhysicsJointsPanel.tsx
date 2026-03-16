'use client';

import React from 'react';
import { Toggle } from '@/components/ui/ProgressBar';
import type { PhysicsJoint } from '@/app/workspace/_physics/page';

const JOINT_TYPES = ['Revolute', 'Prismatic', 'Fixed', 'Spherical', '6-DOF'];
const DRIVE_TYPES = ['position', 'velocity', 'none'];

const JOINT_ICONS: Record<string, string> = {
  Revolute: '🔄',
  Prismatic: '↔️',
  Fixed: '🔒',
  Spherical: '🌐',
  '6-DOF': '🎮',
};

interface PhysicsJointsPanelProps {
  joints: PhysicsJoint[];
  partNames: string[];
  onAddJoint: () => void;
  onUpdateJoint: (id: string, updates: Partial<PhysicsJoint>) => void;
  onDeleteJoint: (id: string) => void;
}

export default function PhysicsJointsPanel({
  joints,
  partNames,
  onAddJoint,
  onUpdateJoint,
  onDeleteJoint,
}: PhysicsJointsPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#333355] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white">Joints</p>
          <p className="text-[10px] text-[#64748b]">{joints.length} defined</p>
        </div>
        <button
          onClick={onAddJoint}
          className="px-2.5 py-1 rounded-lg bg-[#7c3aed] text-white text-xs font-medium hover:bg-[#6d28d9] transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Joints list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
        {joints.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-3xl mb-2">⚙️</p>
            <p className="text-xs text-[#64748b]">
              No joints defined yet.
              <br />
              Click + Add to create one.
            </p>
          </div>
        )}

        {joints.map((joint) => (
          <div
            key={joint.id}
            className="rounded-xl overflow-hidden"
            style={{ background: '#252542', border: '1px solid #333355' }}
          >
            {/* Joint header */}
            <button
              className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/5 transition-colors"
              onClick={() =>
                onUpdateJoint(joint.id, { expanded: !joint.expanded })
              }
            >
              <span className="text-sm flex-shrink-0">
                {JOINT_ICONS[joint.type] ?? '⚙️'}
              </span>
              <span className="flex-1 text-xs text-white font-medium truncate">
                {joint.name}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: '#7c3aed22', color: '#7c5cfc' }}
              >
                {joint.type}
              </span>
              <span className="text-[#64748b] text-xs">
                {joint.expanded ? '▲' : '▼'}
              </span>
            </button>

            {/* Expanded content */}
            {joint.expanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-[#333355]">
                {/* Name */}
                <div className="pt-2">
                  <p className="text-[10px] text-[#64748b] mb-1">Joint Name</p>
                  <input
                    type="text"
                    value={joint.name}
                    onChange={(e) =>
                      onUpdateJoint(joint.id, { name: e.target.value })
                    }
                    className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>

                {/* Type */}
                <div>
                  <p className="text-[10px] text-[#64748b] mb-1">Joint Type</p>
                  <select
                    value={joint.type}
                    onChange={(e) =>
                      onUpdateJoint(joint.id, { type: e.target.value })
                    }
                    className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                  >
                    {JOINT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {JOINT_ICONS[t]} {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parent/Child selectors connected to real parts */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-[#64748b] mb-1">Parent</p>
                    <select
                      value={joint.parentPart}
                      onChange={(e) =>
                        onUpdateJoint(joint.id, { parentPart: e.target.value })
                      }
                      className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    >
                      {partNames.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748b] mb-1">Child</p>
                    <select
                      value={joint.childPart}
                      onChange={(e) =>
                        onUpdateJoint(joint.id, { childPart: e.target.value })
                      }
                      className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    >
                      {partNames.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Axis */}
                <div>
                  <p className="text-[10px] text-[#64748b] mb-1">
                    Rotation Axis
                  </p>
                  <div className="flex gap-1">
                    {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                      <div key={axis} className="flex-1">
                        <input
                          type="number"
                          value={joint.axis[i]}
                          onChange={(e) => {
                            const newAxis: [number, number, number] = [
                              ...joint.axis,
                            ] as [number, number, number];
                            newAxis[i] = parseFloat(e.target.value) || 0;
                            onUpdateJoint(joint.id, { axis: newAxis });
                          }}
                          className="w-full bg-[#1e1e36] border border-[#333355] rounded px-1 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#7c3aed]"
                          step={0.1}
                        />
                        <p className="text-[9px] text-center text-[#64748b] mt-0.5">
                          {axis}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Limits */}
                <Toggle
                  label="Enable Limits"
                  checked={joint.limitsEnabled}
                  onChange={(v) =>
                    onUpdateJoint(joint.id, { limitsEnabled: v })
                  }
                />
                {joint.limitsEnabled && (
                  <div className="grid grid-cols-2 gap-2 ml-2">
                    <div>
                      <p className="text-[10px] text-[#64748b] mb-1">
                        Lower (°)
                      </p>
                      <input
                        type="number"
                        value={joint.limitLower}
                        onChange={(e) =>
                          onUpdateJoint(joint.id, {
                            limitLower: parseFloat(e.target.value),
                          })
                        }
                        className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748b] mb-1">
                        Upper (°)
                      </p>
                      <input
                        type="number"
                        value={joint.limitUpper}
                        onChange={(e) =>
                          onUpdateJoint(joint.id, {
                            limitUpper: parseFloat(e.target.value),
                          })
                        }
                        className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                      />
                    </div>
                  </div>
                )}

                {/* Drive section */}
                <div className="border-t border-[#333355] pt-2">
                  <p className="text-[10px] text-[#64748b] font-medium mb-2">
                    Drive (Actuator)
                  </p>
                  <div className="mb-2">
                    <p className="text-[10px] text-[#64748b] mb-1">
                      Control Mode
                    </p>
                    <select
                      value={joint.driveType}
                      onChange={(e) =>
                        onUpdateJoint(joint.id, { driveType: e.target.value })
                      }
                      className="w-full bg-[#1e1e36] border border-[#333355] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c3aed]"
                    >
                      {DRIVE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {joint.driveType !== 'none' && (
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        {
                          label: 'Stiffness',
                          key: 'driveStiffness',
                          value: joint.driveStiffness,
                        },
                        {
                          label: 'Damping',
                          key: 'driveDamping',
                          value: joint.driveDamping,
                        },
                        {
                          label: 'Max Force',
                          key: 'driveMaxForce',
                          value: joint.driveMaxForce,
                        },
                      ].map(({ label, key, value }) => (
                        <div key={key}>
                          <p className="text-[9px] text-[#64748b] mb-1">
                            {label}
                          </p>
                          <input
                            type="number"
                            value={value}
                            onChange={(e) =>
                              onUpdateJoint(joint.id, {
                                [key]: parseFloat(e.target.value) || 0,
                              } as Partial<PhysicsJoint>)
                            }
                            className="w-full bg-[#1e1e36] border border-[#333355] rounded px-1 py-1 text-xs text-white focus:outline-none"
                            step={10}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="border-t border-[#333355] pt-2 space-y-0">
                  <Toggle
                    label="Disable Collision"
                    checked={joint.disableCollision}
                    onChange={(v) =>
                      onUpdateJoint(joint.id, { disableCollision: v })
                    }
                  />
                  <Toggle
                    label="Visualize Joint"
                    checked={joint.visualize}
                    onChange={(v) => onUpdateJoint(joint.id, { visualize: v })}
                  />
                </div>

                {/* Delete */}
                <button
                  onClick={() => onDeleteJoint(joint.id)}
                  className="w-full py-1.5 rounded-lg text-xs text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10 transition-colors mt-1"
                >
                  Delete Joint
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
