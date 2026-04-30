/**
 * TypeScript equivalents of pegaverse-portal/server/external_services/phidias/app/schemas/phidias.py
 *
 * ── Naming convention ────────────────────────────────────────────────────────
 *  - Final*   : What the Next.js proxy returns to the frontend (mirrors Python Pydantic models).
 *  - *Upstream: Raw response from the internal micro-service before field mapping.
 */

// ── Job Polling ─────────────────────────────────────────────────────────────

export interface JobSubmitResponse {
  job_id: string;
  status: string;
  queue_position: number;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queue_position: number | null;
  created_at: string;
  result?: Record<string, unknown>;
  error?: {
    error_code: string;
    message: string;
  };
}

// ── VLM / Enhance ─────────────────────────────────────────────────────────────

export interface RenameRequest {
  image: string;
  prompt: string;
  api_url?: string;
  api_key?: string;
  model?: string;
}

export interface RenameResponse {
  name: string;
}

export interface GroupRequest {
  scene_graph: unknown;
  prompt: string;
  api_url?: string;
  api_key?: string;
  model?: string;
}

export interface GroupResponse {
  groups?: Record<string, unknown>[];
  hierarchy?: Record<string, unknown>;
}

export interface AnalyzeRequest {
  image: string;
  object_name: string;
  api_url?: string;
  api_key?: string;
  model?: string;
}

export interface AnalyzeResponse {
  categories: string[];
}

export interface ClassifyRequest {
  image: string;
  categories: string[];
  api_url?: string;
  api_key?: string;
  model?: string;
}

export interface ClassifyResponse {
  category: string;
}

// ── Smart Organize ────────────────────────────────────────────────────────────

export interface SmartOrganizePart {
  id: string;
  name: string;
  group: string;
}

export interface SmartOrganizeResponse {
  parts: SmartOrganizePart[];
}

// ── Qwen AI — Request ─────────────────────────────────────────────────────────

export interface QwenText2ImgRequest {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: string;
  num_steps?: number;
  cfg_scale?: number;
  seed?: number | null;
  num_samples?: number;
}

// ── Qwen AI — Final responses (returned to frontend) ─────────────────────────

export interface QwenText2ImgResponse {
  status: string;
  request_id: string;
  urls: string[];
  seeds: number[];
}

export interface QwenEditResponse {
  status: string;
  request_id: string;
  input_url: string;
  urls: string[];
  seeds: number[];
}

export interface QwenEditMultiResponse {
  status: string;
  request_id: string;
  count: number;
  inputs: string[];
  results: string[];
}

export interface QwenMultiImages {
  right: string;
  back: string;
  left: string;
}

export interface QwenMultiAngleResponse {
  status: string;
  request_id: string;
  input_url: string;
  results: QwenMultiImages;
}

export interface QwenErrorDetail {
  error_code: string;
  message: string;
}

export interface QwenErrorResponse {
  detail: QwenErrorDetail;
}

// ── Qwen AI — Raw upstream responses (from Qwen service, before field mapping) ─

export interface QwenText2ImgUpstream {
  request_id: string;
  urls: string[];
  seeds: number[];
}

export interface QwenEditUpstream {
  request_id: string;
  input_url: string;
  /** Qwen may return either result_urls (array) or result_url (single) */
  result_urls?: string[];
  result_url?: string;
  seeds: number[];
}

export interface QwenMultiAngleUpstream {
  request_id: string;
  input_url: string;
  results: QwenMultiImages;
}

// ── ReconViaGen — Final responses ─────────────────────────────────────────────

export interface ReconViaGenErrorDetail {
  error_code: string;
  message: string;
}

export interface ReconViaGenErrorResponse {
  detail: ReconViaGenErrorDetail;
}

export interface ReconViaGenOutput {
  status: string;
  request_id: string;
  glb_url: string;
  gaussian_video: string;
  radiance_video: string;
  mesh_video: string;
  ply_url: string;
  message?: string;
}

export interface BatchItemResult {
  index: number;
  original_filename?: string;
  status: 'success' | 'failed';
  glb_url?: string;
  gaussian_video?: string;
  radiance_video?: string;
  mesh_video?: string;
  ply_url?: string;
  error_code?: string;
  error?: string;
  message?: string;
}

export interface BatchGenerationResponse {
  total_count: number;
  succeeded: number;
  failed: number;
  results: BatchItemResult[];
  message?: string;
}

// ── ReconViaGen — Raw upstream response (before field mapping) ────────────────

export interface ReconViaGenUpstream {
  /** Path returned by the service; used to derive request_id */
  glb_file: string;
  gaussian_video: string;
  radiance_video: string;
  mesh_video: string;
  ply_file: string;
}

// ── SAM3D ─────────────────────────────────────────────────────────────────────

export interface SAM3DRequest {
  original_image: string;
  masked_images: string;
  seed?: number;
}

export interface SAM3DBatchRequest {
  original_image: string;
  masked_images: string[];
  seed?: number;
}

export interface SAM3DBatchResponse {
  status: string;
  glb_data_list: string[];
  count: number;
  message?: string;
}

// ── P3-SAM / Segmentation — Final response ────────────────────────────────────

export interface SegmentationErrorDetail {
  error_code: string;
  message: string;
}

export interface SegmentationErrorResponse {
  detail: SegmentationErrorDetail;
}

export interface SegmentationServiceResponse {
  status: string;
  request_id: string;
  num_parts: number;
  segmented_glb_url: string;
  message?: string;
}

// ── P3-SAM — Raw upstream response (before field mapping) ─────────────────────

export interface P3SamUpstream {
  request_id: string;
  num_parts: number;
  /** Mapped to segmented_glb_url in the final response */
  segmented_glb: string;
}
