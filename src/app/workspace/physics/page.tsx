'use client';

import React, { useState, useCallback, useEffect, useMemo, useReducer, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/lib/workspace-context';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsPart } from '@/store/physics-store';
import RenderModeSelector from '@/components/shared/RenderModeSelector';
import type { RenderMode } from '@/components/shared/ThreeViewport';
import PhysicsEditorPanel from '@/components/physics/PhysicsEditorPanel';
import JointVisualizer from '@/components/physics/JointVisualizer';
import AnchorGizmo from '@/components/physics/AnchorGizmo';
import MotionPreviewController from '@/components/physics/MotionPreviewController';

const ThreeViewport = dynamic(
  () => import('@/components/shared/ThreeViewport'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <div className="flex flex-col items-center">
          <div className="relative w-10 h-10">
            <div
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                border: '2px solid transparent',
                borderTopColor: '#D5B451',
                borderRightColor: 'rgba(213,180,81,0.3)',
              }}
            />
            <div
              className="absolute inset-1.5 rounded-full animate-spin"
              style={{
                border: '1.5px solid transparent',
                borderBottomColor: 'rgba(139,124,200,0.6)',
                animationDirection: 'reverse',
                animationDuration: '1.5s',
              }}
            />
          </div>
          <p className="text-[#64748b] text-[11px] mt-3 tracking-wide">
            Loading viewport
          </p>
        </div>
      </div>
    ),
  },
);

// ─── Types ──────────────────────────────────────────────────────────────────

