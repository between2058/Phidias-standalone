'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import AssetLibraryPanel from '@/components/world/AssetLibraryPanel';
import WorldHierarchyPanel from '@/components/world/WorldHierarchyPanel';
import ExportDropdown from '@/components/shared/ExportDropdown';
import type { AnnotationPin } from '@/lib/api/types';

// SplatViewport — proper Gaussian Splatting renderer via @playcanvas/react
const SplatViewport = dynamic(
  () => import('@/components/shared/SplatViewport'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#D5B451', borderTopColor: 'transparent' }}
        />
      </div>
    ),
  },
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlacedObject {
  id: string;
  name: string;
  assetId: string;
}

const ASSET_NAMES: Record<string, string> = {
  'car-parts': 'Car Parts',
  'benz-scan': 'Benz Scan',
  'scene-a': 'Scene A',
  'scene-b': 'Scene B',
  'metal-tex': 'Metal Texture',
  'wood-tex': 'Oak Wood',
};

// Background splat options for the world
const WORLD_SCENES = [
  { id: 'none', label: 'Empty World', splatUrl: null },
  {
    id: 'bedroom',
    label: 'Painted Bedroom',
    splatUrl: '/scenes/painted_bedroom.spz',
  },
  { id: 'garden', label: 'Garden', splatUrl: '/scenes/garden.spz' },
  { id: 'studio', label: 'Photo Studio', splatUrl: '/scenes/studio.spz' },
];

