'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Loader2, AlertCircle, Eye, Box } from 'lucide-react';
import { usePhidiasStore, JobRecord, JobService } from '@/store/phidias-store';
import { useResumePolling } from '@/hooks/useJobManager';
import { useWorkspace } from '@/lib/workspace-context';
import { client } from '@/lib/api/client';
import { cancelJob } from '@/lib/api/phidias';
import { cn } from '@/lib/utils';

const JOB_TTL_MS = 90 * 60 * 1000; // 90 minutes — matches backend cleanup interval

interface NavActionsProps {
  panelPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const positionClasses: Record<NonNullable<NavActionsProps['panelPosition']>, string> = {
  'top-right': 'top-full right-0 mt-2',
  'top-left': 'top-full left-0 mt-2',
  'bottom-right': 'bottom-full right-0 mb-2',
  'bottom-left': 'bottom-full left-0 mb-2',
};

/**
 * Bell and Settings action buttons shared between TopNavBar (standalone mode)
 * and LeftIconSidebar (web component mode).
 *
 * Features:
 * - Click Bell to open job notification panel
 * - Shows active jobs (queued/processing) and completed/failed jobs
 * - Blue glow + rotating spinner badge when jobs are processing
 * - Amber glow + unread badge when completed jobs are unread
 * - Job cards show metadata (prompt text and/or reference image thumbnail)
 * - Action buttons: View Images (qwen) or View 3D (reconviagen/p3sam)
 */
export default function NavActions({ panelPosition = 'top-right' }: NavActionsProps) {
  const router = useRouter();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loadingJobIds, setLoadingJobIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  // Get processed job IDs from store (shared across components)
  const processedImageJobIds = usePhidiasStore((s) => s.processedImageJobIds);
  const markImageJobProcessed = usePhidiasStore((s) => s.markImageJobProcessed);
  const processed3DJobIds = usePhidiasStore((s) => s.processed3DJobIds);
  const mark3DJobProcessed = usePhidiasStore((s) => s.mark3DJobProcessed);
  const processedReconviagenJobIds = usePhidiasStore((s) => s.processedReconviagenJobIds);
  const markReconviagenJobProcessed = usePhidiasStore((s) => s.markReconviagenJobProcessed);
  const processedP3samJobIds = usePhidiasStore((s) => s.processedP3samJobIds);
  const markP3samJobProcessed = usePhidiasStore((s) => s.markP3samJobProcessed);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Get jobs from store
  const jobs = usePhidiasStore((s) => s.jobs);
  const markAllJobsAsRead = usePhidiasStore((s) => s.markAllJobsAsRead);
  const markJobAsRead = usePhidiasStore((s) => s.markJobAsRead);
  const removeJob = usePhidiasStore((s) => s.removeJob);
  const updateJob = usePhidiasStore((s) => s.updateJob);
  const decrementConnection = usePhidiasStore((s) => s.decrementConnection);
  const getActiveJobs = usePhidiasStore((s) => s.getActiveJobs);
  const getCompletedJobs = usePhidiasStore((s) => s.getCompletedJobs);
  const getUnreadCount = usePhidiasStore((s) => s.getUnreadCount);
  const apiBaseUrl = usePhidiasStore((s) => s.apiBaseUrl);
  const setPendingImageResults = usePhidiasStore((s) => s.setPendingImageResults);
  const setPendingAssetsForSegment = usePhidiasStore((s) => s.setPendingAssetsForSegment);

  // Get assets from workspace context to find existing assets when navigating
  const { assets } = useWorkspace();

  // Check if a batch job is effectively failed (top-level completed but all batch items failed)
  const isBatchAllFailed = useCallback((job: JobRecord): boolean => {
    if (job.status !== 'completed') return false;
    if (job.type !== 'generate-batch') return false;
    const result = job.result as Record<string, unknown> | undefined;
    if (!result) return false;
    const batchResults = result.results as Array<{ status: string }> | undefined;
    if (!batchResults || batchResults.length === 0) return false;
    return batchResults.every(item => item.status === 'failed');
  }, []);

  // Get display status - returns the actual status to show (handles batch edge cases)
  const getDisplayStatus = (job: JobRecord): JobRecord['status'] => {
    if (job.status === 'completed' && isBatchAllFailed(job)) {
      return 'failed';
    }
    return job.status;
  };

  // Sort newest → oldest
  const activeJobs = [...getActiveJobs()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const completedJobs = [...getCompletedJobs()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unreadCount = getUnreadCount();
  const hasProcessing = activeJobs.length > 0;
  const hasUnreadFailed = completedJobs.some((j) => {
    if (j.status === 'failed' && j.isNew) return true;
    // Also count batch jobs where all items failed
    if (j.isNew && isBatchAllFailed(j)) return true;
    return false;
  });

  // Polling error state
  const { retry, pollingState } = useResumePolling();
  const isPollingError = pollingState.status === 'error';
  const showRetryBadge = isPollingError && !isPanelOpen;

  // Close panel when clicking outside
  // Use composedPath() to handle Shadow DOM event retargeting in WC mode
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // composedPath() returns the event path including shadow DOM elements
      const path = event.composedPath();

      const isClickInsidePanel = panelRef.current && path.some(el => el === panelRef.current);
      const isClickInsideBell = bellRef.current && path.some(el => el === bellRef.current);

      if (!isClickInsidePanel && !isClickInsideBell) {
        setIsPanelOpen(false);
      }
    }

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen]);

