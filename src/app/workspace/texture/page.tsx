'use client';

import React, { useRef, useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import type * as THREE from 'three';
import TextureGeneratePanel from '@/components/texture/TextureGeneratePanel';
import HierarchyPanel from '@/components/shared/HierarchyPanel';
import TransformPanel from '@/components/shared/TransformPanel';
import ViewportToolbar from '@/components/shared/ViewportToolbar';
import { textureTrellis, downloadPhidiasImage, editImage } from '@/lib/api/phidias';
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
import { useWorkspace } from '@/lib/workspace-context';

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

/** Download a GLB from the trellis2 proxy and return an object URL */
async function downloadGlbTrellis(glbUrl: string, requestId: string): Promise<string> {
    const fileName = glbUrl.split('/').pop() || 'model.glb';
    const blob = await downloadPhidiasImage(requestId, fileName, 'trellis2');
    return URL.createObjectURL(blob);
}

export default function TexturePage() {
    const sceneRef = useRef<THREE.Group | null>(null);
    const { assets, activeAssetId, updateAsset } = useWorkspace();
    const activeAsset = assets.find(a => a.id === activeAssetId) ?? null;
    const modelUrl = activeAsset?.modelUrl || '';

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<ProgressUpdate | null>(null);
    const [renderMode] = useState<RenderMode>('textured');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedTransform, setSelectedTransform] =
        useState<TransformValues | null>(null);
    const [sceneGraph, setSceneGraph] = useState<HierarchyItem[]>([]);
    const [showGrid] = useState(true);

    const sourceImageUrl: string | undefined = undefined;

    const handleGenerate = useCallback(async (params: TextureRequest) => {
        if (!activeAsset?.modelUrl) return;
        setIsGenerating(true);
        setProgress({ percent: 0, stage: 'Preparing...' });

        try {
            let referenceImage: File | Blob;

            if (params.mode === 'text' && params.prompt) {
                // Text mode: Qwen generates reference image first
                setProgress({ percent: 10, stage: 'Generating reference image...' });
                const meshBlob = await fetch(activeAsset.modelUrl).then(r => r.blob());
                const qwenResult = await editImage(meshBlob, params.prompt, {
                    steps: params.qwenSteps ?? 40,
                    cfg_scale: params.cfgScale ?? 4.0,
                });
                const imageUrl = qwenResult.urls[0];
                if (!imageUrl) throw new Error('No image returned from Qwen');
                referenceImage = await fetch(imageUrl).then(r => r.blob());
            } else if (params.mode === 'image' && params.referenceImage) {
                referenceImage = params.referenceImage;
            } else {
                throw new Error('No reference image provided');
            }

            // Fetch current model as GLB blob
            setProgress({ percent: 30, stage: 'Texturing mesh...' });
            const meshBlob = await fetch(activeAsset.modelUrl).then(r => r.blob());

            // Call Trellis.2 texture API
            const result = await textureTrellis(referenceImage, meshBlob, {
                seed: params.randomizeSeed ? undefined : params.seed,
                resolution: parseInt(params.resolution),
                texture_size: params.textureSize,
            });

            // Download textured GLB
            setProgress({ percent: 80, stage: 'Downloading result...' });
            const localUrl = await downloadGlbTrellis(result.glb_url, result.request_id);

            // Update asset with textured model
            updateAsset(activeAsset.id, { modelUrl: localUrl });
            setProgress({ percent: 100, stage: 'Done!' });
        } catch (err) {
            console.error('[TexturePage] Texturing failed:', err);
            setProgress({
                percent: 0,
                stage: `Error: ${err instanceof Error ? err.message : 'Texturing failed'}`,
            });
        } finally {
            setTimeout(() => {
                setIsGenerating(false);
                setProgress(null);
            }, 1000);
        }
    }, [activeAsset, updateAsset]);

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