export type EditorTab = 'parts' | 'materials' | 'joints';

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PhysicsPage() {
  const { assets, activeAssetId, updateAssetThumbnail, updateAsset, pendingPhysicsData, setPendingPhysicsData } =
    useWorkspace();
  const activeModelUrl =
    assets.find((a) => a.id === activeAssetId)?.modelUrl ?? null;

  // Store state
  const parts = usePhysicsStore((s) => s.parts);
  const setParts = usePhysicsStore((s) => s.setParts);
  const setJoints = usePhysicsStore((s) => s.setJoints);
  const selectedPartId = usePhysicsStore((s) => s.selectedPartId);
  const setSelectedPartId = usePhysicsStore((s) => s.setSelectedPartId);
  const setSelectedJointId = usePhysicsStore((s) => s.setSelectedJointId);

  // Render mode
  const [renderMode, setRenderMode] = useState<RenderMode>('textured');

  // Editor tab
  const [editorTab, setEditorTab] = useState<EditorTab>('parts');

  // Bottom panel collapsed state
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Grid and axes
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);

  // ── Undo / Redo state ─────────────────────────────────────────────────────
  // Zundo's temporal.subscribe pattern (same approach as segment page)
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let prevPast = usePhysicsStore.temporal.getState().pastStates.length;
    let prevFuture = usePhysicsStore.temporal.getState().futureStates.length;

    const unsub = usePhysicsStore.temporal.subscribe(() => {
      const { pastStates, futureStates } =
        usePhysicsStore.temporal.getState();
      const curPast = pastStates.length;
      const curFuture = futureStates.length;

      // Trigger re-render to keep undo/redo button disabled state in sync
      if (curPast !== prevPast || curFuture !== prevFuture) {
        rerender();
      }

      prevPast = curPast;
      prevFuture = curFuture;
    });
    return unsub;
  }, []);

  const canUndo =
    usePhysicsStore.temporal.getState().pastStates.length > 0;
  const canRedo =
    usePhysicsStore.temporal.getState().futureStates.length > 0;

  const handleUndo = useCallback(() => {
    if (usePhysicsStore.temporal.getState().pastStates.length > 0) {
      usePhysicsStore.temporal.getState().undo();
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (usePhysicsStore.temporal.getState().futureStates.length > 0) {
      usePhysicsStore.temporal.getState().redo();
    }
  }, []);

  // ── Keyboard shortcuts: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z ────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // ── Receive pending data from Segment → Physics bridge ───────────────────
  useEffect(() => {
    if (!pendingPhysicsData) return;

    function flattenLeafNodes(items: HierarchyItem[]): HierarchyItem[] {
      const leaves: HierarchyItem[] = [];
      function walk(nodes: HierarchyItem[]) {
        for (const n of nodes) {
          if (!n.children || n.children.length === 0) {
            leaves.push(n);
          } else {
            walk(n.children);
          }
        }
      }
      walk(items);
      return leaves;
    }

    const leafNodes = flattenLeafNodes(pendingPhysicsData.hierarchy);
    const newParts: PhysicsPart[] = leafNodes.map((item, i, arr) => ({
      id: item.id,
      name: item.name || `Part_${i}`,
      color: `hsl(${(i * 360) / arr.length}, 70%, 60%)`,
      type: 'link' as const,
      role: 'other' as const,
      mobility: 'fixed' as const,
      mass: null,
      density: 1000,
      collisionType: 'convexHull' as const,
      staticFriction: 0.5,
      dynamicFriction: 0.3,
      restitution: 0.3,
      materialId: null,
      isMaterialCustom: false,
      originalMaterial: null,
      vertexCount: 0,
    }));

    setParts(newParts);
    setJoints([]);
    usePhysicsStore.temporal.getState().clear();
    setPendingPhysicsData(null);
  }, [pendingPhysicsData, setParts, setJoints, setPendingPhysicsData]);

  // ── Segment colors for colored mesh display ───────────────────────────────
  const segmentColors = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const part of parts) {
      if (part.color) {
        // Part id is the mesh name in the scene
        colors[part.id] = part.color;
      }
    }
    return colors;
  }, [parts]);

  // ── Object select callback ────────────────────────────────────────────────
  const handleObjectSelect = useCallback(
    (id: string | null) => {
      setSelectedPartId(id);
      setSelectedJointId(null);
    },
    [setSelectedPartId, setSelectedJointId],
  );

  // ── Panel height ──────────────────────────────────────────────────────────
  const panelHeight = panelCollapsed ? 36 : 280;

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{ background: '#1a1a2e' }}
    >
      {/* ── Viewport area ──────────────────────────────────────────────────── */}
      <main
        className="flex-1 relative overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <Suspense fallback={null}>
          <ThreeViewport
            modelUrl={activeModelUrl ?? ''}
            renderMode={renderMode}
            segmentColors={
              Object.keys(segmentColors).length > 0
                ? segmentColors
                : undefined
            }
            selectedObjectId={selectedPartId}
            onObjectSelect={handleObjectSelect}
            showGrid={showGrid}
            showAxes={showAxes}
            onThumbnailReady={(dataUrl) => {
              if (activeAssetId) updateAssetThumbnail(activeAssetId, dataUrl);
            }}
            onHasSkinnedMesh={(v) => {
              if (activeAssetId)
                updateAsset(activeAssetId, { hasSkinnedMesh: v });
            }}
            className="w-full h-full"
          >
            <JointVisualizer />
            <AnchorGizmo />
            <MotionPreviewController />
          </ThreeViewport>
        </Suspense>

        {/* Render mode selector */}
        <RenderModeSelector
          availableModes={['textured', 'solid', 'wireframe', 'normal']}
          current={renderMode}
          onChange={setRenderMode}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"
        />

        {/* Floating undo/redo toolbar */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full z-10"
          style={{
            background: 'rgba(13,13,24,0.95)',
            border: '1px solid #333355',
          }}
        >
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
              canUndo
                ? 'text-[#94a3b8] hover:text-white hover:bg-[#252542]'
                : 'text-[#3d3d5c] cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            ↩
          </button>
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
              canRedo
                ? 'text-[#94a3b8] hover:text-white hover:bg-[#252542]'
                : 'text-[#3d3d5c] cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Shift+Z)"
            onClick={handleRedo}
            disabled={!canRedo}
          >
            ↪
          </button>
        </div>
      </main>

      {/* ── Bottom editor panel ────────────────────────────────────────────── */}
      <PhysicsEditorPanel
        activeTab={editorTab}
        onTabChange={setEditorTab}
        collapsed={panelCollapsed}
        onToggleCollapse={() => setPanelCollapsed((c) => !c)}
        height={panelHeight}
      />
    </div>
  );
}
