'use client';

import React, { useRef, useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import TextureGeneratePanel from '@/components/texture/TextureGeneratePanel';
import ExportDropdown from '@/components/shared/ExportDropdown';
import { textureTrellis, downloadPhidiasImage, editImageLegacy } from '@/lib/api/phidias';
import type { ProgressUpdate, TextureRequest } from '@/lib/api/types';
import type { RenderMode } from '@/components/shared/ThreeViewport';
import RenderModeSelector from '@/components/shared/RenderModeSelector';
import { useWorkspace } from '@/lib/workspace-context';

const ThreeViewport = dynamic(
    () => import('@/components/shared/ThreeViewport'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
                <div className="text-center">
                    <div
                        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                        style={{ borderColor: '#f5a623', borderTopColor: 'transparent' }}
                    />
                    <p className="text-[#64748b] text-xs">Loading viewport...</p>
                </div>
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

/** Capture a screenshot of the current viewport as a Blob */
function captureViewportScreenshot(group: THREE.Group): Promise<Blob> {
    const w = 1024, h = 1024;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x1a1a2e, 1);

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 1.8;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, maxDim * 100);
    const az = (30 * Math.PI) / 180;
    const el = (20 * Math.PI) / 180;
    camera.position.set(
        center.x + dist * Math.cos(el) * Math.sin(az),
        center.y + dist * Math.sin(el),
        center.z + dist * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(center);

    const tempScene = new THREE.Scene();
    tempScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(1, 2, 1);
    tempScene.add(dir);

    const savedParent = group.parent;
    tempScene.add(group);
    renderer.render(tempScene, camera);

    return new Promise<Blob>((resolve, reject) => {
        renderer.domElement.toBlob(
            (blob) => {
                tempScene.remove(group);
                if (savedParent) savedParent.add(group);
                renderer.dispose();
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Screenshot capture failed'));
                }
            },
            'image/png',
        );
    });
}

export default function TexturePage() {
    const sceneRef = useRef<THREE.Group | null>(null);
    const { assets, activeAssetId, updateAsset } = useWorkspace();
    const activeAsset = assets.find(a => a.id === activeAssetId) ?? null;
    const modelUrl = activeAsset?.modelUrl || '';

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<ProgressUpdate | null>(null);
    const [renderMode, setRenderMode] = useState<RenderMode>('textured');
    const [showGrid] = useState(true);
    const [text2ImgPreviewUrl, setText2ImgPreviewUrl] = useState<string | null>(null);

    const handleGenerate = useCallback(async (params: TextureRequest) => {
        if (!activeAsset?.modelUrl) return;
        setIsGenerating(true);
        setProgress({ percent: 0, stage: 'Preparing...' });
        setText2ImgPreviewUrl(null);

        try {
            let referenceImage: File | Blob;

            if (params.mode === 'text' && params.prompt) {
                // Text mode: capture viewport screenshot → Qwen edit → reference image
                if (!sceneRef.current) throw new Error('No 3D scene loaded');

                setProgress({ percent: 5, stage: 'Capturing viewport...' });
                const screenshotBlob = await captureViewportScreenshot(sceneRef.current);

                setProgress({ percent: 15, stage: 'Generating styled reference...' });
                const qwenResult = await editImageLegacy(screenshotBlob, params.prompt, {
                    steps: params.qwenSteps ?? 40,
                    cfg_scale: params.cfgScale ?? 4.0,
                });
                const imageUrl = qwenResult.urls?.[0];
                if (!imageUrl) throw new Error('No image returned from Qwen');

                setText2ImgPreviewUrl(imageUrl);
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
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[TexturePage] Texturing failed:', err);
            setProgress({
                percent: 0,
                stage: `Error: ${msg}`,
            });
            // Longer window so the user actually notices the failure instead
            // of seeing the panel silently revert mid-glance.
        } finally {
            setTimeout(() => {
                setIsGenerating(false);
                setProgress(null);
            }, 5000);
        }
    }, [activeAsset, updateAsset]);

    const handleSceneReady = useCallback((group: THREE.Group) => {
        sceneRef.current = group;
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
                    text2ImgPreviewUrl={text2ImgPreviewUrl}
                />
            </aside>

            {/* Viewport */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 relative">
                    <RenderModeSelector
                        availableModes={['textured', 'solid', 'wireframe', 'normal']}
                        current={renderMode}
                        onChange={setRenderMode}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"
                    />
                    {modelUrl || isGenerating ? (
                        <Suspense fallback={null}>
                            <ThreeViewport
                                modelUrl={modelUrl}
                                showGrid={showGrid}
                                renderMode={renderMode}
                                onSceneReady={handleSceneReady}
                                showStats={!!modelUrl}
                                isGenerating={isGenerating}
                                className="w-full h-full"
                            />
                        </Suspense>
                    ) : (
                        <div
                            className="w-full h-full flex flex-col items-center justify-center"
                            style={{ background: '#1a1a2e' }}
                        >
                            <div className="text-6xl mb-4 opacity-20">🎨</div>
                            <p className="text-[#64748b] text-sm">
                                3D model will appear here
                            </p>
                            <p className="text-[#4b5563] text-xs mt-1">
                                Load a model from the assets panel, then apply textures
                            </p>
                        </div>
                    )}
                </div>

                {/* Bottom toolbar */}
                <div
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full z-10"
                    style={{
                        background: 'rgba(13,13,24,0.95)',
                        border: '1px solid #333355',
                    }}
                >
                    <ExportDropdown sceneRef={sceneRef} />
                </div>
            </main>
        </div>
    );
}
