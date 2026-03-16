'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import SceneBuilderPanel from '@/components/scene/SceneBuilderPanel';
import SceneProcessingOverlay from '@/components/scene/SceneProcessingOverlay';
import ExportDropdown from '@/components/shared/ExportDropdown';
import ViewportToolbar from '@/components/shared/ViewportToolbar';
// import { reconstructScene } from '@/lib/api/client';
import { mockGenerateScene, SAMPLE_PLY } from '@/lib/api/mock';
import type { ProgressUpdate } from '@/lib/api/types';

// SplatViewport — proper Gaussian Splatting renderer via @playcanvas/react
const SplatViewport = dynamic(
    () => import('@/components/shared/SplatViewport'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
                <div className="text-center">
                    <div
                        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                        style={{ borderColor: '#D5B451', borderTopColor: 'transparent' }}
                    />
                    <p className="text-[#64748b] text-xs">
                        Loading Gaussian Splat renderer…
                    </p>
                </div>
            </div>
        ),
    },
);

// ─── Processing stages ────────────────────────────────────────────────────────

const GENERATE_STAGES = [
    'Generating scene layout',
    'Placing Gaussians',
    'Optimizing splats',
    'Adding lighting',
    'Finalizing',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScenePage() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<ProgressUpdate | null>(null);
    const [processingStages, setProcessingStages] = useState<string[]>([]);
    const [activeSceneUrl, setActiveSceneUrl] = useState<string | null>(null);
    const [showGrid] = useState(true);
    const [enableFirstPerson, setEnableFirstPerson] = useState(false);

    const handleLoadScene = useCallback((url: string) => {
        setActiveSceneUrl(url);
    }, []);

    const buildOverlayStages = (stages: string[], currentPercent: number) =>
        stages.map((label, i) => {
            const stageIdx = Math.floor((currentPercent / 100) * stages.length);
            return { label, done: i < stageIdx, active: i === stageIdx };
        });

    //   const handleReconstruct = useCallback(async (file?: File, fps?: number) => {
    //     setIsProcessing(true);
    //     setProcessingStages(RECONSTRUCT_STAGES);
    //     setProgress({ percent: 0, stage: 'Starting…' });
    //     const result = await reconstructScene(
    //       { video: file, fps: fps ?? 1.0 },
    //       (u) => setProgress(u)
    //     );
    //     if (result.data.pointCloudUrl) handleLoadScene(result.data.pointCloudUrl);
    //     setIsProcessing(false);
    //     setProgress(null);
    //   }, [handleLoadScene]);
    const handleReconstruct = () => {
        console.log('not implemented!');
    };

    const handleGenerate = useCallback(async () => {
        setIsProcessing(true);
        setProcessingStages(GENERATE_STAGES);
        setProgress({ percent: 0, stage: 'Starting…' });
        await mockGenerateScene((u) => setProgress(u));
        handleLoadScene(SAMPLE_PLY);
        setIsProcessing(false);
        setProgress(null);
    }, [handleLoadScene]);

    const overlayStages =
        isProcessing && progress
            ? buildOverlayStages(processingStages, progress.percent)
            : [];

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
                <SceneBuilderPanel
                    activeSplatUrl={activeSceneUrl}
                    onLoadScene={handleLoadScene}
                    onReconstruct={handleReconstruct}
                    onGenerate={handleGenerate}
                    isProcessing={isProcessing}
                    progress={progress}
                    processingStage={progress?.stage ?? ''}
                />
            </aside>

            {/* Center Viewport */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 relative">
                    {activeSceneUrl ? (
                        <SplatViewport
                            key={activeSceneUrl}
                            url={activeSceneUrl}
                            className="w-full h-full"
                        />
                    ) : (
                        <div
                            className="w-full h-full flex flex-col items-center justify-center"
                            style={{ background: '#1a1a2e' }}
                        >
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold mb-4 mx-auto"
                                style={{
                                    background: 'linear-gradient(135deg, #7c3aed, #D5B451)',
                                    color: '#1a1a2e',
                                }}
                            >
                                ✦
                            </div>
                            <h3 className="text-white text-xl font-bold mb-2">
                                Scene Builder
                            </h3>
                            <p className="text-[#94a3b8] text-sm mb-1">
                                Load a scene from the library, capture from video, or generate
                                with AI
                            </p>
                            <p className="text-[#4b5563] text-xs">
                                Supports .ply · .glb · .spz formats
                            </p>
                        </div>
                    )}

                    {/* Processing overlay */}
                    {isProcessing && progress && (
                        <SceneProcessingOverlay
                            stages={overlayStages}
                            currentStage={progress.stage}
                        />
                    )}

                    {/* Viewport toolbar */}
                    <div className="absolute right-4 top-4 z-10">
                        <ViewportToolbar gridVisible={showGrid} />
                    </div>
                </div>

                {/* Bottom Toolbar */}
                <div
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-t overflow-x-auto"
                    style={{ background: 'rgba(13,13,24,0.95)', borderColor: '#333355' }}
                >
                    <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors"
                        title="Undo"
                    >
                        ↩
                    </button>
                    <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors"
                        title="Redo"
                    >
                        ↪
                    </button>

                    <div className="h-6 w-px bg-[#333355]" />

                    <button
                        onClick={() => setEnableFirstPerson((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${enableFirstPerson
                                ? 'bg-[#3b82f6] text-white'
                                : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]'
                            }`}
                    >
                        👁 First Person
                    </button>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1 text-xs text-[#94a3b8]">
                        <span>⚡</span>
                        <span className="text-[#D5B451] font-bold">55</span>
                    </div>

                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e] text-[#1a1a2e] text-xs font-bold hover:bg-[#16a34a] transition-colors">
                        Save
                    </button>
                    <ExportDropdown />
                </div>
            </main>
        </div>
    );
}
