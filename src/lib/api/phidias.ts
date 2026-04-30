import { client } from './client';
import { usePhidiasStore } from '../../store/phidias-store';
import type {
  ArticulationExportData,
  ArticulationExportResult,
} from './types';

function getBackendApi() {
  const backendApi = usePhidiasStore.getState().apiBaseUrl || '';
  return backendApi;
}

// ============================================================================
// Job Submission Response (new async pattern)
// ============================================================================

export interface JobSubmitResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queue_position: number;
}

export interface JobStatusResponse {
  job_id: string;
  status: string;
  queue_position: number | null;
  created_at: string;
  progress: { current: number; total: number } | null;
  result?: Record<string, unknown>;
  error?: { error_code: string; message: string };
}

// ============================================================================
// ReconViaGen Response Interfaces
// ============================================================================

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

// ============================================================================
// Segment 3D Response Interface (matches Python SegmentationServiceResponse)
// ============================================================================

export interface Segment3DResponse {
  status: string;
  request_id: string;
  num_parts: number;
  segmented_glb_url: string;
  message?: string;
}

// ============================================================================
// Qwen Response Interfaces (matches Python QwenText2ImgResponse)
// ============================================================================

export interface QwenAngleCustomResponse {
  status: string;
  url: string;
  request_id?: string;
}

export interface QwenMultiImages {
  right: string;
  back: string;
  left: string;
}

export interface QwenAngleMultiResponse {
  status: string;
  request_id: string;
  input_url: string;
  results: QwenMultiImages;
}

export async function generateImage3D(
  imageUrl: string,
  modelId: string,
  params: Record<string, unknown>,
  images: Record<string, unknown>,
) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/generate/image3d`,
    {
      image_url: imageUrl,
      model_id: modelId,
      images,
      ...params,
    },
    { timeout: 30000 },
  );
  return data;
}

export async function segment3D(
  file: File | Blob,
  params: {
    point_num?: number;
    prompt_num?: number;
    threshold?: number;
    post_process?: boolean;
    clean_mesh?: boolean;
    seed?: number;
    prompt_bs?: number;
  } = {},
  signal?: AbortSignal,
): Promise<JobSubmitResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (params.point_num !== undefined)
    formData.append('point_num', String(params.point_num));
  if (params.prompt_num !== undefined)
    formData.append('prompt_num', String(params.prompt_num));
  if (params.threshold !== undefined)
    formData.append('threshold', String(params.threshold));
  if (params.post_process !== undefined)
    formData.append('post_process', String(params.post_process));
  if (params.clean_mesh !== undefined)
    formData.append('clean_mesh', String(params.clean_mesh));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.prompt_bs !== undefined)
    formData.append('prompt_bs', String(params.prompt_bs));

  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/segment/3d`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
      signal,
    },
  );
  return data;
}

export async function generateSam3D(
  originalImage: string,
  maskedImage: string,
  seed = 42,
) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/generate/sam3d`,
    {
      original_image: originalImage,
      masked_image: maskedImage,
      seed,
    },
    { timeout: 30000 },
  );
  return data;
}

export async function generateSam3DBatch(
  originalImage: string,
  maskedImageArray: string[],
  seed = 42,
) {
  const maskedImages = maskedImageArray.length;
  const { data } = await client.post(
    `${getBackendApi()}/phidias/generate/sam3d/batch`,
    {
      original_image: originalImage,
      masked_images: maskedImageArray,
      seed,
    },
    { timeout: 30000 * Math.max(1, maskedImages) },
  );
  return data;
}

export async function sam3SetImage(imageBlob: Blob) {
  const formData = new FormData();
  formData.append('image', imageBlob, 'image.png');

  const { data } = await client.post(
    `${getBackendApi()}/phidias/segment/2d/set_image`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 6000,
    },
  );
  return data;
}

export async function sam3Predict(
  sessionId: string,
  pointCoords?: number[][],
  pointLabels?: number[],
  usePreviousMask = false,
  multimaskOutput = true,
) {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  if (pointCoords) formData.append('point_coords', JSON.stringify(pointCoords));
  if (pointLabels) formData.append('point_labels', JSON.stringify(pointLabels));
  formData.append('use_previous_mask', String(usePreviousMask));
  formData.append('multimask_output', String(multimaskOutput));

  const { data } = await client.post(
    `${getBackendApi()}/phidias/segment/2d/predict`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 6000,
    },
  );
  return data;
}

export async function sam3Apply(
  sessionId: string,
  pointCoords?: number[][],
  pointLabels?: number[],
  usePreviousMask = false,
) {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  if (pointCoords) formData.append('point_coords', JSON.stringify(pointCoords));
  if (pointLabels) formData.append('point_labels', JSON.stringify(pointLabels));
  formData.append('use_previous_mask', String(usePreviousMask));
  formData.append('return_rgba', 'true');

  const { data } = await client.post(
    `${getBackendApi()}/phidias/segment/2d/apply`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 6000,
    },
  );
  return data;
}

export async function sam3DeleteSession(sessionId: string) {
  const { data } = await client.delete(
    `${getBackendApi()}/phidias/segment/2d/session/${sessionId}`,
    {},
    { timeout: 6000 },
  );
  return data;
}

export async function enhanceRename(
  image: string,
  prompt: string,
  settings?: Record<string, unknown>,
) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/enhance/rename`,
    {
      image,
      prompt,
      api_url: settings?.vlmBaseUrl,
      api_key: settings?.vlmApiKey,
      model: settings?.vlmModel,
    },
  );
  return data;
}

