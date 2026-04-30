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
  updateNodeName,
} from '@/lib/scene';
import { useWorkspace } from '@/lib/workspace-context';
import {
  generateReconSingle,
  generateReconMulti,
  generateReconBatch,
  generateText2Img,
  JobSubmitResponse,
} from '@/lib/api/phidias';
import { usePhidiasStore } from '@/store/phidias-store';
import {
  useConnectionAvailability,
  useConnectionCount,
} from '@/hooks/useJobManager';
// Asset type imported for future use


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
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ModelPage() {
  // ── Global asset state (React Context) ────────────────────────────────────
  const {
    assets,
    activeAssetId,
    updateAsset,
    setSceneGraph,
    updateAssetThumbnail,
    addAsset,
    setActiveAssetId,
  } = useWorkspace();
  const activeAsset = assets.find((a) => a.id === activeAssetId) ?? null;
  const modelUrl = activeAsset?.modelUrl ?? null;

  // ── Job store for async pattern ────────────────────────────────────────────
  const addJob = usePhidiasStore((s) => s.addJob);
  const updateJob = usePhidiasStore((s) => s.updateJob);
  const incrementConnection = usePhidiasStore((s) => s.incrementConnection);
  const isReconAvailable = useConnectionAvailability('reconviagen');
  const isQwenAvailable = useConnectionAvailability('qwen');
  const reconConnectionCount = useConnectionCount('reconviagen');
  const reconRemainingSlots = Math.max(0, 2 - reconConnectionCount);
  const jobs = usePhidiasStore((s) => s.jobs);
  const apiBaseUrl = usePhidiasStore((s) => s.apiBaseUrl);
  const processedReconviagenJobIds = usePhidiasStore((s) => s.processedReconviagenJobIds);
  const markReconviagenJobProcessed = usePhidiasStore((s) => s.markReconviagenJobProcessed);

  // Ref to track processed job IDs without re-renders (sync with store)
  const processedReconviagenJobIdsRef = useRef<Set<string>>(processedReconviagenJobIds);
  useEffect(() => {
    processedReconviagenJobIdsRef.current = processedReconviagenJobIds;
  }, [processedReconviagenJobIds]);

  // Ref to track processed text-mode qwen jobs (auto-download + auto-generate-3d)
  const processedTextModeQwenJobIdsRef = useRef<Set<string>>(new Set());

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

  const handleObjectRenameForContext = useCallback((id: string, name: string) => {
    console.log('[ModelPage] handleObjectRenameForContext - id:', id, 'name:', name);
    // Update the local scene graph (for UI display)
    setLocalSceneGraph((prev) => updateNodeName(prev, id, name));
    // Also rename the Three.js object
    if (sceneRef.current) {
      const obj = findObjectInScene(sceneRef.current, id);
      if (obj) {
        console.log('[ModelPage] Renaming Three.js object:', obj.name, 'to', name);
        obj.name = name;
      }
    }
  }, []);

  // Sync scene graph to shared panels (setSceneGraph only - segmentHierarchy is for segment tab)
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
      onRename: handleObjectRenameForContext,
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
    handleObjectRenameForContext,
    setSceneGraph,
  ]);

  // Model page should NOT set segmentHierarchy - that's for segment tab only
  // segmentHierarchy persists across tab switches, so only segment/page.tsx should modify it

  useEffect(() => () => {
    setSceneGraph(null);
    // Note: We intentionally do NOT clear segmentHierarchy here - it should persist
    // so the ScenePanel shows correct data when switching back to segment tab
  }, [setSceneGraph]);

  // Reset viewport state when active asset changes
  useEffect(() => {
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
    setSelectedTransform(null);
    setLocalSceneGraph([]);
    sceneRef.current = null;
  }, [activeAssetId]);

  // ── Auto-download completed reconviagen jobs ─────────────────────────────────
  // Downloads GLB when reconviagen job completes, displays in current viewport
  useEffect(() => {
    const completed = jobs.filter(
      (j) =>
        j.service === 'reconviagen' &&
        j.status === 'completed' &&
        j.result &&
        !processedReconviagenJobIdsRef.current.has(j.jobId),
    );

    if (completed.length === 0) return;

    async function downloadCompletedJobs() {
      for (const job of completed) {
        processedReconviagenJobIdsRef.current.add(job.jobId);
        markReconviagenJobProcessed(job.jobId);

        const result = job.result as Record<string, unknown>;
        const glbFile = result.glb_file as string | undefined;
        if (!glbFile) {
          console.warn('[ModelPage] No GLB file in completed job:', job.jobId);
          continue;
        }

        const fileName = glbFile.split('/').pop() || 'model.glb';
        const meta = job.metadata;
        const assetName =
          (meta?.name as string) ||
          (meta?.fileName as string | undefined)?.replace(/\.[^.]+$/, '') ||
          fileName.replace('.glb', '');

        try {
          // Build download URL: {apiBaseUrl}/phidias/reconviagen/download/{jobId}/{fileName}
          const baseUrl = apiBaseUrl ?? '';
          const downloadUrl = `${baseUrl}/phidias/reconviagen/download/${job.jobId}/${fileName}`;

          const { client } = await import('@/lib/api/client');
          const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 120000 });
          const blobUrl = URL.createObjectURL(blob);

          // Create new asset in workspace
          const assetId = addAsset({
            name: assetName,
            modelUrl: blobUrl,
            type: 'textured',
            status: 'ready',
            pipelineUsed: 'trellis',
            fileSize: blob.size,
            jobId: job.jobId, // Store jobId so NavActions can find this asset later
          });

          // Set as active asset to display in viewport
          setActiveAssetId(assetId);
          console.log('[ModelPage] Auto-downloaded model:', assetName);
        } catch (err) {
          console.error('[ModelPage] Failed to auto-download model:', err);
        }
      }
    }

    downloadCompletedJobs().catch((err) => {
      console.error('[ModelPage] Auto-download error:', err);
    });
  }, [jobs, apiBaseUrl, addAsset, setActiveAssetId, markReconviagenJobProcessed]);

  // ── Auto-download completed text-mode qwen jobs and trigger generate-single ──
  // When qwen text→image job completes in text mode, auto-download the generated image
  // and trigger reconviagen to generate 3D model
  useEffect(() => {
    const textModeQwenJobs = jobs.filter(
      (j) =>
        j.service === 'qwen' &&
        j.type === 'text2img' &&
        j.status === 'completed' &&
        (j.metadata as Record<string, unknown>)?.source === 'text-mode' &&
        !processedTextModeQwenJobIdsRef.current.has(j.jobId),
    );

    if (textModeQwenJobs.length === 0) return;

    async function processCompletedTextModeQwenJobs() {
      for (const job of textModeQwenJobs) {
        processedTextModeQwenJobIdsRef.current.add(job.jobId);

        const result = job.result as Record<string, unknown>;
        const relativeUrls: string[] = [];
        const rawUrls = (result.urls as string[] | undefined) ?? [];
        const rawResultUrls = (result.result_urls as string[] | undefined) ?? [];
        const results = result.results as Record<string, string> | undefined;

        relativeUrls.push(...rawUrls, ...rawResultUrls);
        if (results) {
          ['right', 'back', 'left'].forEach((k) => {
            if (results[k]) relativeUrls.push(results[k]);
          });
        }

        if (relativeUrls.length === 0) {
          console.warn('[ModelPage] No image URLs in completed qwen job:', job.jobId);
          continue;
        }

        try {
          // Download the first generated image
          const fileName = relativeUrls[0].split('/').pop() || 'generated.png';
          const baseUrl = apiBaseUrl ?? '';
          const downloadUrl = `${baseUrl}/phidias/qwen/download/${job.jobId}/${fileName}`;

          const { client } = await import('@/lib/api/client');
          const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 60000 });
          const blobUrl = URL.createObjectURL(blob);

          // Show preview in text mode panel
          setText2ImgPreviewUrl(blobUrl);

          // Auto-trigger generate-single with the downloaded image
          console.log('[ModelPage] Auto-triggering generate-single for text-mode qwen job:', job.jobId);
          const generateResult = await generateReconSingle(blob, {
            seed: 0, // default seed
            texture_size: 1024,
            ss_guidance_strength: 7.5,
            ss_sampling_steps: 30,
            slat_guidance_strength: 3.0,
            slat_sampling_steps: 30,
          });

          addJob({
            jobId: generateResult.job_id,
            service: 'reconviagen',
            status: generateResult.status,
            type: 'generate-single',
            queuePosition: generateResult.queue_position,
            metadata: {
              name: 'Text-to-3D Model',
              source: 'text-mode-auto',
              parentQwenJobId: job.jobId,
            },
          });

          incrementConnection('reconviagen');

          // Update the qwen job metadata to mark it as processed, so it won't be re-triggered
          // even if the component remounts (e.g., user switches tabs and comes back)
          updateJob(job.jobId, {
            metadata: { ...job.metadata, source: 'text-mode-processed' } as Record<string, unknown>,
          });

          console.log('[ModelPage] Auto-generated 3D from text-mode qwen job:', generateResult.job_id);
        } catch (err) {
          console.error('[ModelPage] Failed to process text-mode qwen job:', err);
        }
      }
    }

    processCompletedTextModeQwenJobs().catch((err) => {
      console.error('[ModelPage] Text-mode qwen auto-process error:', err);
    });
  }, [jobs, apiBaseUrl, addJob, updateJob, incrementConnection]);

  // ── Generate — async job submission ──────────────────────────────────────────
  const handleGenerate = useCallback(
    async (params: GenerateModelRequest) => {
      setIsGenerating(true);
      setProgress({ percent: 0, stage: 'Generating...' });
      setText2ImgPreviewUrl(null);

      const advancedParams = {
        seed: params.seed,
        texture_size: params.textureSize,
        ss_guidance_strength: params.ss.guidance_strength,
        ss_sampling_steps: params.ss.sampling_steps,
        slat_guidance_strength: params.shapSlat.guidance_strength,
        slat_sampling_steps: params.shapSlat.sampling_steps,
      };

      try {
        if (params.inputMode === 'image') {
          const file = params.image!;

          // Convert to data URL for NavActions job card thumbnail
          const referenceImageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Submit async job — no placeholder asset; asset is created via NavActions "View 3D"
          const result: JobSubmitResponse = await generateReconSingle(file, advancedParams);

          addJob({
            jobId: result.job_id,
            service: 'reconviagen',
            status: result.status,
            type: 'generate-single',
            queuePosition: result.queue_position,
            metadata: {
              name: file.name.replace(/\.[^.]+$/, '') || 'Generated Model',
              fileName: file.name,
              referenceImageDataUrl,
            },
          });

          incrementConnection('reconviagen');
        } else if (params.inputMode === 'multiview') {
          // Convert first image to data URL for NavActions thumbnail
          const firstFile = params.images?.[0];
          let referenceImageDataUrl: string | undefined;
          if (firstFile) {
            referenceImageDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(firstFile);
            });
          }

          const result: JobSubmitResponse = await generateReconMulti(params.images!, {
            ...advancedParams,
            multiimage_algo: params.multiViewMode!,
          });

          addJob({
            jobId: result.job_id,
            service: 'reconviagen',
            status: result.status,
            type: 'generate-multi',
            queuePosition: result.queue_position,
            metadata: { name: 'Multi-view Model', referenceImageDataUrl },
          });

          incrementConnection('reconviagen');
        } else if (params.inputMode === 'text') {
          const { qwen } = params;
          if (!qwen?.prompt) return;

          if (!isQwenAvailable) return;

          // Submit Qwen text → image job only (reconviagen triggered separately via View 3D)
          const qwenResult: JobSubmitResponse = await generateText2Img(qwen.prompt, {
            negative_prompt: qwen.negativePrompt,
            aspect_ratio: qwen.aspectRatio,
            num_steps: qwen.numSteps,
            cfg_scale: qwen.cfgScale,
            seed: qwen.seed,
            num_samples: 1,
          });

          addJob({
            jobId: qwenResult.job_id,
            service: 'qwen',
            status: qwenResult.status,
            type: 'text2img',
            queuePosition: qwenResult.queue_position,
            metadata: { prompt: qwen.prompt, source: 'text-mode' },
          });

          incrementConnection('qwen');
          setText2ImgPreviewUrl('pending');
        } else if (params.inputMode === 'batch') {
          const files = params.batchImages!;

          // Convert all images to data URLs for NavActions thumbnails
          const referenceImageDataUrls = await Promise.all(
            files.map((file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              }),
            ),
          );

          // Submit async batch job - no placeholder assets; assets are created via NavActions "View 3D"
          const result: JobSubmitResponse = await generateReconBatch(files, advancedParams);

          addJob({
            jobId: result.job_id,
            service: 'reconviagen',
            status: result.status,
            type: 'generate-batch',
            queuePosition: result.queue_position,
            metadata: {
              name: `Batch (${files.length} files)`,
              fileCount: files.length,
              referenceImageDataUrls,
            },
          });

          incrementConnection('reconviagen');
        }
      } catch (err) {
        console.error('Generation failed:', err);
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [addJob, incrementConnection, isQwenAvailable],
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
          isConnectionAvailable={isReconAvailable}
          remainingSlots={reconRemainingSlots}
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
          <ExportDropdown sceneRef={sceneRef} />
        </div>
      </main>
    </div>
  );
}
