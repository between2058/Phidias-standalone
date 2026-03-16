'use client';

import React, { useRef, useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import type * as THREE from 'three';
import TextureGeneratePanel from '@/components/texture/TextureGeneratePanel';
import HierarchyPanel from '@/components/shared/HierarchyPanel';
import TransformPanel from '@/components/shared/TransformPanel';
import ViewportToolbar from '@/components/shared/ViewportToolbar';
import { mockGenerateTexture, SAMPLE_GLB } from '@/lib/api/mock';
import type {
    ProgressUpdate,
    TextureRequest,
    TransformData,
} from '@/lib/api/types';
import type { RenderMode } from '@/components/shared/ThreeViewport';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';
import type { TransformValues } from '@/components/shared/TransformPanel';
import {
    findObjectInScene,
    writeTransformValues,
    transformDataToValues,
    updateNodeVisibility,
} from '@/lib/scene';

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

export default function TexturePage() {
    const sceneRef = useRef<THREE.Group | null>(null);
    const [modelUrl, setModelUrl] = useState(SAMPLE_GLB);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<ProgressUpdate | null>(null);
    const [renderMode] = useState<RenderMode>('textured');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedTransform, setSelectedTransform] =
        useState<TransformValues | null>(null);
    const [sceneGraph, setSceneGraph] = useState<HierarchyItem[]>([]);
    const [showGrid] = useState(true);

    // sourceImageUrl would be populated if user arrived from image-to-3D generation
    // (e.g., passed via router state or a shared context). For now it's undefined.
    const sourceImageUrl: string | undefined = undefined;

    const handleGenerate = useCallback(async (params: TextureRequest) => {
        setIsGenerating(true);
        setProgress({ percent: 0, stage: 'Starting...' });
        const result = await mockGenerateTexture(params, (update) =>
            setProgress(update),
        );
        setModelUrl(result.data.modelUrl);
        setIsGenerating(false);
        setProgress(null);
    }, []);

    const handleSceneReady = useCallback((group: THREE.Group) => {
        sceneRef.current = group;
    }, []);

    const handleSceneGraphChange = useCallback((nodes: HierarchyItem[]) => {
        setSceneGraph(nodes);
    }, []);

    const handleObjectSelect = useCallback((id: string | null) => {
        setSelectedId(id);
        if (!id) setSelectedTransform(null);
    }, []);

    const handleTransformChange = useCallback((t: TransformData) => {
        setSelectedTransform(transformDataToValues(t));
    }, []);

    const handleTransformWrite = useCallback(
        (t: TransformValues) => {
            setSelectedTransform(t);
            if (sceneRef.current && selectedId) {
                const obj = findObjectInScene(sceneRef.current, selectedId);
                if (obj) writeTransformValues(obj, t);
            }
        },
        [selectedId],
    );

    const handleVisibilityToggle = useCallback((id: string, visible: boolean) => {
        setSceneGraph((prev) => updateNodeVisibility(prev, id, visible));
        if (sceneRef.current) {
            const obj = findObjectInScene(sceneRef.current, id);
            if (obj) obj.visible = visible;
        }
    }, []);

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
                <TextureGeneratePanel
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    progress={progress}
                    hasActiveModel={!!modelUrl}
                    sourceImageUrl={sourceImageUrl}
                />
            </aside>

            {/* Center Viewport */}
            <main className="flex-1 relative overflow-hidden">
                <Suspense fallback={null}>
                    <ThreeViewport
                        modelUrl={modelUrl}
                        showGrid={showGrid}
                        renderMode={renderMode}
                        selectedObjectId={selectedId || undefined}
                        onObjectSelect={(id) => handleObjectSelect(id)}
                        onTransformChange={handleTransformChange}
                        onSceneReady={handleSceneReady}
                        onSceneGraphChange={handleSceneGraphChange}
                        showStats
                        className="w-full h-full"
                    />
                </Suspense>

                {/* Viewport Toolbar */}
                <div className="absolute right-4 top-4 z-10">
                    <ViewportToolbar gridVisible={showGrid} />
                </div>
            </main>

            {/* Right Panel */}
            <aside
                className="w-[280px] flex-shrink-0 overflow-hidden flex flex-col border-l"
                style={{ background: '#1e1e36', borderColor: '#333355' }}
            >
                <div className="px-3 py-2.5 border-b border-[#333355]">
                    <p className="text-xs font-semibold text-white">Scene Graph</p>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
                    <HierarchyPanel
                        items={sceneGraph}
                        selectedId={selectedId ?? undefined}
                        onSelect={(id) => handleObjectSelect(id)}
                        onVisibilityToggle={handleVisibilityToggle}
                    />
                </div>
                <div className="border-t border-[#333355]">
                    <TransformPanel
                        transform={selectedTransform ?? undefined}
                        onChange={handleTransformWrite}
                    />
                </div>
            </aside>
        </div>
    );
}