export async function enhanceGroup(
  sceneGraph: unknown,
  prompt: string,
  settings?: Record<string, unknown>,
) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/enhance/group`,
    {
      scene_graph: sceneGraph,
      prompt,
      api_url: settings?.llmBaseUrl,
      api_key: settings?.llmApiKey,
      model: settings?.llmModel,
    },
  );
  return data;
}

export async function analyzeModel(
  image: string,
  objectName: string,
  settings?: Record<string, unknown>,
) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/enhance/analyze`,
    {
      image,
      object_name: objectName,
      api_url: settings?.vlmBaseUrl,
      api_key: settings?.vlmApiKey,
      model: settings?.vlmModel,
    },
  );
  return data;
}

export async function classifyPart(
  image: string,
  categories: string[],
  settings?: Record<string, unknown>,
) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/enhance/classify`,
    {
      image,
      categories,
      api_url: settings?.vlmBaseUrl,
      api_key: settings?.vlmApiKey,
      model: settings?.vlmModel,
    },
  );
  return data;
}

export async function generateReconSingle(
  file: File | Blob,
  params: {
    seed?: number;
    simplify?: number;
    texture_size?: number;
    ss_guidance_strength?: number;
    ss_sampling_steps?: number;
    slat_guidance_strength?: number;
    slat_sampling_steps?: number;
  } = {},
): Promise<JobSubmitResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.simplify !== undefined)
    formData.append('simplify', String(params.simplify));
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));
  if (params.ss_guidance_strength !== undefined)
    formData.append(
      'ss_guidance_strength',
      String(params.ss_guidance_strength),
    );
  if (params.ss_sampling_steps !== undefined)
    formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined)
    formData.append(
      'slat_guidance_strength',
      String(params.slat_guidance_strength),
    );
  if (params.slat_sampling_steps !== undefined)
    formData.append('slat_sampling_steps', String(params.slat_sampling_steps));

  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/reconviagen/generate-single`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min - temporary for backward compatibility
    },
  );
  return data;
}