type ToolMode = 'select' | 'move' | 'rotate' | 'scale';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorldPage() {
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [enableFirstPerson, setEnableFirstPerson] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationPin[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [draggedSplatUrl, setDraggedSplatUrl] = useState<string | null>(null);
  const [showWorldScenePicker, setShowWorldScenePicker] = useState(false);
  const [activeWorldSceneId, setActiveWorldSceneId] = useState<string>('none');
  const [customSplatUrl, setCustomSplatUrl] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  // Active scene: custom dropped splat takes priority over picker selection
  const activeWorldScene = customSplatUrl
    ? { id: 'custom', label: 'Dropped Asset', splatUrl: customSplatUrl }
    : (WORLD_SCENES.find((s) => s.id === activeWorldSceneId) ??
      WORLD_SCENES[0]);

  const handleDragStart = useCallback((assetId: string, splatUrl?: string) => {
    setDraggedAssetId(assetId);
    setDraggedSplatUrl(splatUrl ?? null);
  }, []);

  const handleDrop = useCallback(() => {
    if (!draggedAssetId) return;

    // If the dragged asset is a Gaussian Splat, load it into the viewport
    if (draggedSplatUrl) {
      setCustomSplatUrl(draggedSplatUrl);
      setDraggedAssetId(null);
      setDraggedSplatUrl(null);
      setIsDragOver(false);
      return;
    }

    const newObj: PlacedObject = {
      id: `obj-${Date.now()}`,
      name: ASSET_NAMES[draggedAssetId] ?? draggedAssetId,
      assetId: draggedAssetId,
    };
    setPlacedObjects((prev) => [...prev, newObj]);
    setIsDragOver(false);
    setDraggedAssetId(null);
    setDraggedSplatUrl(null);
  }, [draggedAssetId, draggedSplatUrl]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleUpdateAnnotation = useCallback(
    (id: string, updates: Partial<AnnotationPin>) => {
      setAnnotations((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      );
    },
    [],
  );

  const handlePlayTour = useCallback(() => {
    if (annotations.length === 0) return;
    alert(`Starting tour with ${annotations.length} pins (demo)`);
  }, [annotations]);

  const totalFaces = placedObjects.length * 1_935_274;

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: '#1a1a2e' }}
    >
      {/* Left Panel */}
      <aside
        className="w-[300px] flex-shrink-0 overflow-hidden flex flex-col border-r"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        <AssetLibraryPanel onDragStart={handleDragStart} />
      </aside>

      {/* Center Viewport */}
      <main
        className="flex-1 relative overflow-hidden flex flex-col"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Stats HUD */}
        {placedObjects.length > 0 && (
          <div
            className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg text-xs font-mono"
            style={{
              background: 'rgba(13,13,24,0.9)',
              border: '1px solid #333355',
              color: '#94a3b8',
            }}
          >
            Objects: <span className="text-white">{placedObjects.length}</span>{' '}
            · Faces:{' '}
            <span className="text-[#D5B451]">
              {(totalFaces / 1000).toFixed(0)}K
            </span>{' '}
            · World: <span className="text-white">20m×20m</span>
          </div>
        )}

        {/* Background scene picker */}
        <div className="absolute top-3 right-3 z-10">
          <div className="relative">
            <button
              onClick={() => setShowWorldScenePicker((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                background: 'rgba(13,13,24,0.9)',
                border: '1px solid #333355',
                color: '#94a3b8',
              }}
            >
              🌍 {activeWorldScene.label}
              <span className="text-[10px] opacity-50">▾</span>
            </button>

            {showWorldScenePicker && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl z-20 py-1"
                style={{ background: '#1e1e36', border: '1px solid #333355' }}
              >
                {WORLD_SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => {
                      setActiveWorldSceneId(scene.id);
                      setCustomSplatUrl(null); // clear any drag-dropped splat
                      setShowWorldScenePicker(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs transition-colors',
                      !customSplatUrl && scene.id === activeWorldSceneId
                        ? 'text-[#D5B451] bg-[#D5B451]/10'
                        : 'text-[#94a3b8] hover:bg-[#252542] hover:text-white',
                    )}
                  >
                    {!customSplatUrl && scene.id === activeWorldSceneId && '● '}
                    {scene.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Splat Viewport */}
        <div className="flex-1 relative">
          {activeWorldScene.splatUrl ? (
            <SplatViewport
              key={activeWorldScene.splatUrl}
              url={activeWorldScene.splatUrl}
              className="w-full h-full"
            />
          ) : null}

          {/* Empty world state */}
          {placedObjects.length === 0 && activeWorldScene.id === 'none' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="pointer-events-auto text-center opacity-60">
                <div className="text-6xl mb-4">🌍</div>
                <p className="text-[#64748b] text-sm">
                  Drag assets from the library to build your world
                </p>
                <p className="text-[#4b5563] text-xs mt-1">
                  Or select a background scene above
                </p>
              </div>
            </div>
          )}

          {/* Drag drop overlay */}
          {isDragOver && (
            <div
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{
                background: 'rgba(124,58,237,0.2)',
                border: '3px dashed #7c3aed',
              }}
            >
              <div className="text-center">
                <div className="text-5xl mb-2">
                  {draggedSplatUrl ? '✦' : '⬇'}
                </div>
                <p
                  className={
                    draggedSplatUrl
                      ? 'text-[#D5B451] font-bold'
                      : 'text-[#7c3aed] font-bold'
                  }
                >
                  {draggedSplatUrl
                    ? 'Drop to load Gaussian Splat'
                    : 'Drop to place in world'}
                </p>
              </div>
            </div>
          )}

          {/* Annotation mode indicator */}
          {isAnnotating && (
            <div
              className="absolute top-14 right-3 z-10 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#f5a623', color: '#1a1a2e' }}
            >
              📌 Click to place annotation
            </div>
          )}

          {/* First person badge */}
          {enableFirstPerson && (
            <div
              className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: '#3b82f6', color: 'white' }}
            >
              👁 First Person Mode
            </div>
          )}
        </div>

        {/* Bottom Toolbar */}
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-t overflow-x-auto"
          style={{ background: 'rgba(13,13,24,0.95)', borderColor: '#333355' }}
        >
          {/* Tool mode buttons */}
          {(['select', 'move', 'rotate', 'scale'] as ToolMode[]).map((mode) => {
            const icons: Record<ToolMode, string> = {
              select: '↖',
              move: '✥',
              rotate: '↻',
              scale: '⊡',
            };
            return (
              <button
                key={mode}
                onClick={() => setToolMode(mode)}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors flex-shrink-0',
                  toolMode === mode
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                )}
              >
                {icons[mode]}
              </button>
            );
          })}

          <div className="h-6 w-px bg-[#333355] flex-shrink-0" />

          <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#252542] text-[#94a3b8] text-xs hover:bg-[#2a2a4a] transition-colors flex-shrink-0">
            📁 Group
          </button>
          <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#ef4444]/20 text-[#ef4444] text-xs hover:bg-[#ef4444]/30 transition-colors flex-shrink-0">
            🗑 Delete
          </button>

          {/* Snap */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0',
              snapToGrid
                ? 'bg-[#7c3aed] text-white'
                : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
            )}
            title="Snap to Grid"
          >
            🧲
          </button>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0',
              showGrid
                ? 'bg-[#0E243E] text-[#D5B451] border border-[#D5B451]/40'
                : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
            )}
          >
            ⊞ Grid
          </button>

          <div className="h-6 w-px bg-[#333355] flex-shrink-0" />

          {/* First Person */}
          <button
            onClick={() => setEnableFirstPerson(!enableFirstPerson)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0',
              enableFirstPerson
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
            )}
          >
            👁 FPS
          </button>

          {/* Annotate */}
          <button
            onClick={() => setIsAnnotating(!isAnnotating)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0',
              isAnnotating
                ? 'bg-[#f5a623] text-[#1a1a2e]'
                : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
            )}
          >
            📌 Annotate
          </button>

          {/* Reset camera */}
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252542] text-[#94a3b8] text-xs hover:bg-[#2a2a4a] transition-colors flex-shrink-0">
            ⌂ Reset
          </button>

          <div className="h-6 w-px bg-[#333355] flex-shrink-0" />
          <div className="flex-1" />

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e] text-[#1a1a2e] text-xs font-bold hover:bg-[#16a34a] transition-colors flex-shrink-0">
            Save
          </button>
          <ExportDropdown />
        </div>
      </main>

      {/* Right Panel */}
      <aside
        className="w-[280px] flex-shrink-0 overflow-hidden flex flex-col border-l"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        <WorldHierarchyPanel
          placedObjects={placedObjects}
          selectedId={selectedId}
          onSelectObject={setSelectedId}
          annotations={annotations}
          onDeleteAnnotation={handleDeleteAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          onPlayTour={handlePlayTour}
        />
      </aside>
    </div>
  );
}
