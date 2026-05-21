export declare const PHIDIAS_TAG: string;
export declare const PHIDIAS_ATTRS: Record<string, string>;
export declare const PHIDIAS_EVENTS: {
  JOB_COMPLETE: string;
  JOB_ERROR: string;
  JOB_PROGRESS: string;
};
export declare function getPhidiasRequestConfig(): Record<string, unknown>;
export declare function configurePhidiasRequest(config?: Record<string, unknown>): void;
export interface JobCompleteDetail {
  jobId: string;
  result: unknown;
}
export interface PhidiasErrorDetail {
  message: string;
  code?: string;
}
export interface PhidiasRequestConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}