export async function generateReconMulti(
  files: File[] | Blob[],
  params: {
    seed?: number;
    simplify?: number;
    texture_size?: number;
    ss_guidance_strength?: number;
    ss_sampling_steps?: number;
    slat_guidance_strength?: number;
    slat_sampling_steps?: number;
    multiimage_algo?: 'stochastic' | 'multidiffusion';
  } = {},
): Promise<JobSubmitResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.simplify !== undefined)
    formData.append('simplify', String(params.simplify));
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));
  if (params.ss_guidance_strength !== undefined)
    formData.append(
      'ss_guidance_strength',
      String(params.ss_guidance_strength),
    );
  if (params.ss_sampling_steps !== undefined)
    formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined)
    formData.append(
      'slat_guidance_strength',
      String(params.slat_guidance_strength),
    );
  if (params.slat_sampling_steps !== undefined)
    formData.append('slat_sampling_steps', String(params.slat_sampling_steps));
  if (params.multiimage_algo !== undefined)
    formData.append('multiimage_algo', String(params.multiimage_algo));

  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/reconviagen/generate-multi`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min - temporary for backward compatibility
    },
  );
  return data;
}

export async function generateReconBatch(
  files: File[] | Blob[],
  params: {
    seed?: number;
    simplify?: number;
    texture_size?: number;
    ss_guidance_strength?: number;
    ss_sampling_steps?: number;
    slat_guidance_strength?: number;
    slat_sampling_steps?: number;
  } = {},
): Promise<JobSubmitResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.simplify !== undefined)
    formData.append('simplify', String(params.simplify));
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));
  if (params.ss_guidance_strength !== undefined)
    formData.append(
      'ss_guidance_strength',
      String(params.ss_guidance_strength),
    );
  if (params.ss_sampling_steps !== undefined)
    formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined)
    formData.append(
      'slat_guidance_strength',
      String(params.slat_guidance_strength),
    );
  if (params.slat_sampling_steps !== undefined)
    formData.append('slat_sampling_steps', String(params.slat_sampling_steps));

  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/reconviagen/generate-batch`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min - temporary for backward compatibility
    },
  );
  return data;
}


// ============================================================================
// Smart Organize Interfaces (matches Python schemas)
// ============================================================================

export interface SmartOrganizePart {
  id: string;
  color: string;
  name?: string;
  group?: string;
}

export interface SmartOrganizeResult {
  id: string;
  name: string;
  group: string;
}

export interface SmartOrganizeResponse {
  parts: SmartOrganizeResult[];
}

/**
 * Orchestrates the smart organization of 3D model parts using a VLM.
 * Cross-references original textures with color-coded segmentation views.
 * Sends data to Python backend for processing.
 */
export async function smartOrganize(
  parts: SmartOrganizePart[],
  originalFiles: (File | Blob)[],
  coloredFiles: (File | Blob)[],
  angleLabels: string[],
  _settings?: Record<string, unknown>,
): Promise<SmartOrganizeResponse> {
  const formData = new FormData();
  formData.append('parts', JSON.stringify(parts));
  if (angleLabels && angleLabels.length > 0) {
    formData.append('angles', JSON.stringify(angleLabels));
  }
  originalFiles.forEach((file, idx) => {
    formData.append('original', file, `original_${idx}.png`);
  });
  coloredFiles.forEach((file, idx) => {
    formData.append('colored', file, `colored_${idx}.png`);
  });

  const { data } = await client.post<SmartOrganizeResponse>(
    `${getBackendApi()}/phidias/smart-organize`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    },
  );
  return data;
}

export interface QwenText2ImgResponse {
  status: string;
  request_id: string;
  urls: string[];
  seeds: number[];
}

export interface QwenEditResponse {
  status: string;
  request_id: string;
  /**
   * Result image URLs. Historically called `urls` (old sync backend) and
   * `result_urls` (new polling backend). Both optional; readers should try
   * urls first and fall back to result_urls.
   */
  urls?: string[];
  result_urls?: string[];
  input_url: string;
  seeds: number[];
}

/**
 * Cancel a queued job on the backend.
 * Returns 409 if the job is already processing (cannot be cancelled).
 */
export async function cancelJob(
  jobId: string,
  service: 'qwen' | 'reconviagen' | 'p3sam' | 'smart-organization',
): Promise<{ job_id: string; status: string }> {
  const pathMap = {
    qwen: 'qwen',
    reconviagen: 'reconviagen',
    p3sam: 'segment/3d',
    'smart-organization': 'smart-organize',
  };
  const { data } = await client.delete<{ job_id: string; status: string }>(
    `${getBackendApi()}/phidias/${pathMap[service]}/jobs/${jobId}`,
    {},
    { timeout: 10000 },
  );
  return data;
}

/**
 * Downloads an image from the server using the specific request_id and filename.
 */
export async function downloadPhidiasImage(
  requestId: string,
  fileName: string,
  model: string,
): Promise<Blob> {
  const { data } = await client.get<Blob>(
    `${getBackendApi()}/phidias/${model}/download/${requestId}/${fileName}`,
    {
      timeout: 60000,
    },
  );
  return data;
}