  // Mark all as read when opening panel
  const handleBellClick = () => {
    setIsPanelOpen(!isPanelOpen);
    if (!isPanelOpen && unreadCount > 0) {
      markAllJobsAsRead();
    }
  };

  const setJobLoading = useCallback((jobId: string, loading: boolean) => {
    setLoadingJobIds((prev) => {
      const next = new Set(prev);
      if (loading) { next.add(jobId); } else { next.delete(jobId); }
      return next;
    });
  }, []);

  const handleCancelJob = useCallback(
    async (job: JobRecord) => {
      if (loadingJobIds.has(job.jobId)) return;
      setJobLoading(job.jobId, true);
      try {
        await cancelJob(job.jobId, job.service);
        // The polling loop will pick up the status change; update store immediately for snappy UX
        updateJob(job.jobId, {
          status: 'cancelled',
          error: { error_code: 'CANCELLED', message: 'Job was cancelled by user' },
        });
        decrementConnection(job.service);
      } catch (err) {
        console.error('[NavActions] Cancel job failed:', err);
      } finally {
        setJobLoading(job.jobId, false);
      }
    },
    [loadingJobIds, setJobLoading, updateJob, decrementConnection],
  );

  const getDownloadUrl = useCallback(
    (service: JobService, jobId: string, fileName: string): string => {
      const base = apiBaseUrl || '';
      switch (service) {
        case 'qwen':
          return `${base}/phidias/qwen/download/${jobId}/${fileName}`;
        case 'reconviagen':
          return `${base}/phidias/reconviagen/download/${jobId}/${fileName}`;
        case 'p3sam':
          return `${base}/phidias/p3sam/download/${jobId}/${fileName}`;
        default:
          throw new Error(`Unknown service: ${service}`);
      }
    },
    [apiBaseUrl],
  );

  const blobToDataURL = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // View Images action — downloads qwen images and navigates to image workspace
  const handleViewImages = useCallback(
    async (job: JobRecord) => {
      if (loadingJobIds.has(job.jobId)) return;

      // If already processed, re-download images and navigate to image workspace
      if (processedImageJobIds.has(job.jobId)) {
        console.log('[NavActions] Images already processed, re-downloading for navigation');
        try {
          const result = job.result as Record<string, unknown>;
          const relativeUrls: string[] = [];
          const rawUrls = (result.urls as string[] | undefined) ?? [];
          const rawResultUrls = (result.result_urls as string[] | undefined) ?? [];
          const results = result.results as Record<string, string> | undefined;

          relativeUrls.push(...rawUrls, ...rawResultUrls);
          if (results) {
            ['right', 'back', 'left', 'front'].forEach((k) => {
              if (results[k]) relativeUrls.push(results[k]);
            });
          }

          if (relativeUrls.length > 0) {
            const dataUrls = await Promise.all(
              relativeUrls.map(async (relUrl) => {
                const fileName = relUrl.split('/').pop() || '';
                const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
                const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 60000 });
                return blobToDataURL(blob);
              }),
            );
            setPendingImageResults(dataUrls);
          }
        } catch (err) {
          console.error('[NavActions] Re-download images failed:', err);
        }
        setIsPanelOpen(false);
        router.push('/workspace/image');
        return;
      }

      setJobLoading(job.jobId, true);

      try {
        markJobAsRead(job.jobId);
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
          throw new Error('No image URLs found in job result');
        }

