'use client';

import React, { useState, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import PhysicsPartsPanel from '@/components/physics/PhysicsPartsPanel';
import PhysicsMaterialsPanel from '@/components/physics/PhysicsMaterialsPanel';
import PhysicsPropertiesPanel from '@/components/physics/PhysicsPropertiesPanel';
import PhysicsJointsPanel from '@/components/physics/PhysicsJointsPanel';
import ExportDropdown from '@/components/shared/ExportDropdown';
import { mockPublishToPegaverse, SAMPLE_GLB } from '@/lib/api/mock';

const ThreeViewport = dynamic(
  () => import('@/components/shared/ThreeViewport'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#f5a623', borderTopColor: 'transparent' }}
        />
      </div>
    ),
  },
);

// ─── Physics Types ─────────────────────────────────────────────────────────────

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
  vertexCount: number;
}

export interface PhysicsJoint {
  id: string;
  name: string;
  type: string;
  parentPart: string;
  childPart: string;
  axis: [number, number, number];
  limitsEnabled: boolean;
  limitLower: number;
  limitUpper: number;
  driveStiffness: number;
  driveDamping: number;
  driveMaxForce: number;
  driveType: string;
  disableCollision: boolean;
  visualize: boolean;
  expanded: boolean;
}

// ─── Initial Data ──────────────────────────────────────────────────────────────

const PART_COLORS = [
  '#06b6d4',
  '#3b82f6',
  '#ef4444',
  '#f97316',
  '#ec4899',
  '#22c55e',
  '#a855f7',
];

const INITIAL_PARTS: PhysicsPart[] = [
  {
    id: 'body',
    name: 'Body',
    color: PART_COLORS[0],
    type: 'base',
    role: 'support',
    mobility: 'fixed',
    mass: null,
    density: 7800,
    collisionType: 'convexHull',
    staticFriction: 0.6,
    dynamicFriction: 0.4,
    restitution: 0.1,
    materialId: 'steel',
    isMaterialCustom: false,
    vertexCount: 142300,
  },
  {
    id: 'left-front',
    name: 'Left Front Leg',
    color: PART_COLORS[1],
    type: 'link',
    role: 'actuator',
    mobility: 'revolute',
    mass: null,
    density: 2700,
    collisionType: 'convexHull',
    staticFriction: 0.6,
    dynamicFriction: 0.4,
    restitution: 0.1,
    materialId: 'aluminum',
    isMaterialCustom: false,
    vertexCount: 38400,
  },
  {
    id: 'right-front',
    name: 'Right Front Leg',
    color: PART_COLORS[2],
    type: 'link',
    role: 'actuator',
    mobility: 'revolute',
    mass: null,
    density: 2700,
    collisionType: 'convexHull',
    staticFriction: 0.6,
    dynamicFriction: 0.4,
    restitution: 0.1,
    materialId: 'aluminum',
    isMaterialCustom: false,
    vertexCount: 38400,
  },
  {
    id: 'left-back',
    name: 'Left Back Leg',
    color: PART_COLORS[3],
    type: 'link',
    role: 'actuator',
    mobility: 'revolute',
    mass: null,
    density: 1050,
    collisionType: 'convexHull',
    staticFriction: 0.5,
    dynamicFriction: 0.35,
    restitution: 0.3,
    materialId: 'abs',
    isMaterialCustom: false,
    vertexCount: 35200,
  },
  {
    id: 'right-back',
    name: 'Right Back Leg',
    color: PART_COLORS[4],
    type: 'link',
    role: 'actuator',
    mobility: 'revolute',
    mass: null,
    density: 1050,
    collisionType: 'convexHull',
    staticFriction: 0.5,
    dynamicFriction: 0.35,
    restitution: 0.3,
    materialId: 'abs',
    isMaterialCustom: false,
    vertexCount: 35200,
  },
  {
    id: 'head',
    name: 'Head',
    color: PART_COLORS[5],
    type: 'link',
    role: 'sensor',
    mobility: 'revolute',
    mass: null,
    density: 4500,
    collisionType: 'convexHull',
    staticFriction: 0.5,
    dynamicFriction: 0.3,
    restitution: 0.1,
    materialId: 'titanium',
    isMaterialCustom: false,
    vertexCount: 52100,
  },
  {
    id: 'tail',
    name: 'Tail',
    color: PART_COLORS[6],
    type: 'tool',
    role: 'other',
    mobility: 'revolute',
    mass: null,
    density: 1300,
    collisionType: 'convexHull',
    staticFriction: 0.9,
    dynamicFriction: 0.7,
    restitution: 0.1,
    materialId: 'silicone',
    isMaterialCustom: false,
    vertexCount: 18600,
  },
];