/**
 * Helper to convert a Blob to a Data URL (base64 string).
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateText2Img(
  prompt: string,
  params: Record<string, unknown> = {},
): Promise<JobSubmitResponse> {
  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/qwen/text2img`,
    {
      prompt,
      ...params,
    },
    { timeout: 60000 }, // 60s timeout for job submission (in case queue is full)
  );

  return data;
}

export async function editImage(
  imageBlob: File | Blob,
  prompt: string,
  params: Record<string, unknown> = {},
): Promise<JobSubmitResponse> {
  const formData = new FormData();
  formData.append('file', imageBlob);
  formData.append('prompt', prompt);
  if (params.steps !== undefined)
    formData.append('steps', String(params.steps));
  if (params.cfg_scale !== undefined)
    formData.append('cfg_scale', String(params.cfg_scale));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.num_samples !== undefined)
    formData.append('num_samples', String(params.num_samples));
  if (params.negative_prompt !== undefined && params.negative_prompt !== null)
    formData.append('negative_prompt', String(params.negative_prompt));

  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/qwen/edit`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000, // Short timeout for job submission
    },
  );

  return data;
}

export async function generateAngleCustom(
  imageBlob: Blob,
  params: Record<string, unknown> = {},
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'image.png');
  formData.append('mode', 'custom');
  formData.append('azimuth', String(params.azimuth ?? 0));
  formData.append('elevation', String(params.elevation ?? 0));
  formData.append('distance', String(params.distance ?? 1.0));

  const { data } = await client.post<QwenAngleCustomResponse>(
    `${getBackendApi()}/phidias/qwen/angle/custom`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );

  // Fallback logic for request_id if not present in custom response
  const urlParts = data.url.split('/');
  const fileName = urlParts.pop() || '';
  const requestId = data.request_id || urlParts.pop() || '';

  return await downloadPhidiasImage(requestId, fileName, 'qwen');
}

export async function generateAngleMulti(
  imageBlob: Blob,
  params: Record<string, unknown> = {},
): Promise<JobSubmitResponse> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'image.png');
  formData.append('mode', 'multi');
  formData.append('azimuth', String(params.azimuth ?? 0));
  formData.append('elevation', String(params.elevation ?? 0));
  formData.append('distance', String(params.distance ?? 1.0));

  const { data } = await client.post<JobSubmitResponse>(
    `${getBackendApi()}/phidias/qwen/angle/multi`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000, // Short timeout for job submission
    },
  );

  return data;
}

// ============================================================================
// ── Legacy async API (Texture / Physics tabs) ───────────────────────────────
// Functions in this section preserve the pre-polling callback/direct-result
// async patterns that the Texture and Physics tabs (ported from the old repo)
// expect. Do NOT merge these into the polling-style variants above — they
// return fully-resolved results, not job submission handles.
// ============================================================================

/**
 * Texturing pipeline against Trellis.2 backend.
 * Returns a fully-resolved ReconViaGenOutput (NOT a polling handle).
 *
 * Ported verbatim from old repo phidias.ts lines 438-476 (commit 85f68d6).
 */
