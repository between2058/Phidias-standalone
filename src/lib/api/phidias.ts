import { client } from './client';
import { usePhidiasStore } from '../../store/phidias-store';

function getBackendApi() {
  const backendApi = usePhidiasStore.getState().apiBaseUrl || '';
  return backendApi;
}

// ============================================================================
// ReconViaGen Response Interfaces (matches Python ReconViaGenOutput schema)
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
): Promise<Segment3DResponse> {
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

  const { data } = await client.post<Segment3DResponse>(
    `${getBackendApi()}/phidias/segment/3d`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
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

export async function generateTrellisMulti(images: string[], params?: Record<string, unknown>) {
  const { data } = await client.post(
    `${getBackendApi()}/phidias/generate/trellis/multi`,
    {
      images,
      seed: params?.seed ?? 1,
      simplify: params?.simplify ?? 0.95,
      ss_sampling_steps: params?.ss_sampling_steps ?? 12,
      ss_guidance_strength: params?.ss_guidance_strength ?? 7.5,
      slat_sampling_steps: params?.slat_sampling_steps ?? 12,
      slat_guidance_strength: params?.slat_guidance_strength ?? 3.0,
    },
    { timeout: 90000 },
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
): Promise<ReconViaGenOutput> {
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

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/reconviagen/generate-single`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}

// ============================================================================
// Trellis.2 Generation (single image → 3D)
// ============================================================================

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

/**
 * Texture an existing mesh using a reference image via Trellis.2.
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
): Promise<ReconViaGenOutput> {
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

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/reconviagen/generate-multi`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
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
): Promise<BatchGenerationResponse> {
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

  const { data } = await client.post<BatchGenerationResponse>(
    `${getBackendApi()}/phidias/reconviagen/generate-batch`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
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
  settings?: Record<string, unknown>,
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
  urls: string[];
  input_url: string;
  seeds: number[];
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
): Promise<QwenText2ImgResponse> {
  const formData = new FormData();
  formData.append('prompt', prompt);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) formData.append(key, String(val));
  }

  const { data } = await client.post<QwenText2ImgResponse>(
    `${getBackendApi()}/phidias/qwen/text2img`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );

  const requestId = data.request_id;
  const downloadedUrls = await Promise.all(
    (data.urls || []).map(async (url) => {
      const fileName = url.split('/').pop() || '';
      const blob = await downloadPhidiasImage(requestId, fileName, 'qwen');
      return await blobToDataURL(blob);
    }),
  );

  return { ...data, urls: downloadedUrls };
}

export async function editImage(
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

  const { data } = await client.post<QwenEditResponse>(
    `${getBackendApi()}/phidias/qwen/edit`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );

  const requestId = data.request_id;
  const downloadedUrls = await Promise.all(
    (data.urls || []).map(async (url) => {
      const fileName = url.split('/').pop() || '';
      const blob = await downloadPhidiasImage(requestId, fileName, 'qwen');
      return await blobToDataURL(blob);
    }),
  );

  return { ...data, urls: downloadedUrls };
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
): Promise<string[]> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'image.png');
  formData.append('mode', 'multi');
  formData.append('azimuth', String(params.azimuth ?? 0));
  formData.append('elevation', String(params.elevation ?? 0));
  formData.append('distance', String(params.distance ?? 1.0));

  const { data } = await client.post<QwenAngleMultiResponse>(
    `${getBackendApi()}/phidias/qwen/angle/multi`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );

  const requestId = data.request_id;
  const results = data.results || ({} as QwenMultiImages);
  const urls = Object.values(results) as string[];
  return await Promise.all(
    urls.map(async (url) => {
      const fileName = url.split('/').pop() || '';
      const blob = await downloadPhidiasImage(requestId, fileName, 'qwen');
      return await blobToDataURL(blob);
    }),
  );
}
