'use client';

import { useCallback } from 'react';
import { useEffect } from 'react';
import { client } from '@/lib/api/client';
import type { JobService } from '@/store/phidias-store';
import { usePhidiasStore } from '@/store/phidias-store';
import { PHIDIAS_EVENTS } from '@pegaverse/phidias-sdk';
import type { JobCompleteDetail } from '@pegaverse/phidias-sdk';

const POLLING_INTERVAL_MS = 5000;

interface JobStatusResponse {
  job_id: string;
  status: string;
  queue_position: number | null;
  created_at: string;
  progress: { current: number; total: number } | null;
  result?: Record<string, unknown>;
  error?: { error_code: string; message: string };
}

function getJobEndpoint(service: JobService, jobId: string, apiBaseUrl: string): string {
  const base = apiBaseUrl || '';
  switch (service) {
    case 'qwen':
      return `${base}/phidias/qwen/jobs/${jobId}`;
    case 'reconviagen':
      return `${base}/phidias/reconviagen/jobs/${jobId}`;
    case 'p3sam':
      return `${base}/phidias/segment/3d/jobs/${jobId}`;
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}

// Jobs with temporary IDs (pending-*) should not be polled until replaced with real job_id
const isTemporaryJobId = (jobId: string): boolean => jobId.startsWith('pending-');

// Terminal statuses — jobs in these states stop being polled
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

const isActiveStatus = (status: string): boolean => !TERMINAL_STATUSES.has(status);

const MAX_CONSECUTIVE_FAILURES = 3;

// Track polling state outside React to avoid re-renders
let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;
let currentApiBaseUrl: string | null = null;

function startPolling(apiBaseUrl: string | null) {
  if (pollingInterval) return;
  currentApiBaseUrl = apiBaseUrl;

  pollingInterval = setInterval(() => {
    const store = usePhidiasStore.getState();

    // Check polling status - stop if paused or in error state
    const pollingStatus = store.pollingState.status;
    if (pollingStatus === 'paused' || pollingStatus === 'error') {
      return;
    }

    if (isPolling) return;
    isPolling = true;

    // Filter out temporary pending-* jobs that haven't been replaced with real job_id yet
    const activeJobs = store.jobs.filter(
      (j) => isActiveStatus(j.status) && !isTemporaryJobId(j.jobId)
    );

    if (activeJobs.length === 0) {
      // No active jobs — skip this tick but DO NOT stop polling.
      // The useEffect will call stopPolling() when hasActiveJobs becomes false.
      isPolling = false;
      return;
    }

    // Poll all active jobs
    Promise.all(
      activeJobs.map(async (job) => {
        try {
          const endpoint = getJobEndpoint(job.service, job.jobId, currentApiBaseUrl as string);
          const { data } = await client.get<JobStatusResponse>(endpoint, {
            timeout: 10000,
          });

          // Clear error count on successful response
          store.clearPollingError();

          // Backend state is the source of truth — always sync.
          // API uses current/total; store uses current/total.
          store.updateJob(job.jobId, {
            status: data.status,
            queuePosition: data.queue_position,
            progress: data.progress,
            result: data.result,
            error: data.error,
          });

          if (TERMINAL_STATUSES.has(data.status)) {
            store.decrementConnection(job.service);

            // Notify the host app (e.g. pegaverse-portal) so it can show a toast
            // even when the user has navigated away from the Phidias route.
            const detail: JobCompleteDetail = {
              jobId: job.jobId,
              service: job.service,
              type: job.type,
              status: data.status as 'completed' | 'failed',
              error: data.error,
            };
            document.dispatchEvent(
              new CustomEvent(PHIDIAS_EVENTS.JOB_COMPLETE, {
                bubbles: true,
                composed: true,
                detail,
              }),
            );
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[JobManager] Poll failed for ${job.jobId}:`, err);
          store.recordPollingError(errorMessage);

          // Check if we hit max failures - pause polling
          const state = store.pollingState;
          if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(`[JobManager] Max consecutive failures (${MAX_CONSECUTIVE_FAILURES}) reached. Pausing polling.`);
          }
        }
      })
    ).then(() => {
      isPolling = false;
    });
  }, POLLING_INTERVAL_MS);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Hook to retry polling after errors.
 * Call this when user clicks the retry button.
 */
export function useResumePolling() {
  const resumePolling = usePhidiasStore((s) => s.resumePolling);
  const pollingState = usePhidiasStore((s) => s.pollingState);

  const retry = useCallback(() => {
    resumePolling();
  }, [resumePolling]);

  return {
    retry,
    pollingState,
  };
}

/**
 * Lightweight hook that only starts/stops polling — no return value, no array selectors.
 * Safe to call in layout components. Uses primitive/boolean selectors only to avoid
 * the `.filter()` new-array-reference infinite loop problem.
 */
export function useJobPolling() {
  const apiBaseUrl = usePhidiasStore((s) => s.apiBaseUrl);
  // Boolean selector: primitive return value, reference-stable, never causes infinite loop
  const hasActiveJobs = usePhidiasStore((s) =>
    s.jobs.some((j) => isActiveStatus(j.status))
  );
  // Watch polling status to stop polling when error occurs
  const pollingStatus = usePhidiasStore((s) => s.pollingState.status);

  useEffect(() => {
    // Don't start polling if status is error
    if (hasActiveJobs && !pollingInterval && pollingStatus !== 'error') {
      startPolling(apiBaseUrl);
    } else if ((!hasActiveJobs || pollingStatus === 'error') && pollingInterval) {
      stopPolling();
    }
  }, [hasActiveJobs, apiBaseUrl, pollingStatus]);
}

/**
 * Hook to enable job polling. Call this once in a component that mounts
 * when the app starts (e.g., NavActions).
 * @deprecated Use useJobPolling() in layout components to avoid infinite loops
 * from array selector re-renders.
 */
export function useJobManager() {
  const apiBaseUrl = usePhidiasStore((s) => s.apiBaseUrl);
  const jobs = usePhidiasStore((s) => s.jobs);

  // Start/stop polling based on job state
  useEffect(() => {
    const hasActiveJobs = jobs.some((j) => isActiveStatus(j.status));

    if (hasActiveJobs && !pollingInterval) {
      startPolling(apiBaseUrl);
    } else if (!hasActiveJobs && pollingInterval) {
      stopPolling();
    }

    return () => {
      // Don't stop polling on unmount - let it continue for other components
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length, apiBaseUrl]); // Only re-run when job count changes

  return {
    activeJobs: usePhidiasStore((s) => s.jobs.filter((j) => isActiveStatus(j.status))),
    completedJobs: usePhidiasStore((s) => s.jobs.filter((j) => TERMINAL_STATUSES.has(j.status))),
  };
}

export function useConnectionAvailability(service: JobService): boolean {
  return usePhidiasStore((s) => s.isConnectionAvailable(service));
}

export function useConnectionCount(service: JobService): number {
  return usePhidiasStore((s) => s.getConnectionCount(service));
}