export async function textureTrellis(
  referenceImage: File | Blob,
  meshFile: File | Blob,
  params: {
    seed?: number;
    resolution?: number;
    texture_size?: number;
  } = {},
): Promise<ReconViaGenOutput> {
  const formData = new FormData();
  // Ensure blobs have correct MIME type and filename for FastAPI validation
  const imgBlob = new File(
    [referenceImage],
    'reference.png',
    { type: referenceImage.type || 'image/png' },
  );
  const glbBlob = new File(
    [meshFile],
    'model.glb',
    { type: meshFile.type || 'model/gltf-binary' },
  );
  formData.append('file', imgBlob, 'reference.png');
  formData.append('mesh_file', glbBlob, 'model.glb');
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.resolution !== undefined)
    formData.append('resolution', String(params.resolution));
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/trellis2/texture`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}

/**
 * Legacy direct-result Qwen edit pipeline: POSTs to /qwen/edit, then downloads
 * every image URL in the response and converts each to a data URL, returning
 * the enriched QwenEditResponse synchronously.
 *
 * NOTE: the new repo's `editImage` returns a JobSubmitResponse for polling.
 * This function keeps the OLD direct-result contract for the Texture tab.
 *
 * Ported verbatim from old repo phidias.ts lines 760-797 (commit 85f68d6).
 */
export async function editImageLegacy(
  imageBlob: File | Blob,
  prompt: string,
  params: Record<string, unknown> = {},
): Promise<QwenEditResponse> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'image.png');
  formData.append('prompt', prompt);
  if (params.steps !== undefined)
    formData.append('steps', String(params.steps));
  if (params.cfg_scale !== undefined)
    formData.append('cfg_scale', String(params.cfg_scale));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.num_samples !== undefined)
    formData.append('num_samples', String(params.num_samples));

  // Submit. Backend may respond in one of two shapes depending on whether
  // /qwen/edit was migrated to polling:
  //   - Sync (legacy): { status, request_id, urls, input_url, seeds }
  //   - Polling (new): { job_id, status, queue_position }
  // We auto-detect and poll if needed, so callers keep the sync API.
  const submitRes = await client.post<QwenEditResponse | JobSubmitResponse>(
    `${getBackendApi()}/phidias/qwen/edit`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    },
  );

  let data: QwenEditResponse;
  let effectiveDownloadId: string;
  const submitData = submitRes.data as Partial<QwenEditResponse> & Partial<JobSubmitResponse>;

  // Detection: any response carrying a job_id is polling-style — even if the
  // response ALSO carries an empty urls array (which is truthy in JS and
  // previously caused the sync branch to fire with zero usable URLs).
  if (submitData.job_id) {
    // Polling-style backend. Poll /phidias/qwen/jobs/{jobId} until completed.
    const jobId = submitData.job_id;
    const startedAt = Date.now();
    const POLL_TIMEOUT_MS = 300000; // 5 min
    const POLL_INTERVAL_MS = 3000;
    let polledResult: QwenEditResponse | null = null;

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      const { data: pollRes } = await client.get<{
        status: 'queued' | 'processing' | 'completed' | 'failed';
        result?: QwenEditResponse;
        error?: { error_code: string; message: string };
      }>(`${getBackendApi()}/phidias/qwen/jobs/${jobId}`, { timeout: 10000 });

      if (pollRes.status === 'completed' && pollRes.result) {
        polledResult = pollRes.result;
        break;
      }
      if (pollRes.status === 'failed') {
        throw new Error(
          `Qwen edit job failed: ${pollRes.error?.message ?? 'unknown error'}`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (!polledResult) {
      throw new Error('Qwen edit polling timed out after 5 minutes');
    }
    data = polledResult;
    // For polling backend, the download URL uses jobId as the path segment
    // (matches useJobDownload's /phidias/qwen/download/{jobId}/{fileName}).
    // polledResult.request_id may or may not be populated — prefer jobId.
    effectiveDownloadId = polledResult.request_id || jobId;
  } else {
    // Sync-style backend (original legacy behavior). Use the response as-is.
    data = submitRes.data as QwenEditResponse;
    effectiveDownloadId = data.request_id;
  }

  // Backend returns image URLs under either `urls` (sync) or `result_urls`
  // (polling). Prefer urls; fall back to result_urls; either way normalise
  // the final response to `urls` so callers have one predictable field.
  const sourceUrls = data.urls ?? data.result_urls ?? [];
  const downloadedUrls = await Promise.all(
    sourceUrls.map(async (url) => {
      const fileName = url.split('/').pop() || '';
      const blob = await downloadPhidiasImage(effectiveDownloadId, fileName, 'qwen');
      return await blobToDataURL(blob);
    }),
  );

  return { ...data, urls: downloadedUrls };
}

/**
 * Export articulation as USDA file via Physics backend.
 * Ported verbatim from old repo phidias.ts lines 875-897 (commit 85f68d6).
 */
export async function exportArticulationUsda(
  exportData: ArticulationExportData,
): Promise<ArticulationExportResult> {
  const formData = new FormData();
  formData.append('file', exportData.glb_file);
  formData.append(
    'articulation',
    JSON.stringify({
      model_name: exportData.model_name,
      parts: exportData.parts,
      joints: exportData.joints,
    }),
  );
  const { data } = await client.post<ArticulationExportResult>(
    `${getBackendApi()}/phidias/articulation/export-usda`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  return data;
}

/**
 * Export articulation as USDZ file via Physics backend.
 * Ported verbatim from old repo phidias.ts lines 899-921 (commit 85f68d6).
 */
export async function exportArticulationUsdz(
  exportData: ArticulationExportData,
): Promise<ArticulationExportResult> {
  const formData = new FormData();
  formData.append('file', exportData.glb_file);
  formData.append(
    'articulation',
    JSON.stringify({
      model_name: exportData.model_name,
      parts: exportData.parts,
      joints: exportData.joints,
    }),
  );
  const { data } = await client.post<ArticulationExportResult>(
    `${getBackendApi()}/phidias/articulation/export-usdz`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  return data;
}

/**
 * Download an articulation export file by filename.
 * Ported verbatim from old repo phidias.ts lines 923-931 (commit 85f68d6).
 */
export async function downloadArticulationFile(
  filename: string,
): Promise<Blob> {
  const { data } = await client.get<Blob>(
    `${getBackendApi()}/phidias/articulation/download/${filename}`,
    { timeout: 60000 },
  );
  return data;
}

/**
 * Single-image 3D generation via TRELLIS.2 backend (direct-result, not polling).
 * Gated by FEATURES.TRELLIS2_BACKEND — only used when Model tab is flipped to
 * TRELLIS.2 routing. Ported verbatim from old repo phidias.ts lines 390-431
 * (commit 85f68d6). Sends to /phidias/trellis2/generate via the proxy route
 * added in Phase 1.
 */
export async function generateTrellis(
  file: File | Blob,
  params: {
    seed?: number;
    pipeline_type?: '512' | '1024' | '1024_cascade' | '1536_cascade';
    texture_size?: number;
    decimation_target?: number;
    remesh?: boolean;
    ss_guidance_strength?: number;
    ss_sampling_steps?: number;
    slat_guidance_strength?: number;
    slat_sampling_steps?: number;
  } = {},
): Promise<ReconViaGenOutput> {
  const formData = new FormData();
  formData.append('file', file);
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.pipeline_type !== undefined)
    formData.append('pipeline_type', params.pipeline_type);
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));
  if (params.decimation_target !== undefined)
    formData.append('decimation_target', String(params.decimation_target));
  if (params.remesh !== undefined)
    formData.append('remesh', String(params.remesh));
  if (params.ss_guidance_strength !== undefined)
    formData.append('ss_guidance_strength', String(params.ss_guidance_strength));
  if (params.ss_sampling_steps !== undefined)
    formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined)
    formData.append('slat_guidance_strength', String(params.slat_guidance_strength));
  if (params.slat_sampling_steps !== undefined)
    formData.append('slat_sampling_steps', String(params.slat_sampling_steps));

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/trellis2/generate`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}

export async function generateTrellisMulti(
  files: File[] | Blob[],
  params: {
    seed?: number;
    pipeline_type?: '512' | '1024' | '1024_cascade' | '1536_cascade';
    texture_size?: number;
    decimation_target?: number;
    remesh?: boolean;
    ss_guidance_strength?: number;
    ss_sampling_steps?: number;
    slat_guidance_strength?: number;
    slat_sampling_steps?: number;
  } = {},
): Promise<ReconViaGenOutput> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.pipeline_type !== undefined)
    formData.append('pipeline_type', params.pipeline_type);
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));
  if (params.decimation_target !== undefined)
    formData.append('decimation_target', String(params.decimation_target));
  if (params.remesh !== undefined)
    formData.append('remesh', String(params.remesh));
  if (params.ss_guidance_strength !== undefined)
    formData.append('ss_guidance_strength', String(params.ss_guidance_strength));
  if (params.ss_sampling_steps !== undefined)
    formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined)
    formData.append('slat_guidance_strength', String(params.slat_guidance_strength));
  if (params.slat_sampling_steps !== undefined)
    formData.append('slat_sampling_steps', String(params.slat_sampling_steps));

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/trellis2/generate-multi`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}
