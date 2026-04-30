'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import ImageGeneratePanel from '@/components/image/ImageGeneratePanel';

import {
  generateText2Img,
  editImage,
  generateAngleMulti,
} from '@/lib/api/phidias';
import type { ProgressUpdate } from '@/lib/api/types';
import { usePhidiasStore } from '@/store/phidias-store';
import { useConnectionAvailability, useConnectionCount } from '@/hooks/useJobManager';
import type { JobService } from '@/store/phidias-store';

type ImageAngle = 'right' | 'back' | 'left' | 'original';

interface GeneratedImage {
  url: string;
  index: number;
  angle?: ImageAngle;
}

export default function ImagePage() {
  const router = useRouter();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [, setLastPrompt] = useState('');
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);
  const [, setIsLastMultiView] = useState(false);
  const setPreviewImage = usePhidiasStore((s) => s.setPreviewImage);
  const setPendingModelImage = usePhidiasStore((s) => s.setPendingModelImage);
  const setPendingMultiViewImages = usePhidiasStore(
    (s) => s.setPendingMultiViewImages,
  );

  // ── Job management for async pattern ───────────────────────────────────────
  const addJob = usePhidiasStore((s) => s.addJob);
  const updateJob = usePhidiasStore((s) => s.updateJob);
  const incrementConnection = usePhidiasStore((s) => s.incrementConnection);
  const decrementConnection = usePhidiasStore((s) => s.decrementConnection);
  const isQwenAvailable = useConnectionAvailability('qwen');
  const qwenConnectionCount = useConnectionCount('qwen');
  const qwenRemainingSlots = Math.max(0, 2 - qwenConnectionCount);
  const jobs = usePhidiasStore((s) => s.jobs);
  const apiBaseUrl = usePhidiasStore((s) => s.apiBaseUrl);
  const hostApp = usePhidiasStore((s) => s.hostApp);
  const pendingImageResults = usePhidiasStore((s) => s.pendingImageResults);
  const setPendingImageResults = usePhidiasStore((s) => s.setPendingImageResults);

  // Track which completed jobs have already been rendered so we don't double-process
  // Using store's shared tracking to prevent duplicate downloads in NavActions
  const processedImageJobIds = usePhidiasStore((s) => s.processedImageJobIds);
  const markImageJobProcessed = usePhidiasStore((s) => s.markImageJobProcessed);
  const processedJobIdsRef = useRef<Set<string>>(processedImageJobIds);

  // Sync ref with store when store updates
  useEffect(() => {
    processedJobIdsRef.current = processedImageJobIds;
  }, [processedImageJobIds]);

  // Convert a Qwen-relative download path to the Next.js proxy URL
  const toProxyUrl = useCallback(
    (qwenPath: string) => `${apiBaseUrl ?? ''}/phidias/qwen${qwenPath}`,
    [apiBaseUrl],
  );

  // Load images with auth in Web Component mode when hosted by pegaverse
  // Browser <img> doesn't send Authorization header, so we need to fetch with auth
  // and convert to blob URL for display
  const loadImageWithAuth = useCallback(
    async (qwenPath: string): Promise<string> => {
      const url = toProxyUrl(qwenPath);
      // Only need auth fetch when in pegaverse host app (WC mode with auth)
      if (hostApp !== 'pegaverse') {
        return url;
      }
      try {
        const { client } = await import('@/lib/api/client');
        const { data: blob } = await client.get<Blob>(url, { timeout: 60000 });
        return URL.createObjectURL(blob);
      } catch (err) {
        console.error('[ImagePage] Failed to load image with auth:', url, err);
        throw err;
      }
    },
    [hostApp, toProxyUrl],
  );

  // Listen for images pushed from NavActions action button
  // Also check on mount in case navigation happened with pending results already in store
  useEffect(() => {
    const loadPendingImages = () => {
      if (pendingImageResults && pendingImageResults.length > 0) {
        // If 4 images, assume it's angle-multi from NavActions (right, back, left, front order)
        // Map to: original (front), right, back, left
        if (pendingImageResults.length === 4) {
          // NavActions sends: [right, back, left, front]
          // We want display order: [front, right, back, left] → [original, right, back, left]
          const reorderedImages: GeneratedImage[] = [
            { url: pendingImageResults[3], index: 0, angle: 'original' }, // front → original
            { url: pendingImageResults[0], index: 1, angle: 'right' },
            { url: pendingImageResults[1], index: 2, angle: 'back' },
            { url: pendingImageResults[2], index: 3, angle: 'left' },
          ];
          setImages(reorderedImages);
          setIsLastMultiView(true);
        } else {
          setImages(pendingImageResults.map((url, index) => ({ url, index })));
          setIsLastMultiView(false);
        }
        setPendingImageResults(null);
      }
    };

    // Check immediately in case we're navigating to this page with pending results
    loadPendingImages();

    // Also set up listener for changes (for subsequent updates)
    const intervalId = setInterval(() => {
      // Double-check store after a short delay to handle race conditions
      const currentPending = usePhidiasStore.getState().pendingImageResults;
      if (currentPending && currentPending.length > 0 && !pendingImageResults) {
        loadPendingImages();
      }
    }, 100);

    // Clean up after 2 seconds (enough time for navigation to complete)
    setTimeout(() => clearInterval(intervalId), 2000);

    return () => clearInterval(intervalId);
  }, [pendingImageResults, setPendingImageResults]);

  // Listen for completed qwen jobs and display results
  useEffect(() => {
    const completed = jobs.filter(
      (j) =>
        j.service === 'qwen' &&
        j.status === 'completed' &&
        j.result &&
        !processedJobIdsRef.current.has(j.jobId),
    );

    if (completed.length === 0) return;

    // Load images with auth in pegaverse mode (browser <img> doesn't send auth)
    async function loadCompletedJobImages() {
      const newImages: GeneratedImage[] = [];
      let isMultiView = false;

      for (const job of completed) {
        processedJobIdsRef.current.add(job.jobId);
        // Also mark in store so NavActions knows this job is already processed
        markImageJobProcessed(job.jobId);
        const result = job.result as Record<string, unknown>;

        if (job.type === 'text2img' || job.type === 'edit') {
          const rawUrls =
            (result.urls as string[] | undefined) ??
            (result.result_urls as string[] | undefined) ??
            [];
          for (let i = 0; i < rawUrls.length; i++) {
            newImages.push({
              url: await loadImageWithAuth(rawUrls[i]),
              index: newImages.length,
            });
          }
        } else if (job.type === 'angle-multi') {
          const results = result.results as Record<string, string> | undefined;
          if (results) {
            // Display 4 angle images in the grid: original (front), right, back, left
            newImages.push({
              url: await loadImageWithAuth(results.front),
              index: newImages.length,
              angle: 'original',
            });
            newImages.push({
              url: await loadImageWithAuth(results.right),
              index: newImages.length,
              angle: 'right',
            });
            newImages.push({
              url: await loadImageWithAuth(results.back),
              index: newImages.length,
              angle: 'back',
            });
            newImages.push({
              url: await loadImageWithAuth(results.left),
              index: newImages.length,
              angle: 'left',
            });
            isMultiView = true;
          }
        }
      }

      if (newImages.length > 0) {
        setImages(newImages);
        setIsLastMultiView(isMultiView);
      }
    }

    loadCompletedJobImages().catch((err) => {
      console.error('[ImagePage] Failed to load completed job images:', err);
    });
  }, [jobs, loadImageWithAuth, setPendingMultiViewImages, router, markImageJobProcessed]);

  const handleGenerate = useCallback(
    async (
      prompt: string,
      samples: number,
      aspectRatio: string,
      referenceImage: File | null,
      generateMultiview: boolean,
      steps: number = 50,
      cfgScale: number = 4.0,
      negativePrompt: string = 'low quality, bad anatomy, blurry, distorted',
      qwenSeed: number = 0,
    ) => {
      // Redirect case: image only → go to model workspace, no job tracking needed
      if (referenceImage && !prompt && !generateMultiview) {
        setPendingModelImage(URL.createObjectURL(referenceImage));
        router.push('/workspace/model');
        return;
      }

      setIsGenerating(true);
      setProgress({ percent: 10, stage: 'Generating...' });
      setLastPrompt(prompt);
      setIsLastMultiView(false);

      const service: JobService = 'qwen';
      // When multi-view is enabled with a reference image, always use angle-multi
      // (regardless of whether prompt is empty or not)
      const jobType =
        referenceImage && generateMultiview
          ? 'angle-multi'
          : referenceImage
            ? 'edit'
            : 'text2img';

      // Convert reference image to data URL for display in job card metadata
      let referenceImageDataUrl: string | undefined;
      if (referenceImage) {
        referenceImageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(referenceImage);
        });
      }

      // Add a pending job immediately so the bell panel shows activity right away
      const tempId = `pending-${Date.now()}`;
      addJob({
        jobId: tempId,
        service,
        status: 'queued',
        type: jobType,
        queuePosition: null,
        metadata: { prompt, numSamples: samples, aspectRatio, referenceImageDataUrl },
      });
      incrementConnection(service);

      try {
        let result: { job_id: string; status: 'queued' | 'processing' | 'completed' | 'failed'; queue_position: number };

        // Use jobType to determine which API to call (consistent with display)
        if (jobType === 'angle-multi') {
          result = await generateAngleMulti(referenceImage!, {});
          setIsLastMultiView(true);
        } else if (jobType === 'edit') {
          result = await editImage(referenceImage!, prompt, {
            num_samples: samples,
            steps,
            cfg_scale: cfgScale,
            negative_prompt: negativePrompt,
            seed: qwenSeed || undefined,
          });
        } else {
          result = await generateText2Img(prompt, {
            num_samples: samples,
            aspect_ratio: aspectRatio,
            num_steps: steps,
            cfg_scale: cfgScale,
            negative_prompt: negativePrompt,
            seed: qwenSeed,
          });
        }

        // Replace temp ID with the real job_id returned by the server
        updateJob(tempId, {
          jobId: result.job_id,
          status: result.status,
          queuePosition: result.queue_position,
        });
      } catch (err) {
        console.error('[ImagePage] Failed to submit job:', err);
        updateJob(tempId, {
          status: 'failed',
          error: {
            error_code: 'SUBMIT_FAILED',
            message: err instanceof Error ? err.message : 'Job submission failed',
          },
        });
        decrementConnection(service);
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [router, setPendingModelImage, addJob, updateJob, incrementConnection, decrementConnection],
  );

  const handleToModel = (url: string) => {
    setPendingModelImage(url);
    router.push('/workspace/model');
  };

  const handleToMultiView = (urls: string[]) => {
    setPendingMultiViewImages(urls);
    router.push('/workspace/model');
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
        <ImageGeneratePanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          progress={progress}
          isConnectionAvailable={isQwenAvailable}
          remainingSlots={qwenRemainingSlots}
        />
      </aside>

      {/* Center — Image Grid */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div
          className="px-4 py-2.5 border-b flex items-center gap-2"
          style={{ background: '#1e1e36', borderColor: '#333355' }}
        >
          <span className="text-sm text-[#94a3b8]">
            ✨ Select image to generate 3D model
          </span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="text-6xl mb-4 opacity-20">🖼</div>
              <p className="text-[#64748b] text-sm">
                Generated images will appear here
              </p>
              <p className="text-[#4b5563] text-xs mt-1">
                Enter a prompt and click Generate
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                {images.map((img) => (
                  <div
                    key={img.index}
                    className="relative rounded-xl overflow-hidden cursor-pointer group"
                    style={{ aspectRatio: '1/1' }}
                    onMouseEnter={() => setHoveredImage(img.index)}
                    onMouseLeave={() => setHoveredImage(null)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Generated ${img.index + 1}`}
                      className="w-full h-full object-cover"
                      onClick={() => setPreviewImage(img.url)}
                    />

                    {/* Angle label - always visible for angle-multi images */}
                    {img.angle && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-semibold text-white z-10"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        {img.angle}
                      </div>
                    )}

                    <div
                      className={cn(
                        'absolute inset-0 transition-opacity duration-200 pointer-events-none',
                        hoveredImage === img.index
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                    />

                    {hoveredImage === img.index && (
                      <button
                        onClick={() => handleToModel(img.url)}
                        className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg text-xs font-bold text-[#1a1a2e] flex items-center gap-1 z-20"
                        style={{ background: '#f5a623' }}
                      >
                        → to 3D
                      </button>
                    )}

                    <div
                      className={cn(
                        'absolute inset-0 rounded-xl border-2 transition-colors pointer-events-none',
                        hoveredImage === img.index
                          ? 'border-[#7c3aed]'
                          : 'border-transparent',
                      )}
                    />
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <div className="mt-4 max-w-2xl mx-auto flex">
                  <button
                    onClick={() =>
                      handleToMultiView(images.map((img) => img.url))
                    }
                    className="w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: '#f5a623' }}
                  >
                    → to multi-view
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
