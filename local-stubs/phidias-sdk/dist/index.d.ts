export declare const PHIDIAS_TAG: string;
export declare const PHIDIAS_ATTRS: {
  BASE_PATH: string;
  API_BASE_URL: string;
  HOST_APP: string;
  USER: string;
  [key: string]: string;
};
export declare const PHIDIAS_EVENTS: {
  JOB_COMPLETE: string;
  JOB_ERROR: string;
  JOB_PROGRESS: string;
  GET_ASSETS: string;
  UPLOAD_ASSETS: string;
  ERROR: string;
  [key: string]: string;
};

export interface PhidiasRequestConfig {
  [key: string]: unknown;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface JobCompleteDetail {
  jobId: string;
  service: string;
  type: string;
  status: 'completed' | 'failed';
  error?: unknown;
  [key: string]: unknown;
}

export interface PhidiasErrorDetail {
  type: string;
  message: string;
  stack?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface PhidiasRequestConfigFull {
  defaultTimeout?: number;
  getAuthToken: () => Promise<string | null>;
  onAuthFailure: (err: Error) => void;
  onRequest: (url: string, init: RequestInit) => Promise<RequestInit>;
  retryDelay: (attempt: number) => number;
  shouldRetry: (errorOrResponse: unknown, attempt?: number) => boolean;
  onError: (err: unknown, context?: Record<string, unknown>) => void;
  [key: string]: unknown;
}

export declare function getPhidiasRequestConfig(): PhidiasRequestConfigFull;
export declare function configurePhidiasRequest(config?: PhidiasRequestConfig): void;
