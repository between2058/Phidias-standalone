'use client';

import React, { useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import RetopologyPanel from '@/components/retopo/RetopologyPanel';
import HierarchyPanel from '@/components/shared/HierarchyPanel';
import TransformPanel from '@/components/shared/TransformPanel';
import type { ProgressUpdate } from '@/lib/api/types';
import type { RenderMode } from '@/components/shared/ThreeViewport';

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

type ViewMode = 'Original' | 'Retopo' | 'Split' | 'Wireframe';

export default function RetopoPage() {
  const [isProcessing, _setIsProcessing] = useState(false);
  const [progress, _setProgress] = useState<ProgressUpdate | null>(null);
  const [retopoResult, _setRetopoResult] = useState<{
    modelUrl: string;
    newFaces: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Split');
  const [selectedId, setSelectedId] = useState<string | null>('');
  const [hierarchy] = useState([]);

  const handleRetopo = useCallback(
    async (_targetFaces: number, _topology: string) => {
      // API not yet implemented
    },
    [],
  );

  const renderModeForView = (): RenderMode => {
    if (viewMode === 'Wireframe') return 'wireframe';
    return 'solid';
  };

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
        <RetopologyPanel
          onRetopo={handleRetopo}
          isProcessing={isProcessing}
          progress={progress}
          originalFaces={1935274}
        />
      </aside>

      {/* Center Viewport */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* View mode toggle */}
        <div
          className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b"
          style={{ background: '#1e1e36', borderColor: '#333355' }}
        >
          {(['Original', 'Retopo', 'Split', 'Wireframe'] as ViewMode[]).map(
            (mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-colors',
                  viewMode === mode
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                )}
              >
                {mode}
              </button>
            ),
          )}
          {retopoResult && (
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-[#94a3b8]">
                Before: <span className="text-white font-mono">1,935,274</span>
              </span>
              <span className="text-[#94a3b8]">→</span>
              <span className="text-[#94a3b8]">
                After:{' '}
                <span className="text-[#22c55e] font-mono">
                  {retopoResult.newFaces.toLocaleString()}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Viewport */}
        <div className="flex-1 relative">
          {viewMode === 'Split' ? (
            <Suspense fallback={null}>
              <ThreeViewport
                modelUrl={''}
                showGrid
                splitView
                leftContent="original"
                rightContent={retopoResult ? 'retopo' : 'wireframe'}
                className="w-full h-full"
              />
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <ThreeViewport
                modelUrl={retopoResult?.modelUrl ?? ''}
                showGrid
                renderMode={renderModeForView()}
                selectedObjectId={selectedId || undefined}
                onObjectSelect={(id) => setSelectedId(id)}
                className="w-full h-full"
              />
            </Suspense>
          )}
        </div>
      </main>

      {/* Right Panel */}
      <aside
        className="w-[280px] flex-shrink-0 overflow-hidden flex flex-col border-l"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-[#333355]">
          <p className="text-xs font-semibold text-white">Scene Graph</p>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <HierarchyPanel
            items={hierarchy}
            selectedId={selectedId ?? undefined}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
        <div className="border-t border-[#333355]">
          <TransformPanel />
        </div>
      </aside>
    </div>
  );
}
