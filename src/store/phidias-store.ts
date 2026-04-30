import { create } from 'zustand';
import type { PhidiasMode } from '../config/types';

// ============================================================================
// Job Management Types
// ============================================================================

export type JobService = 'qwen' | 'reconviagen' | 'p3sam' | 'smart-organization';
export type JobStatus = string; // 'queued' | stage name | 'completed' | 'failed'

export interface JobRecord {
  jobId: string;
  service: JobService;
  status: JobStatus;
  type: string; // e.g., 'text2img', 'edit', 'edit-multi', 'angle-multi', 'segment', 'generate-single', 'generate-multi'
  queuePosition: number | null;
  createdAt: string;
  result?: Record<string, unknown>;
  error?: { error_code: string; message: string };
  metadata?: Record<string, unknown>; // original prompt, file names, etc.
  isNew: boolean; // unread notification
  progress?: { current: number; total: number } | null; // undefined/null when stage doesn't support progress tracking
}

export interface ConnectionState {
  qwen: number;
  reconviagen: number;
  p3sam: number;
  'smart-organization': number;
}

export type PollingStatus = 'active' | 'paused' | 'error';

export interface PollingState {
  status: PollingStatus;
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorTime: number | null;
}

interface PhidiasState {
  /** URL string of the image currently being previewed in the overlay, or null if no overlay is shown */
  previewImage: string | null;
  setPreviewImage: (url: string | null) => void;
  /** URL of an image that was sent from another panel (e.g. Image Workspace) to be loaded into the Model Workspace */
  pendingModelImage: string | null;
  setPendingModelImage: (url: string | null) => void;
  /** URLs of images sent from Image Workspace for multi-view generation */
  pendingMultiViewImages: string[] | null;
  setPendingMultiViewImages: (urls: string[] | null) => void;
  /** Image data URLs to display in the Image Workspace (set by NavActions action buttons) */
  pendingImageResults: string[] | null;
  setPendingImageResults: (urls: string[] | null) => void;
  /** Track processed image job IDs to prevent duplicate downloads */
  processedImageJobIds: Set<string>;
  markImageJobProcessed: (jobId: string) => void;
  /** Track processed 3D job IDs to prevent duplicate downloads (NavActions) */
  processed3DJobIds: Set<string>;
  mark3DJobProcessed: (jobId: string) => void;
  /** Track processed reconviagen job IDs to prevent duplicate auto-downloads in /model */
  processedReconviagenJobIds: Set<string>;
  markReconviagenJobProcessed: (jobId: string) => void;
  /** Track processed p3sam job IDs to prevent duplicate auto-downloads in /segment */
  processedP3samJobIds: Set<string>;
  markP3samJobProcessed: (jobId: string) => void;
  /** 3D assets to add to segment workspace (set by NavActions View 3D action) */
  pendingAssetsForSegment: Array<{ url: string; name: string; service: string; fileSize?: number; sourceAssetId?: string; numParts?: number; jobId?: string; assetId?: string }> | null;
  setPendingAssetsForSegment: (assets: Array<{ url: string; name: string; service: string; fileSize?: number; sourceAssetId?: string; numParts?: number; jobId?: string; assetId?: string }> | null) => void;
  /** Segmented model info pending for Segment workspace */
  pendingSegmentedModel: {
    assetId: string;
    modelUrl: string;
    numParts: number;
  } | null;
  setPendingSegmentedModel: (model: { assetId: string; modelUrl: string; numParts: number } | null) => void;
  /** Text-to-3D workflow: pending recon params after image generation */
  pendingTextTo3D: {
    assetId: string;
    params: Record<string, unknown>;
  } | null;
  setPendingTextTo3D: (pending: { assetId: string; params: Record<string, unknown> } | null) => void;
  /** Auth tokens */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  refreshToken: string | null;
  setRefreshToken: (token: string | null) => void;
  /** Configuration */
  apiBaseUrl: string | null;
  setApiBaseUrl: (url: string | null) => void;
  hostApp: string | null;
  setHostApp: (hostApp: string | null) => void;
  basePath: string | null;
  setBasePath: (basePath: string | null) => void;
  /** CDN base URL for static assets (e.g. HDRI, textures) — set from import.meta.url in WC mode, null in standalone */
  staticBase: string | null;
  setStaticBase: (staticBase: string | null) => void;
  user: string | null;
  setUser: (user: string) => void;
  /** Runtime mode: 'client' (full UI) or 'server' (API-only) */
  mode: PhidiasMode;
  setMode: (mode: PhidiasMode) => void;

