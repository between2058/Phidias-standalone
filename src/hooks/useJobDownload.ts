'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/lib/api/client';
import {
  usePhidiasStore,
  JobRecord,
  JobService,
} from '@/store/phidias-store';

interface DownloadOptions {
  /** Callback when images are downloaded - receives array of data URLs */
  onImagesDownloaded?: (images: string[]) => void;
  /** Callback when GLB is downloaded - receives blob URL */
  onGlbDownloaded?: (url: string, options?: { name?: string }) => void;
  /** If true, automatically switch to target tab (Image or Model) */
  autoSwitchTab?: boolean;
}

interface QwenResult {
  urls?: string[];
  input_url?: string;
  results?: { right?: string; back?: string; left?: string; front?: string };
}

interface ReconViaGenResult {
  glb_file?: string;
  gaussian_video?: string;
  radiance_video?: string;
  mesh_video?: string;
  ply_file?: string;
}

interface P3SamResult {
  segmented_glb?: string;
  num_parts?: number;
}

/**
 * Hook to handle job result downloads.
 *
 * Usage:
 * - Call downloadJobResult() when user clicks download on a completed job
 * - Automatically handles different result types (images vs GLB)
 * - Can auto-switch to appropriate tab
 */
export function useJobDownload(options: DownloadOptions = {}) {
  const router = useRouter();
  const { onImagesDownloaded, onGlbDownloaded, autoSwitchTab = true } = options;
  const { apiBaseUrl, markJobAsRead } = usePhidiasStore();

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
    [apiBaseUrl]
  );

  const blobToDataURL = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const downloadFile = useCallback(
    async (url: string): Promise<Blob> => {
      const { data } = await client.get<Blob>(url, {
        timeout: 60000,
        responseType: 'blob',
      });
      return data;
    },
    []
  );

  /**
   * Download and process a completed job's result.
   */
  const downloadJobResult = useCallback(
    async (job: JobRecord): Promise<void> => {
      if (job.status !== 'completed' || !job.result) {
        console.warn(
          `[useJobDownload] Job ${job.jobId} is not completed or has no result`
        );
        return;
      }

      try {
        markJobAsRead(job.jobId);

        // Handle Qwen image results
        if (job.service === 'qwen') {
          const result = job.result as QwenResult;
          const urls: string[] = [];

          // Collect all image URLs
          if (result.urls && result.urls.length > 0) {
            urls.push(...result.urls);
          }
          // Angle multi results
          if (result.results) {
            if (result.results.right) urls.push(result.results.right);
            if (result.results.back) urls.push(result.results.back);
            if (result.results.left) urls.push(result.results.left);
            if (result.results.front) urls.push(result.results.front);
          }

          if (urls.length === 0) {
            throw new Error('No image URLs found in job result');
          }

          // Download all images
          const dataUrls = await Promise.all(
            urls.map(async (relativeUrl) => {
              const fileName = relativeUrl.split('/').pop() || '';
              const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
              const blob = await downloadFile(downloadUrl);
              return blobToDataURL(blob);
            })
          );

          if (onImagesDownloaded) {
            onImagesDownloaded(dataUrls);
          }

          if (autoSwitchTab) {
            usePhidiasStore.getState().setPendingMultiViewImages(dataUrls);
            router.push('/workspace/image');
          }
        }

        // Handle ReconViaGen GLB results
        else if (job.service === 'reconviagen') {
          const result = job.result as ReconViaGenResult;

          if (!result.glb_file) {
            throw new Error('No GLB file found in job result');
          }

          const fileName = result.glb_file.split('/').pop() || 'model.glb';
          const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
          const blob = await downloadFile(downloadUrl);
          const blobUrl = URL.createObjectURL(blob);

          // Extract name from metadata or use default
          const metadata = job.metadata;
          const name = (metadata?.name as string) ||
            (metadata?.fileName as string) ||
            fileName.replace('.glb', '');

          if (onGlbDownloaded) {
            onGlbDownloaded(blobUrl, { name });
          }

          if (autoSwitchTab) {
            // Store the model URL for Model workspace
            usePhidiasStore.getState().setPendingModelImage(blobUrl);
            router.push('/workspace/model');
          }
        }

        // Handle P3-SAM segmented GLB results
        else if (job.service === 'p3sam') {
          const result = job.result as P3SamResult;

          if (!result.segmented_glb) {
            throw new Error('No segmented GLB found in job result');
          }

          const fileName = result.segmented_glb.split('/').pop() || 'segmented.glb';
          const downloadUrl = getDownloadUrl(job.service, job.jobId, fileName);
          const blob = await downloadFile(downloadUrl);

          // Split the segmented mesh if needed (same logic as segment page)
          // For now, create object URL directly
          const blobUrl = URL.createObjectURL(blob);

          const name = `Segmented (${result.num_parts || '?'} parts)`;

          // Update the asset with the segmented model
          const metadata = job.metadata;
          if (metadata?.assetId) {
            // Store the model URL in pending state so segment page can pick it up
            usePhidiasStore.getState().setPendingSegmentedModel?.({
              assetId: metadata.assetId as string,
              modelUrl: blobUrl,
              numParts: result.num_parts || 0,
            });
          }

          if (onGlbDownloaded) {
            onGlbDownloaded(blobUrl, { name });
          }

          // Note: P3-SAM results stay in Segment workspace
          // The segment page will handle loading the segmented model
        }

        // Optionally remove job after successful download
        // removeJob(job.jobId);
      } catch (err) {
        console.error(`[useJobDownload] Failed to download job ${job.jobId}:`, err);
        throw err;
      }
    },
    [
      router,
      onImagesDownloaded,
      onGlbDownloaded,
      autoSwitchTab,
      markJobAsRead,
      getDownloadUrl,
      downloadFile,
      blobToDataURL,
    ]
  );

  return {
    downloadJobResult,
    blobToDataURL,
  };
}
