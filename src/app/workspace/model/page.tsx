'use client';

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  Suspense,
} from 'react';
import dynamic from 'next/dynamic';
import type * as THREE from 'three';
import ModelGeneratePanel from '@/components/model/ModelGeneratePanel';
import ExportDropdown from '@/components/shared/ExportDropdown';
import type {
  ProgressUpdate,
  GenerateModelRequest,
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
import {
  generateTrellis,
  generateReconMulti,
  generateReconBatch,
  generateText2Img,
  downloadPhidiasImage,
} from '@/lib/api/phidias';

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Download a GLB from the reconviagen proxy and return an object URL */
async function downloadGlb(glbUrl: string, requestId: string): Promise<string> {
  const fileName = glbUrl.split('/').pop() || 'model.glb';
  const blob = await downloadPhidiasImage(requestId, fileName, 'reconviagen');
  return URL.createObjectURL(blob);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ModelPage() {
  // ── Global asset state (React Context) ────────────────────────────────────
  const {
    assets,
    activeAssetId,
    addAsset,
    updateAsset,
    setActiveAssetId,
    setSceneGraph,
    updateAssetThumbnail,
  } = useWorkspace();
  const activeAsset = assets.find((a) => a.id === activeAssetId) ?? null;
  const modelUrl = activeAsset?.modelUrl ?? null;

  // ── Local page state ───────────────────────────────────────────────────────
  const sceneRef = useRef<THREE.Group | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [renderMode] = useState<RenderMode>('textured');
  const [transformMode] = useState<'translate' | 'rotate' | 'scale' | null>(
    null,
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [selectedTransform, setSelectedTransform] =
    useState<TransformValues | null>(null);
  const [sceneGraph, setLocalSceneGraph] = useState<HierarchyItem[]>([]);
  const [showGrid] = useState(true);

  /** URL of the Qwen-generated image shown as a preview thumbnail in the panel */
  const [text2ImgPreviewUrl, setText2ImgPreviewUrl] = useState<string | null>(
    null,
  );

  // ── Scene graph → context ──────────────────────────────────────────────────
  const handleObjectSelectForContext = useCallback((id: string | null) => {
    setSelectedObjectId(id);
    // Single click clears multi-selection and starts fresh
    if (id) {
      setSelectedObjectIds([id]);
    } else {
      setSelectedObjectIds([]);
    }
    if (!id) setSelectedTransform(null);
  }, []);

  const handleObjectMultiSelectForContext = useCallback((id: string) => {
    setSelectedObjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSelectedObjectId(id);
  }, []);

  const handleVisibilityToggleForContext = useCallback(
    (id: string, visible: boolean) => {
      setLocalSceneGraph((prev) => updateNodeVisibility(prev, id, visible));
      if (sceneRef.current) {
        const obj = findObjectInScene(sceneRef.current, id);
        if (obj) obj.visible = visible;
      }
    },
    [],
  );

  const handleTransformWriteForContext = useCallback(
    (t: TransformValues) => {
      setSelectedTransform(t);
      if (sceneRef.current && selectedObjectId) {
        const obj = findObjectInScene(sceneRef.current, selectedObjectId);
        if (obj) writeTransformValues(obj, t);
      }
    },
    [selectedObjectId],
  );

  useEffect(() => {
    setSceneGraph({
      items: sceneGraph,
      selectedId: selectedObjectId,
      selectedIds: selectedObjectIds,
      transform: selectedTransform,
      onSelect: handleObjectSelectForContext,
      onMultiSelect: handleObjectMultiSelectForContext,
      onVisibilityToggle: handleVisibilityToggleForContext,
      onTransformChange: handleTransformWriteForContext,
    });
  }, [
    sceneGraph,
    selectedObjectId,
    selectedObjectIds,
    selectedTransform,
    handleObjectSelectForContext,
    handleObjectMultiSelectForContext,
    handleVisibilityToggleForContext,
    handleTransformWriteForContext,
    setSceneGraph,
  ]);

  useEffect(() => () => setSceneGraph(null), [setSceneGraph]);

  // Reset viewport state when active asset changes
  useEffect(() => {
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
    setSelectedTransform(null);
    setLocalSceneGraph([]);
    sceneRef.current = null;
  }, [activeAssetId]);

  // ── Generate — all API orchestration lives here ────────────────────────────
  const handleGenerate = useCallback(
    async (params: GenerateModelRequest) => {
      setIsGenerating(true);
      setProgress({ percent: 0, stage: 'Starting...' });
      setText2ImgPreviewUrl(null);

      const advancedParams = {
        seed: params.seed,
        pipeline_type: params.pipelineType,
        texture_size: params.textureSize,
        decimation_target: params.decimationTarget,
        remesh: params.remesh,
        ss_guidance_strength: params.ss.guidance_strength,
        ss_sampling_steps: params.ss.sampling_steps,
        slat_guidance_strength: params.shapSlat.guidance_strength,
        slat_sampling_steps: params.shapSlat.sampling_steps,
      };

      try {
        if (params.inputMode === 'image') {
          const file = params.image!;
          const assetId = addAsset({
            name: file.name.replace(/\.[^.]+$/, '') || 'Generated Model',
            modelUrl: '',
            type: 'textured',
            status: 'generating',
            pipelineUsed: 'trellis',
          });
          setActiveAssetId(assetId);
          try {
            const result = await generateTrellis(file, advancedParams);
            const localUrl = await downloadGlb(
              result.glb_url,
              result.request_id,
            );
            updateAsset(assetId, { modelUrl: localUrl, status: 'ready' });
            setActiveAssetId(assetId);
          } catch (err) {
            console.error('Single generation failed:', err);
            updateAsset(assetId, {
              status: 'failed',
              errorMessage: String(err),
            });
          }
        } else if (params.inputMode === 'multiview') {
          const assetId = addAsset({
            name: 'Multi-view Model',
            modelUrl: '',
            type: 'textured',
            status: 'generating',
            pipelineUsed: 'trellis',
          });
          setActiveAssetId(assetId);
          try {
            const result = await generateReconMulti(params.images!, {
              ...advancedParams,
              multiimage_algo: params.multiViewMode!,
            });
            const localUrl = await downloadGlb(
              result.glb_url,
              result.request_id,
            );
            updateAsset(assetId, { modelUrl: localUrl, status: 'ready' });
            setActiveAssetId(assetId);
          } catch (err) {
            console.error('Multi-view generation failed:', err);
            updateAsset(assetId, {
              status: 'failed',
              errorMessage: String(err),
            });
          }
        } else if (params.inputMode === 'text') {
          const { qwen } = params;
          if (!qwen?.prompt) return;

          const assetId = addAsset({
            name: qwen.prompt.slice(0, 32) || 'Text Model',
            modelUrl: '',
            type: 'textured',
            status: 'generating',
            pipelineUsed: 'trellis',
          });
          setActiveAssetId(assetId);
          try {
            // Step 1: Qwen text → image
            const qwenResult = await generateText2Img(qwen.prompt, {
              negative_prompt: qwen.negativePrompt,
              aspect_ratio: qwen.aspectRatio,
              num_steps: qwen.numSteps,
              cfg_scale: qwen.cfgScale,
              seed: qwen.seed,
              num_samples: 1,
            });
            const imageUrl = qwenResult.urls[0];
            if (!imageUrl) throw new Error('No image returned from Qwen');

            // Show preview in the panel
            setText2ImgPreviewUrl(imageUrl);

            // Step 2: image → 3D
            const imgBlob = await fetch(imageUrl).then((r) => r.blob());
            const imgFile = new File([imgBlob], 'text2img-result.png', {
              type: imgBlob.type || 'image/png',
            });
            const result = await generateTrellis(imgFile, advancedParams);
            const localUrl = await downloadGlb(
              result.glb_url,
              result.request_id,
            );
            updateAsset(assetId, { modelUrl: localUrl, status: 'ready' });
            setActiveAssetId(assetId);
          } catch (err) {
            console.error('Text mode generation failed:', err);
            updateAsset(assetId, {
              status: 'failed',
              errorMessage: String(err),
            });
          }
        } else if (params.inputMode === 'batch') {
          const files = params.batchImages!;
          const assetIds = files.map((f) =>
            addAsset({
              name: f.name.replace(/\.[^.]+$/, '') || 'Batch Model',
              modelUrl: '',
              type: 'textured',
              status: 'generating',
              pipelineUsed: 'trellis',
            }),
          );
          try {
            const batchResult = await generateReconBatch(files, advancedParams);
            for (const item of batchResult.results) {
              const assetId = assetIds[item.index];
              if (!assetId) continue;
              if (item.status === 'success' && item.glb_url) {
                try {
                  const parts = item.glb_url.split('/');
                  const reqId = parts[2] || '';
                  const localUrl = await downloadGlb(item.glb_url, reqId);
                  updateAsset(assetId, { modelUrl: localUrl, status: 'ready' });
                } catch (dlErr) {
                  updateAsset(assetId, {
                    status: 'failed',
                    errorMessage: String(dlErr),
                  });
                }
              } else {
                updateAsset(assetId, {
                  status: 'failed',
                  errorMessage: item.error || 'Unknown error',
                });
              }
            }
            const firstOk = batchResult.results.find(
              (r) => r.status === 'success',
            );
            if (firstOk !== undefined)
              setActiveAssetId(assetIds[firstOk.index]);
          } catch (err) {
            console.error('Batch generation failed:', err);
            assetIds.forEach((id) =>
              updateAsset(id, { status: 'failed', errorMessage: String(err) }),
            );
          }
        }
      } catch (err) {
        console.error('Generation failed:', err);
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [addAsset, updateAsset, setActiveAssetId],
  );

  // ── Viewport callbacks ─────────────────────────────────────────────────────
  const handleSceneReady = useCallback((group: THREE.Group) => {
    sceneRef.current = group;
  }, []);
  const handleSceneGraphChange = useCallback(
    (nodes: HierarchyItem[]) => setLocalSceneGraph(nodes),
    [],
  );
  const handleObjectSelect = useCallback((id: string | null) => {
    setSelectedObjectId(id);
    if (id) setSelectedObjectIds([id]);
    else setSelectedObjectIds([]);
    if (!id) setSelectedTransform(null);
  }, []);
  const handleObjectMultiSelect = useCallback((id: string) => {
    setSelectedObjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSelectedObjectId(id);
  }, []);
  const handleTransformChange = useCallback(
    (t: TransformData) => setSelectedTransform(transformDataToValues(t)),
    [],
  );
  const handleThumbnailReady = useCallback(
    (dataUrl: string) => {
      if (activeAssetId) updateAssetThumbnail(activeAssetId, dataUrl);
    },
    [activeAssetId, updateAssetThumbnail],
  );
  const handleHasSkinnedMesh = useCallback(
    (value: boolean) => {
      if (activeAssetId) updateAsset(activeAssetId, { hasSkinnedMesh: value });
    },
    [activeAssetId, updateAsset],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: '#1a1a2e' }}
    >
      {/* Left panel */}
      <aside
        className="w-[300px] flex-shrink-0 overflow-hidden flex flex-col border-r"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        <ModelGeneratePanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          progress={progress}
          text2ImgPreviewUrl={text2ImgPreviewUrl}
        />
      </aside>

      {/* Viewport */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div className="flex-1 relative">
          {modelUrl || isGenerating ? (
            <Suspense fallback={null}>
              <ThreeViewport
                modelUrl={modelUrl ?? undefined}
                showGrid={showGrid}
                renderMode={renderMode}
                transformMode={transformMode}
                selectedObjectId={selectedObjectId}
                selectedObjectIds={selectedObjectIds}
                onObjectSelect={handleObjectSelect}
                onObjectMultiSelect={handleObjectMultiSelect}
                onTransformChange={handleTransformChange}
                onSceneReady={handleSceneReady}
                onSceneGraphChange={handleSceneGraphChange}
                showStats={!!modelUrl}
                isGenerating={isGenerating}
                onThumbnailReady={handleThumbnailReady}
                onHasSkinnedMesh={handleHasSkinnedMesh}
                className="w-full h-full"
              />
            </Suspense>
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{ background: '#1a1a2e' }}
            >
              <div className="text-6xl mb-4 opacity-20">🎭</div>
              <p className="text-[#64748b] text-sm">
                3D model will appear here
              </p>
              <p className="text-[#4b5563] text-xs mt-1">
                Generate a model using the panel on the left
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
          <ExportDropdown />
        </div>
      </main>
    </div>
  );
}