  // ============================================================================
  // Job Management (Async Polling)
  // ============================================================================
  jobs: JobRecord[];
  addJob: (job: Omit<JobRecord, 'createdAt' | 'isNew'>) => void;
  updateJob: (jobId: string, updates: Partial<JobRecord>) => void;
  removeJob: (jobId: string) => void;
  markJobAsRead: (jobId: string) => void;
  markAllJobsAsRead: () => void;
  getJob: (jobId: string) => JobRecord | undefined;
  getActiveJobs: () => JobRecord[];
  getCompletedJobs: () => JobRecord[];
  getUnreadCount: () => number;

  /** Per-service concurrent connection counters */
  connections: ConnectionState;
  incrementConnection: (service: JobService) => void;
  decrementConnection: (service: JobService) => void;
  getConnectionCount: (service: JobService) => number;
  isConnectionAvailable: (service: JobService) => boolean;

  /** Polling error tracking for resilience */
  pollingState: PollingState;
  recordPollingError: (error: string) => void;
  clearPollingError: () => void;
  resumePolling: () => void;

  /** Reset store to initial state — clears all user data while preserving config */
  reset: () => void;
}

const MAX_CONNECTIONS_PER_SERVICE = 2;

// ============================================================================
// Initial State — used for store creation and logout reset
// ============================================================================

const INITIAL_STATE = {
  previewImage: null as string | null,
  pendingModelImage: null as string | null,
  pendingMultiViewImages: null as string[] | null,
  pendingImageResults: null as string[] | null,
  pendingAssetsForSegment: null as Array<{
    url: string;
    name: string;
    service: string;
    fileSize?: number;
    sourceAssetId?: string;
    numParts?: number;
  }> | null,
  pendingSegmentedModel: null as {
    assetId: string;
    modelUrl: string;
    numParts: number;
  } | null,
  pendingTextTo3D: null as {
    assetId: string;
    params: Record<string, unknown>;
  } | null,
  accessToken: null as string | null,
  refreshToken: null as string | null,
  apiBaseUrl: null as string | null,
  hostApp: null as string | null,
  basePath: null as string | null,
  staticBase: null as string | null,
  user: null as string | null,
  mode: 'client' as PhidiasMode,
  jobs: [] as JobRecord[],
  connections: { qwen: 0, reconviagen: 0, p3sam: 0, 'smart-organization': 0 } as ConnectionState,
  pollingState: { status: 'active', consecutiveFailures: 0, lastError: null, lastErrorTime: null } as PollingState,
};