        const dataUrls = await Promise.all(
          relativeUrls.map(async (relUrl) => {
            const fileName = relUrl.split('/').pop() || '';
            const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
            const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 60000 });
            return blobToDataURL(blob);
          }),
        );

        // Mark job as processed to prevent duplicate downloads
        markImageJobProcessed(job.jobId);
        setPendingImageResults(dataUrls);
        setIsPanelOpen(false);
        router.push('/workspace/image');
      } catch (err) {
        console.error('[NavActions] View images failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to load images';
        setDownloadErrors(prev => ({ ...prev, [job.jobId]: message }));
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setDownloadErrors(prev => {
            const next = { ...prev };
            delete next[job.jobId];
            return next;
          });
        }, 5000);
      } finally {
        setJobLoading(job.jobId, false);
      }
    },
    [
      loadingJobIds,
      processedImageJobIds,
      markImageJobProcessed,
      setJobLoading,
      markJobAsRead,
      getDownloadUrl,
      blobToDataURL,
      setPendingImageResults,
      router,
    ],
  );

  // View 3D action — downloads GLB, adds as asset, navigates to segment workspace
  const handleView3D = useCallback(
    async (job: JobRecord) => {
      if (loadingJobIds.has(job.jobId)) return;

      // If already processed by jobId, find existing asset and navigate to segment workspace
      // Also check service-specific sets to avoid duplicate downloads
      if (processed3DJobIds.has(job.jobId) ||
          (job.service === 'reconviagen' && processedReconviagenJobIds.has(job.jobId)) ||
          (job.service === 'p3sam' && processedP3samJobIds.has(job.jobId))) {
        console.log('[NavActions] Job already processed, finding existing asset and navigating to segment workspace');

        // Try to find existing asset by jobId or by name from job metadata
        const meta = job.metadata;
        const assetName = (meta?.name as string) || (meta?.fileName as string | undefined)?.replace(/\.[^.]+$/, '');
        const existingAsset = assets.find(a => a.jobId === job.jobId || (assetName && a.name === assetName));

        if (existingAsset) {
          // Pass assetId via pendingAssetsForSegment so segment page can set it as active
          console.log('[NavActions] Found existing asset:', existingAsset.id, existingAsset.name);
          setPendingAssetsForSegment([{
            url: existingAsset.modelUrl,
            name: existingAsset.name,
            service: job.service,
            fileSize: existingAsset.fileSize,
            jobId: job.jobId,
            assetId: existingAsset.id,
          }]);
        } else {
          // Asset not found in current workspace - need to re-download from job result
          // Extract file info from job result and set up pending assets for download
          console.log('[NavActions] Existing asset not found, re-downloading from job result');
          const result = job.result as Record<string, unknown>;

          // Handle batch results - check if all items already exist by name, otherwise re-download
          if (job.type === 'generate-batch' && result.results) {
            console.log('[NavActions] Checking existing batch assets');
            const batchResults = result.results as Array<{
              status: string;
              original_filename?: string;
              urls?: {
                glb_file?: string;
              }
            }>;
            const successItems = batchResults.filter(r => r.status === 'success' && r.urls?.glb_file);

            // Build list of expected asset names
            const expectedNames = successItems.map((item) => {
              const fileName = item.urls!.glb_file!.split('/').pop() || 'model.glb';
              return item.original_filename?.replace(/\.[^.]+$/, '') || fileName.replace('.glb', '');
            });

            // Find existing assets that match these names
            const existingBatchAssets = assets.filter(a => expectedNames.includes(a.name));
            console.log('[NavActions] Found existing batch assets:', existingBatchAssets.length, 'expected:', expectedNames.length);

            if (existingBatchAssets.length === expectedNames.length) {
              // All items already exist - use existing assets
              const pending = existingBatchAssets.map(a => ({
                url: a.modelUrl,
                name: a.name,
                service: job.service,
                assetId: a.id,
              }));
              setPendingAssetsForSegment(pending);
            } else {
              // Some or all items missing - re-download all items
              const newAssets = successItems.map((item) => {
                const glbUrl = item.urls!.glb_file!;
                const urlParts = glbUrl.split('/').filter(Boolean);
                const reqId = urlParts.length >= 2 ? urlParts[urlParts.length - 2] : job.jobId;
                const fileName = urlParts.length >= 1 ? urlParts[urlParts.length - 1] : 'model.glb';
                const assetName = item.original_filename?.replace(/\.[^.]+$/, '') || fileName.replace('.glb', '');

                const downloadUrl = getDownloadUrl(job.service, reqId, fileName);
                return {
                  url: downloadUrl,
                  name: assetName,
                  service: job.service,
                };
              });
              setPendingAssetsForSegment(newAssets);
            }
          } else if (job.service === 'reconviagen') {
            const glbFile = result.glb_file as string | undefined;
            if (glbFile) {
              const fileName = glbFile.split('/').pop() || 'model.glb';
              const assetNameFromMeta =
                (meta?.name as string) ||
                (meta?.fileName as string | undefined)?.replace(/\.[^.]+$/, '') ||
                fileName.replace('.glb', '');
              // Build full download URL for segment page
              const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
              setPendingAssetsForSegment([{
                url: downloadUrl,
                name: assetNameFromMeta,
                service: job.service,
                jobId: job.jobId,
              }]);
            }
          } else if (job.service === 'p3sam') {
            const segGlb = result.segmented_glb as string | undefined;
            if (segGlb) {
              const fileName = segGlb.split('/').pop() || 'segmented.glb';
              const numParts = result.num_parts as number | undefined;
              // Build full download URL for segment page
              const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
              setPendingAssetsForSegment([{
                url: downloadUrl,
                name: `Segmented (${numParts ?? '?'} parts)`,
                service: job.service,
                jobId: job.jobId,
                numParts,
              }]);
            }
          }
        }

        setIsPanelOpen(false);
        router.push('/workspace/segment');
        return;
      }

      setJobLoading(job.jobId, true);

      try {
        markJobAsRead(job.jobId);
        // Mark job as processed BEFORE downloading (both legacy and specific sets)
        mark3DJobProcessed(job.jobId);
        // Also mark service-specific sets to prevent auto-download duplicates
        if (job.service === 'reconviagen') {
          markReconviagenJobProcessed(job.jobId);
        } else if (job.service === 'p3sam') {
          markP3samJobProcessed(job.jobId);
        }

        const result = job.result as Record<string, unknown>;

        // Handle batch results - download all successful GLBs
        if (job.type === 'generate-batch' && result.results) {
          console.log('[NavActions] Processing batch results');
          console.log('[NavActions] Batch result structure:', JSON.stringify(result.results, null, 2));
          // Backend returns results with urls.glb_file structure
          const batchResults = result.results as Array<{
            status: string;
            original_filename?: string;
            urls?: {
              glb_file?: string;
            }
          }>;
          const successItems = batchResults.filter(r => r.status === 'success' && r.urls?.glb_file);

          console.log('[NavActions] Batch success items:', successItems.length, successItems);

          if (successItems.length === 0) {
            throw new Error('No successful batch results found');
          }

          // Download all successful batch items in parallel
          const assets: Array<{ url: string; name: string; service: string; fileSize: number }> = [];
          await Promise.all(
            successItems.map(async (item) => {
              const glbUrl = item.urls!.glb_file!;
              // glb_file format: /download/{request_id}/{filename}
              const urlParts = glbUrl.split('/').filter(Boolean);
              const reqId = urlParts.length >= 2 ? urlParts[urlParts.length - 2] : job.jobId;
              const fileName = urlParts.length >= 1 ? urlParts[urlParts.length - 1] : 'model.glb';
              const assetName = item.original_filename?.replace(/\.[^.]+$/, '') || fileName.replace('.glb', '');

              const downloadUrl = getDownloadUrl(job.service, reqId, fileName);
              try {
                const { data: blob } = await client.get<Blob>(downloadUrl, {
                  timeout: 120000,
                });
                const blobUrl = URL.createObjectURL(blob);
                assets.push({
                  url: blobUrl,
                  name: assetName,
                  service: job.service,
                  fileSize: blob.size,
                });
                console.log('[NavActions] Downloaded batch item:', assetName, blob.size);
              } catch (err) {
                console.error('[NavActions] Failed to download batch item:', assetName, err);
              }
            })
          );

          if (assets.length === 0) {
            throw new Error('Failed to download any batch items');
          }

          // Add jobId so future re-downloads can find existing assets
          setPendingAssetsForSegment(assets.map(a => ({ ...a, jobId: job.jobId })));
        } else if (job.service === 'reconviagen') {
          const glbFile = result.glb_file as string | undefined;
          if (!glbFile) throw new Error('No GLB file found in job result');
          const fileName = glbFile.split('/').pop() || 'model.glb';
          const meta = job.metadata;
          const assetName =
            (meta?.name as string) ||
            (meta?.fileName as string | undefined)?.replace(/\.[^.]+$/, '') ||
            fileName.replace('.glb', '');

          const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
          const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 120000 });
          const blobUrl = URL.createObjectURL(blob);

          setPendingAssetsForSegment([{
            url: blobUrl,
            name: assetName,
            service: job.service,
            fileSize: blob.size,
            jobId: job.jobId,
          }]);
        } else {
          // p3sam
          const segGlb = result.segmented_glb as string | undefined;
          if (!segGlb) throw new Error('No segmented GLB found in job result');
          const fileName = segGlb.split('/').pop() || 'segmented.glb';
          const numParts = result.num_parts as number | undefined;
          const assetName = `Segmented (${numParts ?? '?'} parts)`;

          const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
          const { data: blob } = await client.get<Blob>(downloadUrl, { timeout: 120000 });
          const blobUrl = URL.createObjectURL(blob);

          // Pass sourceAssetId so the segment workspace updates the original asset
          // instead of creating a new one. The assetId is stored in job.metadata
          // when handleStartSegmentation calls addJob().
          // Pass numParts from job result so the handler can set segmentation metadata
          // even when splitSegmentedGlb cannot infer the count (e.g. already-split GLBs).
          setPendingAssetsForSegment([{
            url: blobUrl,
            name: assetName,
            service: job.service,
            fileSize: blob.size,
            sourceAssetId: job.metadata?.assetId as string | undefined,
            numParts: numParts,
            jobId: job.jobId,
          }]);
        }

        setIsPanelOpen(false);
        router.push('/workspace/segment');
      } catch (err) {
        console.error('[NavActions] View 3D failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to load 3D model';
        setDownloadErrors(prev => ({ ...prev, [job.jobId]: message }));
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setDownloadErrors(prev => {
            const next = { ...prev };
            delete next[job.jobId];
            return next;
          });
        }, 5000);
      } finally {
        setJobLoading(job.jobId, false);
      }
    },
    [
      loadingJobIds,
      setJobLoading,
      markJobAsRead,
      getDownloadUrl,
      setPendingAssetsForSegment,
      processed3DJobIds,
      mark3DJobProcessed,
      processedReconviagenJobIds,
      markReconviagenJobProcessed,
      processedP3samJobIds,
      markP3samJobProcessed,
      router,
      assets,
    ],
  );

  // Get service display name
  const getServiceName = (service: JobService) => {
    switch (service) {
      case 'qwen':
        return 'Qwen AI';
      case 'reconviagen':
        return 'ReconViaGen';
      case 'p3sam':
        return 'P3-SAM';
      case 'smart-organization':
        return 'Smart Organize';
      default:
        return service;
    }
  };

  // Get job type display name
  const getJobTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      'text2img': 'Text to Image',
      'edit': 'Image Edit',
      'edit-multi': 'Batch Edit',
      'angle-multi': 'Multi-Angle',
      'segment': '3D Segmentation',
      'generate-single': 'Single 3D',
      'generate-multi': 'Multi-View 3D',
      'generate-batch': 'Batch 3D',
      'smart-organize': 'Smart Organize',
    };
    return typeMap[type] || type;
  };

  // Format relative time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Get status color
  const getStatusColor = (status: JobRecord['status']) => {
    if (status === 'queued') return 'text-amber-400';
    if (status === 'completed') return 'text-green-400';
    if (status === 'failed') return 'text-red-400';
    if (status === 'cancelled') return 'text-orange-400';
    // All processing stages (sampling, generating, segmenting, etc.)
    return 'text-blue-400';
  };

  // Get status icon
  const getStatusIcon = (status: JobRecord['status']) => {
    if (status === 'queued') return <span className="text-amber-400 text-xs">⏳</span>;
    if (status === 'completed') return <span className="text-green-400 text-xs">✓</span>;
    if (status === 'failed') return <AlertCircle size={14} className="text-red-400" />;
    if (status === 'cancelled') return <span className="text-orange-400 text-xs">✕</span>;
    // All processing stages (sampling, generating, segmenting, etc.) show spinner
    return <Loader2 size={14} className="text-blue-400 animate-spin" />;
  };

  // Determine which action button to show for a completed job
  const getActionButton = (job: JobRecord) => {
    // Use display status to handle batch jobs where all items failed
    const displayStatus = getDisplayStatus(job);
    if (displayStatus !== 'completed') return null;
    const isLoading = loadingJobIds.has(job.jobId);
    const downloadError = downloadErrors[job.jobId];

    // Hide download buttons for expired jobs (TTL = 90 min, matching backend cleanup)
    const isExpired =
      Date.now() - new Date(job.createdAt).getTime() > JOB_TTL_MS;
    if (isExpired) {
      return (
        <span className="text-[10px] text-[#4b5563] italic">Expired</span>
      );
    }

    if (job.service === 'qwen') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewImages(job)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#60a5fa] bg-[#60a5fa]/10 hover:bg-[#60a5fa]/20 transition-colors disabled:opacity-50"
            title="View in Image workspace"
          >
            {isLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Eye size={11} />
            )}
            {isLoading ? 'Loading…' : 'View Images'}
          </button>
          {downloadError && (
            <span className="text-[10px] text-red-400 max-w-[120px] truncate" title={downloadError}>
              {downloadError}
            </span>
          )}
        </div>
      );
    }

    if (job.service === 'reconviagen' || job.service === 'p3sam') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleView3D(job)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#a78bfa] bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 transition-colors disabled:opacity-50"
            title="View in Segmentation workspace"
          >
            {isLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Box size={11} />
            )}
            {isLoading ? 'Loading…' : 'View 3D'}
          </button>
          {downloadError && (
            <span className="text-[10px] text-red-400 max-w-[120px] truncate" title={downloadError}>
              {downloadError}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  // Render metadata preview (prompt and/or reference image thumbnails)
  const renderMetadata = (job: JobRecord) => {
    const meta = job.metadata;
    if (!meta) return null;

    const prompt = meta.prompt as string | undefined;
    // Support both single image (backward compat) and multiple images
    const refImageUrl = meta.referenceImageDataUrl as string | undefined;
    const refImageUrls = meta.referenceImageDataUrls as string[] | undefined;

    // For P3-SAM segmentation: show the source asset thumbnail
    const assetThumbnail = meta.thumbnail as string | undefined;
    const assetName = meta.assetName as string | undefined;

    const imageUrls = refImageUrls?.length ? refImageUrls : refImageUrl ? [refImageUrl] : [];
    const hasPrompt = prompt && prompt.trim().length > 0;
    const hasImages = imageUrls.length > 0;
    const hasAssetInfo = assetThumbnail || assetName;

    if (!hasPrompt && !hasImages && !hasAssetInfo) return null;

    return (
      <div className="flex items-start gap-2 mt-1.5">
        {/* P3-SAM segmentation: source asset thumbnail */}
        {job.service === 'p3sam' && hasAssetInfo && (
          <div className="flex items-center gap-2">
            {assetThumbnail ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={assetThumbnail}
                alt={assetName || 'Asset'}
                className="w-8 h-8 rounded object-cover border border-[#333355] flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-[#333355] flex items-center justify-center text-[#94a3b8] text-xs flex-shrink-0">
                <Box size={14} />
              </div>
            )}
            {assetName && (
              <p className="text-[10px] text-[#94a3b8] leading-snug line-clamp-1 flex-1">
                {assetName}
              </p>
            )}
          </div>
        )}

        {/* ReconViaGen / Qwen: reference images */}
        {job.service !== 'p3sam' && hasImages && (
          <div className="flex -space-x-2 flex-shrink-0">
            {imageUrls.slice(0, 4).map((url, idx) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={idx}
                src={url}
                alt={`Reference ${idx + 1}`}
                className="w-8 h-8 rounded object-cover border border-[#333355]"
                style={{ zIndex: imageUrls.length - idx }}
              />
            ))}
            {imageUrls.length > 4 && (
              <div className="w-8 h-8 rounded bg-[#333355] flex items-center justify-center text-[10px] text-[#94a3b8] border border-[#444466]"
                   style={{ zIndex: 0 }}>
                +{imageUrls.length - 4}
              </div>
            )}
          </div>
        )}

        {hasPrompt && (
          <p className="text-[10px] text-[#94a3b8] leading-snug line-clamp-2 flex-1">
            {prompt}
          </p>
        )}
      </div>
    );
  };

  const hasAnyJobs = jobs.length > 0;

  return (
    <div className="relative">
      {/* Error Toast Banner */}
      {errorMessage && (
        <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-red-500/90 text-white text-xs rounded-lg shadow-lg z-50 flex items-start gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="flex-shrink-0 hover:bg-white/20 rounded p-0.5"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Bell Button with Badge */}
        <button
          ref={bellRef}
          onClick={handleBellClick}
          className={cn(
            'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            isPanelOpen && 'bg-bg-hover text-text-primary',
            hasProcessing && !isPanelOpen && 'animate-processing-glow',
            !hasProcessing && hasUnreadFailed && !isPanelOpen && 'animate-error-glow',
            !hasProcessing && !hasUnreadFailed && unreadCount > 0 && !isPanelOpen && 'animate-pulse-glow',
            showRetryBadge && 'animate-polling-error-glow',
          )}
        >
          <Bell size={16} />

          {/* Processing Badge — blue spinner */}
          {hasProcessing && !isPanelOpen && (
            <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-blue-500 text-white flex items-center justify-center z-10">
              <Loader2 size={11} className="animate-spin" />
            </span>
          )}

          {/* Failed Badge — warning icon, takes priority over unread count badge */}
          {!hasProcessing && hasUnreadFailed && (
            <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-red-600 text-white flex items-center justify-center z-10">
              <AlertCircle size={11} />
            </span>
          )}

          {/* Unread Count Badge — only shown when not processing and no failures and no polling error */}
          {!hasProcessing && !hasUnreadFailed && !isPollingError && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center z-10">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Polling Error Badge — takes priority over other badges */}
          {showRetryBadge && (
            <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-orange-600 text-white flex items-center justify-center z-10">
              <AlertCircle size={11} />
            </span>
          )}

          {/* Amber ping for unread completed (no failures) */}
          {!hasProcessing && !hasUnreadFailed && !isPollingError && unreadCount > 0 && !isPanelOpen && (
            <span className="absolute inset-0 rounded-lg bg-amber-500/30 animate-ping" />
          )}

          {/* Orange ping for polling error */}
          {showRetryBadge && (
            <span className="absolute inset-0 rounded-lg bg-orange-500/30 animate-ping" />
          )}
        </button>
      </div>

      {/* Job Notification Panel */}
      {isPanelOpen && (
        <div
          ref={panelRef}
          className={cn(
            'absolute w-80 max-h-[480px] overflow-hidden',
            'bg-[#1e1e36] border border-[#333355] rounded-xl shadow-2xl',
            'flex flex-col z-50',
            positionClasses[panelPosition],
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333355]">
            <h3 className="text-sm font-medium text-white">Job Notifications</h3>
            <button
              onClick={() => setIsPanelOpen(false)}
              className="text-[#64748b] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Polling Error Banner */}
          {isPollingError && (
            <div className="px-4 py-3 bg-orange-500/10 border-b border-orange-500/30">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-orange-400 text-sm font-medium">
                    Connection lost
                  </p>
                  <p className="text-orange-300/70 text-xs mt-0.5">
                    {pollingState.lastError || 'Failed to connect to server'}
                  </p>
                </div>
                <button
                  onClick={retry}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-lg transition-colors flex-shrink-0"
                >
                  Retry Now
                </button>
              </div>
            </div>
          )}

          {/* No Jobs State */}
          {!hasAnyJobs && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell size={32} className="text-[#4b5563] mb-3" />
              <p className="text-[#94a3b8] text-sm">No jobs submitted yet</p>
              <p className="text-[#64748b] text-xs mt-1">
                Submit a generation request to see it here
              </p>
            </div>
          )}

          {/* Job List */}
          {hasAnyJobs && (
            <div className={cn(
              'overflow-y-auto flex-1 p-2 space-y-1 scrollbar-thin',
              isPollingError && 'opacity-40 pointer-events-none'
            )}>
              {/* Active Jobs Section */}
              {activeJobs.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#64748b] px-2 mb-1">
                    Processing ({activeJobs.length})
                  </p>
                  {activeJobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="p-3 rounded-lg bg-[#252542]/50 border border-[#333355]/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white truncate">
                              {getServiceName(job.service)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333355] text-[#94a3b8]">
                              {getJobTypeName(job.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {getStatusIcon(job.status)}
                            <span className={cn('text-xs', getStatusColor(job.status))}>
                              {job.status === 'queued' && job.queuePosition
                                ? `Queued (position ${job.queuePosition})`
                                : job.status === 'cancelled' ? 'Cancelled' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </span>
                          </div>
                          {/* Progress bar — shown when stage supports step tracking */}
                          {job.progress != null && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-blue-400">
                                  {job.status === 'cancelled' ? 'Cancelled' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                </span>
                                <span className="text-[10px] text-[#64748b]">
                                  {job.progress.current} / {job.progress.total}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#333355] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                  style={{
                                    width: `${(job.progress.current / job.progress.total) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {renderMetadata(job)}
                          <p className="text-[10px] text-[#64748b] mt-1">
                            {formatTime(job.createdAt)}
                          </p>
                        </div>

                        {/* Cancel button — only for queued jobs */}
                        {job.status === 'queued' && (
                          <button
                            onClick={() => handleCancelJob(job)}
                            disabled={loadingJobIds.has(job.jobId)}
                            className="p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0 disabled:opacity-50"
                            title="Cancel job"
                          >
                            {loadingJobIds.has(job.jobId) ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed/Failed Jobs Section */}
              {completedJobs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#64748b] px-2 mb-1">
                    Results ({completedJobs.length})
                  </p>
                  {completedJobs.map((job) => (
                    <div
                      key={job.jobId}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        job.isNew
                          ? 'bg-[#252542] border-[#f5a623]/30'
                          : 'bg-[#1a1a2e] border-[#333355]/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-white truncate">
                              {getServiceName(job.service)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333355] text-[#94a3b8]">
                              {getJobTypeName(job.type)}
                            </span>
                            {job.isNew && (
                              <span className="w-2 h-2 rounded-full bg-[#f5a623]" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {getStatusIcon(getDisplayStatus(job))}
                            <span className={cn('text-xs', getStatusColor(getDisplayStatus(job)))}>
                              {getDisplayStatus(job) === 'completed' ? 'Completed' : getDisplayStatus(job) === 'cancelled' ? 'Cancelled' : getDisplayStatus(job).charAt(0).toUpperCase() + getDisplayStatus(job).slice(1)}
                            </span>
                          </div>
                          {/* Progress bar — shown when job has progress (even in completed/failed state for batch jobs) */}
                          {job.progress != null && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-blue-400">
                                  {getDisplayStatus(job) === 'cancelled' ? 'Cancelled' : getDisplayStatus(job).charAt(0).toUpperCase() + getDisplayStatus(job).slice(1)}
                                </span>
                                <span className="text-[10px] text-[#64748b]">
                                  {job.progress.current} / {job.progress.total}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#333355] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                  style={{
                                    width: `${(job.progress.current / job.progress.total) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {renderMetadata(job)}
                          {job.error && (
                            <p className="text-[10px] text-red-400 mt-1 truncate">
                              {job.error.message}
                            </p>
                          )}
                          <p className="text-[10px] text-[#64748b] mt-1">
                            {formatTime(job.createdAt)}
                          </p>

                          {/* Action button */}
                          <div className="mt-2">
                            {getActionButton(job)}
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeJob(job.jobId)}
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                          title="Remove"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {completedJobs.length > 0 && (
            <div className="p-2 border-t border-[#333355]">
              <button
                onClick={() => {
                  completedJobs.forEach((job) => removeJob(job.jobId));
                }}
                className="w-full py-2 text-xs text-[#64748b] hover:text-white transition-colors"
              >
                Clear all completed
              </button>
            </div>
          )}
        </div>
      )}

      {/* CSS for glow animations */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(245, 166, 35, 0.5), 0 0 10px rgba(245, 166, 35, 0.3);
          }
          50% {
            box-shadow: 0 0 15px rgba(245, 166, 35, 0.8), 0 0 25px rgba(245, 166, 35, 0.5);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes processing-glow {
          0%, 100% {
            box-shadow: 0 0 6px rgba(96, 165, 250, 0.5), 0 0 12px rgba(96, 165, 250, 0.3);
          }
          50% {
            box-shadow: 0 0 16px rgba(96, 165, 250, 0.9), 0 0 28px rgba(96, 165, 250, 0.5);
          }
        }
        .animate-processing-glow {
          animation: processing-glow 1.8s ease-in-out infinite;
        }

        @keyframes error-glow {
          0%, 100% {
            box-shadow: 0 0 4px rgba(220, 38, 38, 0.3), 0 0 8px rgba(220, 38, 38, 0.15);
          }
          50% {
            box-shadow: 0 0 8px rgba(220, 38, 38, 0.5), 0 0 14px rgba(220, 38, 38, 0.25);
          }
        }
        .animate-error-glow {
          animation: error-glow 2.5s ease-in-out infinite;
        }

        @keyframes polling-error-glow {
          0%, 100% {
            box-shadow: 0 0 4px rgba(234, 88, 12, 0.3), 0 0 8px rgba(234, 88, 12, 0.15);
          }
          50% {
            box-shadow: 0 0 8px rgba(234, 88, 12, 0.5), 0 0 14px rgba(234, 88, 12, 0.25);
          }
        }
        .animate-polling-error-glow {
          animation: polling-error-glow 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