const INITIAL_JOINTS: PhysicsJoint[] = [
  {
    id: 'j1',
    name: 'Shoulder Joint L',
    type: 'Revolute',
    parentPart: 'Body',
    childPart: 'Left Front Leg',
    axis: [1, 0, 0],
    limitsEnabled: true,
    limitLower: -90,
    limitUpper: 90,
    driveStiffness: 1000,
    driveDamping: 100,
    driveMaxForce: 1000,
    driveType: 'position',
    disableCollision: true,
    visualize: true,
    expanded: true,
  },
  {
    id: 'j2',
    name: 'Shoulder Joint R',
    type: 'Revolute',
    parentPart: 'Body',
    childPart: 'Right Front Leg',
    axis: [1, 0, 0],
    limitsEnabled: true,
    limitLower: -90,
    limitUpper: 90,
    driveStiffness: 1000,
    driveDamping: 100,
    driveMaxForce: 1000,
    driveType: 'position',
    disableCollision: true,
    visualize: false,
    expanded: false,
  },
];

type RightTab = 'materials' | 'properties' | 'joints';

// ─── Page Component ────────────────────────────────────────────────────────────

export default function PhysicsPage() {
  const [parts, setParts] = useState<PhysicsPart[]>(INITIAL_PARTS);
  const [joints, setJoints] = useState<PhysicsJoint[]>(INITIAL_JOINTS);
  const [selectedPartId, setSelectedPartId] = useState<string | null>('body');
  const [rightTab, setRightTab] = useState<RightTab>('materials');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Derive segment colors from parts
  const segmentColors = useMemo(() => {
    const map: Record<string, string> = {};
    parts.forEach((p) => {
      map[p.name] = p.color;
    });
    return map;
  }, [parts]);

  const selectedPart = useMemo(
    () => parts.find((p) => p.id === selectedPartId) ?? null,
    [parts, selectedPartId],
  );

  const partNames = useMemo(() => parts.map((p) => p.name), [parts]);

  // ── Part actions ────────────────────────────────────────────────────────────

  const updatePart = useCallback(
    (id: string, updates: Partial<PhysicsPart>) => {
      setParts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      );
    },
    [],
  );

  const applyMaterialToSelectedPart = useCallback(
    (
      partId: string,
      material: {
        id: string;
        staticFriction: number;
        dynamicFriction: number;
        restitution: number;
        density: number;
      },
    ) => {
      updatePart(partId, {
        staticFriction: material.staticFriction,
        dynamicFriction: material.dynamicFriction,
        restitution: material.restitution,
        density: material.density,
        mass: null,
        materialId: material.id,
        isMaterialCustom: false,
      });
    },
    [updatePart],
  );

  // ── Joint actions ────────────────────────────────────────────────────────────

  const updateJoint = useCallback(
    (id: string, updates: Partial<PhysicsJoint>) => {
      setJoints((prev) =>
        prev.map((j) => (j.id === id ? { ...j, ...updates } : j)),
      );
    },
    [],
  );

  const addJoint = useCallback(() => {
    const first = partNames[0] ?? 'Body';
    const second = partNames[1] ?? partNames[0] ?? 'Body';
    const newJoint: PhysicsJoint = {
      id: `j${Date.now()}`,
      name: `Joint ${joints.length + 1}`,
      type: 'Revolute',
      parentPart: first,
      childPart: second,
      axis: [0, 1, 0],
      limitsEnabled: false,
      limitLower: -180,
      limitUpper: 180,
      driveStiffness: 1000,
      driveDamping: 100,
      driveMaxForce: 1000,
      driveType: 'position',
      disableCollision: true,
      visualize: false,
      expanded: true,
    };
    setJoints((prev) => [...prev, newJoint]);
  }, [joints.length, partNames]);

  const deleteJoint = useCallback((id: string) => {
    setJoints((prev) => prev.filter((j) => j.id !== id));
  }, []);

  // ── Publish ─────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    const result = await mockPublishToPegaverse();
    setIsPublishing(false);
    setPublishSuccess(result.data.url);
    setTimeout(() => setPublishSuccess(null), 5000);
  }, []);

  return (
    <div
      className="flex h-full overflow-hidden relative"
      style={{ background: '#1a1a2e' }}
    >
      {/* Left Panel — Parts */}
      <aside
        className="w-[280px] flex-shrink-0 overflow-hidden flex flex-col border-r"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        <PhysicsPartsPanel
          parts={parts}
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
        />
      </aside>

      {/* Center Viewport */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Model info bar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b"
          style={{ background: '#1e1e36', borderColor: '#333355' }}
        >
          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
          <span className="text-xs text-white font-medium">Sky Car SAM3D</span>
          <span className="text-xs text-[#64748b]">
            {parts.length} parts · Articulation
          </span>
          <div className="flex-1" />
          {selectedPart && (
            <span className="text-xs text-[#94a3b8]">
              Selected:{' '}
              <span style={{ color: selectedPart.color }}>
                {selectedPart.name}
              </span>
            </span>
          )}
        </div>

        {/* Viewport */}
        <div className="flex-1 relative">
          <Suspense fallback={null}>
            <ThreeViewport
              modelUrl={SAMPLE_GLB}
              showGrid
              segmentColors={segmentColors}
              selectedObjectId={selectedPartId}
              onObjectSelect={setSelectedPartId}
              className="w-full h-full"
            />
          </Suspense>
        </div>

        {/* Bottom Toolbar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-t"
          style={{ background: 'rgba(13,13,24,0.95)', borderColor: '#333355' }}
        >
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e] text-[#1a1a2e] text-xs font-bold hover:bg-[#16a34a] transition-colors">
            Save
          </button>

          <div className="flex-1" />

          {publishSuccess && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: '#22c55e20',
                border: '1px solid #22c55e',
                color: '#22c55e',
              }}
            >
              ✓ Published! {publishSuccess}
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #f5a623, #ef4444)',
              color: '#1a1a2e',
            }}
          >
            {isPublishing ? (
              <>
                <div
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{
                    borderColor: '#1a1a2e',
                    borderTopColor: 'transparent',
                  }}
                />
                Publishing...
              </>
            ) : (
              '🚀 Publish to Pegaverse'
            )}
          </button>
          <ExportDropdown />
        </div>
      </main>

      {/* Right Panel */}
      <aside
        className="w-[300px] flex-shrink-0 overflow-hidden flex flex-col border-l"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        {/* Tabs */}
        <div className="flex border-b border-[#333355]">
          {(['materials', 'properties', 'joints'] as RightTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
                rightTab === tab
                  ? 'text-white border-b-2 border-[#7c3aed]'
                  : 'text-[#64748b] hover:text-[#94a3b8]',
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {rightTab === 'materials' && (
            <PhysicsMaterialsPanel
              selectedPart={selectedPart}
              onApplyMaterial={applyMaterialToSelectedPart}
            />
          )}
          {rightTab === 'properties' && (
            <PhysicsPropertiesPanel
              selectedPart={selectedPart}
              onUpdatePart={updatePart}
            />
          )}
          {rightTab === 'joints' && (
            <PhysicsJointsPanel
              joints={joints}
              partNames={partNames}
              onAddJoint={addJoint}
              onUpdateJoint={updateJoint}
              onDeleteJoint={deleteJoint}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