export const usePhidiasStore = create<PhidiasState>((set, get) => ({
  previewImage: null,
  setPreviewImage: (url) => set({ previewImage: url }),
  pendingModelImage: null,
  setPendingModelImage: (url) => set({ pendingModelImage: url }),
  pendingMultiViewImages: null,
  setPendingMultiViewImages: (urls) => set({ pendingMultiViewImages: urls }),
  pendingImageResults: null,
  setPendingImageResults: (urls) => set({ pendingImageResults: urls }),
  processedImageJobIds: new Set<string>(),
  markImageJobProcessed: (jobId) => set((state) => {
    const next = new Set(state.processedImageJobIds);
    next.add(jobId);
    return { processedImageJobIds: next };
  }),
  processed3DJobIds: new Set<string>(),
  mark3DJobProcessed: (jobId) => set((state) => {
    const next = new Set(state.processed3DJobIds);
    next.add(jobId);
    return { processed3DJobIds: next };
  }),
  processedReconviagenJobIds: new Set<string>(),
  markReconviagenJobProcessed: (jobId) => set((state) => {
    const next = new Set(state.processedReconviagenJobIds);
    next.add(jobId);
    return { processedReconviagenJobIds: next };
  }),
  processedP3samJobIds: new Set<string>(),
  markP3samJobProcessed: (jobId) => set((state) => {
    const next = new Set(state.processedP3samJobIds);
    next.add(jobId);
    return { processedP3samJobIds: next };
  }),
  pendingAssetsForSegment: null,
  setPendingAssetsForSegment: (assets) => set({ pendingAssetsForSegment: assets }),
  pendingSegmentedModel: null,
  setPendingSegmentedModel: (model) => set({ pendingSegmentedModel: model }),
  pendingTextTo3D: null,
  setPendingTextTo3D: (pending) => set({ pendingTextTo3D: pending }),
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  refreshToken: null,
  setRefreshToken: (token) => set({ refreshToken: token }),
  apiBaseUrl: null,
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  hostApp: null,
  setHostApp: (hostApp) => set({ hostApp }),
  basePath: null,
  setBasePath: (basePath) => set({ basePath }),
  staticBase: null,
  setStaticBase: (staticBase) => set({ staticBase }),
  user: null,
  setUser: (user) => set({ user }),
  mode: 'client',
  setMode: (mode) => set({ mode }),

  // ============================================================================
  // Job Management
  // ============================================================================
  jobs: [],

  addJob: (job) =>
    set((state) => ({
      jobs: [
        ...state.jobs,
        {
          ...job,
          createdAt: new Date().toISOString(),
          isNew: true,
          progress: null, // default — will be updated by polling
        },
      ],
    })),

  updateJob: (jobId, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.jobId === jobId ? { ...job, ...updates } : job
      ),
    })),

  removeJob: (jobId) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.jobId !== jobId),
    })),

  markJobAsRead: (jobId) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.jobId === jobId ? { ...job, isNew: false } : job
      ),
    })),

  markAllJobsAsRead: () =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.status === 'completed' || job.status === 'failed'
          ? { ...job, isNew: false }
          : job
      ),
    })),

  getJob: (jobId) => get().jobs.find((job) => job.jobId === jobId),

  getActiveJobs: () =>
    get().jobs.filter(
      (job) => job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled'
    ),

  getCompletedJobs: () =>
    get().jobs.filter(
      (job) => job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    ),

  getUnreadCount: () =>
    get().jobs.filter(
      (job) =>
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && job.isNew
    ).length,

  // ============================================================================
  // Connection Management
  // ============================================================================
  connections: { qwen: 0, reconviagen: 0, p3sam: 0, 'smart-organization': 0 },

  incrementConnection: (service) =>
    set((state) => ({
      connections: {
        ...state.connections,
        [service]: state.connections[service] + 1,
      },
    })),

  decrementConnection: (service) =>
    set((state) => ({
      connections: {
        ...state.connections,
        [service]: Math.max(0, state.connections[service] - 1),
      },
    })),

  getConnectionCount: (service) => get().connections[service],

  isConnectionAvailable: (service) =>
    get().connections[service] < MAX_CONNECTIONS_PER_SERVICE,

  // ============================================================================
  // Polling Error Handling
  // ============================================================================
  pollingState: { status: 'active', consecutiveFailures: 0, lastError: null, lastErrorTime: null },

  recordPollingError: (error) => {
    const state = get();
    const newFailures = state.pollingState.consecutiveFailures + 1;
    const MAX_FAILURES = 3;

    if (newFailures >= MAX_FAILURES) {
      set({
        pollingState: {
          status: 'error',
          consecutiveFailures: newFailures,
          lastError: error,
          lastErrorTime: Date.now(),
        },
      });
    } else {
      set({
        pollingState: {
          ...state.pollingState,
          consecutiveFailures: newFailures,
          lastError: error,
          lastErrorTime: Date.now(),
        },
      });
    }
  },

  clearPollingError: () => {
    set({
      pollingState: { status: 'active', consecutiveFailures: 0, lastError: null, lastErrorTime: null },
    });
  },

  resumePolling: () => {
    set({
      pollingState: { status: 'active', consecutiveFailures: 0, lastError: null, lastErrorTime: null },
    });
  },

  // ============================================================================
  // Reset — Clear all user-specific state, preserve config
  // ============================================================================
  reset: () => {
    set({
      ...INITIAL_STATE,
      // Preserve config values that are not user-specific
      apiBaseUrl: get().apiBaseUrl,
      hostApp: get().hostApp,
      basePath: get().basePath,
      staticBase: get().staticBase,
      mode: get().mode,
    });
  },
}));
