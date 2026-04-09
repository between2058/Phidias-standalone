import { create } from 'zustand';
import { temporal } from 'zundo';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OriginalMaterial {
  baseColorFactor: [number, number, number, number] | null;
  baseColorTextureId: string | null;
  metallicFactor: number;
  roughnessFactor: number;
  normalTextureId: string | null;
}

export interface PhysicsPart {
  id: string;
  name: string;
  color: string;
  type: 'link' | 'base' | 'tool' | 'joint';
  role: 'other' | 'actuator' | 'support' | 'gripper' | 'sensor';
  mobility: 'fixed' | 'revolute' | 'prismatic';
  mass: number | null;
  density: number;
  collisionType: 'convexHull' | 'mesh' | 'convexDecomposition' | 'none';
  staticFriction: number;
  dynamicFriction: number;
  restitution: number;
  materialId: string | null;
  isMaterialCustom: boolean;
  originalMaterial: OriginalMaterial | null;
  vertexCount: number;
}

export interface PhysicsJoint {
  id: string;
  name: string;
  type: 'Revolute' | 'Prismatic' | 'Fixed' | 'Spherical' | '6-DOF';
  parentPartId: string;
  childPartId: string;
  axis: [number, number, number];
  anchor: [number, number, number];
  limitsEnabled: boolean;
  limitLower: number;
  limitUpper: number;
  driveStiffness: number;
  driveDamping: number;
  driveMaxForce: number;
  driveType: 'position' | 'velocity' | 'none';
  disableCollision: boolean;
}

export interface PhysicsMaterialPreset {
  id: string;
  name: string;
  density: number;
  staticFriction: number;
  dynamicFriction: number;
  restitution: number;
  color: string;
}

// ─── Material presets ───────────────────────────────────────────────────────

export const PHYSICS_MATERIAL_PRESETS: PhysicsMaterialPreset[] = [
  { id: 'steel',     name: 'Steel',     density: 7850,  staticFriction: 0.74, dynamicFriction: 0.57, restitution: 0.25, color: '#71797E' },
  { id: 'aluminum',  name: 'Aluminum',  density: 2700,  staticFriction: 0.61, dynamicFriction: 0.47, restitution: 0.30, color: '#A8A9AD' },
  { id: 'rubber',    name: 'Rubber',    density: 1100,  staticFriction: 1.00, dynamicFriction: 0.80, restitution: 0.80, color: '#2C2C2C' },
  { id: 'plastic',   name: 'Plastic',   density: 950,   staticFriction: 0.40, dynamicFriction: 0.30, restitution: 0.35, color: '#E8E8E8' },
  { id: 'wood',      name: 'Wood',      density: 600,   staticFriction: 0.50, dynamicFriction: 0.35, restitution: 0.40, color: '#966F33' },
  { id: 'concrete',  name: 'Concrete',  density: 2400,  staticFriction: 0.62, dynamicFriction: 0.55, restitution: 0.15, color: '#808080' },
  { id: 'glass',     name: 'Glass',     density: 2500,  staticFriction: 0.94, dynamicFriction: 0.40, restitution: 0.65, color: '#88CCEE' },
  { id: 'foam',      name: 'Foam',      density: 30,    staticFriction: 0.70, dynamicFriction: 0.50, restitution: 0.10, color: '#F5F0E1' },
  { id: 'ice',       name: 'Ice',       density: 917,   staticFriction: 0.10, dynamicFriction: 0.03, restitution: 0.30, color: '#D6ECEF' },
  { id: 'ceramic',   name: 'Ceramic',   density: 2300,  staticFriction: 0.60, dynamicFriction: 0.45, restitution: 0.20, color: '#F2E6D9' },
];

// ─── State shape ────────────────────────────────────────────────────────────

type PhysicsState = {
  // Tracked by Zundo (undo/redo)
  parts: PhysicsPart[];
  joints: PhysicsJoint[];

  // NOT tracked by Zundo
  materialPresets: PhysicsMaterialPreset[];
  selectedPartId: string | null;
  selectedJointId: string | null;
  jointPreviewValue: number | null;

  // Actions
  setParts: (parts: PhysicsPart[] | ((prev: PhysicsPart[]) => PhysicsPart[])) => void;
  setJoints: (joints: PhysicsJoint[] | ((prev: PhysicsJoint[]) => PhysicsJoint[])) => void;
  updatePart: (id: string, patch: Partial<PhysicsPart>) => void;
  updateJoint: (id: string, patch: Partial<PhysicsJoint>) => void;
  addJoint: (joint: PhysicsJoint) => void;
  removeJoint: (id: string) => void;
  applyMaterialPreset: (partId: string, presetId: string) => void;
  setSelectedPartId: (id: string | null) => void;
  setSelectedJointId: (id: string | null) => void;
  setJointPreviewValue: (value: number | null) => void;
  reset: () => void;
};

// ─── Store ──────────────────────────────────────────────────────────────────

/**
 * Zustand store with Zundo temporal middleware for the Physics tab.
 * ONLY `parts[]` and `joints[]` are snapshotted in history.
 * Material presets, UI selection state, and actions are excluded from history
 * via the partialize cast.
 * Limit: 50 undo snapshots.
 */
export const usePhysicsStore = create(
  temporal<PhysicsState>(
    (set) => ({
      // ── Tracked state ───────────────────────────────────────────────
      parts: [],
      joints: [],

      // ── Untracked state ─────────────────────────────────────────────
      materialPresets: PHYSICS_MATERIAL_PRESETS,
      selectedPartId: null,
      selectedJointId: null,
      jointPreviewValue: null,

      // ── Actions ─────────────────────────────────────────────────────

      setParts: (partsOrFn) =>
        set((s) => ({
          parts: typeof partsOrFn === 'function' ? partsOrFn(s.parts) : partsOrFn,
        })),

      setJoints: (jointsOrFn) =>
        set((s) => ({
          joints: typeof jointsOrFn === 'function' ? jointsOrFn(s.joints) : jointsOrFn,
        })),

      updatePart: (id, patch) =>
        set((s) => ({
          parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      updateJoint: (id, patch) =>
        set((s) => ({
          joints: s.joints.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        })),

      addJoint: (joint) =>
        set((s) => ({ joints: [...s.joints, joint] })),

      removeJoint: (id) =>
        set((s) => ({ joints: s.joints.filter((j) => j.id !== id) })),

      applyMaterialPreset: (partId, presetId) =>
        set((s) => {
          const preset = s.materialPresets.find((m) => m.id === presetId);
          if (!preset) return s;
          return {
            parts: s.parts.map((p) =>
              p.id === partId
                ? {
                    ...p,
                    density: preset.density,
                    staticFriction: preset.staticFriction,
                    dynamicFriction: preset.dynamicFriction,
                    restitution: preset.restitution,
                    materialId: preset.id,
                    isMaterialCustom: false,
                  }
                : p,
            ),
          };
        }),

      setSelectedPartId: (id) => set({ selectedPartId: id }),
      setSelectedJointId: (id) => set({ selectedJointId: id }),
      setJointPreviewValue: (value) => set({ jointPreviewValue: value }),

      reset: () =>
        set({
          parts: [],
          joints: [],
          selectedPartId: null,
          selectedJointId: null,
          jointPreviewValue: null,
        }),
    }),
    {
      // Cast required: Zundo forces partialize to return full TState.
      // In practice only the returned subset is used for diffing — safe.
      partialize: (state) =>
        ({ parts: state.parts, joints: state.joints }) as PhysicsState,
      limit: 50,
    },
  ),
);
