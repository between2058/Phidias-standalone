/**
 * Qwen Image Generation API Client
 * Server: http://localhost:8190 (qwen_image_api.py)
 *
 * Pipeline for Text-to-3D:
 *   POST /text2img → { request_id, url } → GET /download/{id}/output.png → File
 */

const QWEN_BASE_URL = 'http://localhost:8190';

export interface QwenText2ImgRequest {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: string;
  num_steps?: number;
  cfg_scale?: number;
  seed?: number;
}

export interface QwenText2ImgResponse {
  status: string;
  request_id: string;
  url: string; // relative path: /download/{id}/output.png
}

/**
 * Call Qwen /text2img endpoint and return the generated image as a File.
 * Throws on HTTP error or non-success status.
 */
export async function qwenText2Img(req: QwenText2ImgRequest): Promise<File> {
  const response = await fetch(`${QWEN_BASE_URL}/text2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: req.prompt,
      negative_prompt:
        req.negative_prompt ?? 'low quality, bad anatomy, blurry, distorted',
      aspect_ratio: req.aspect_ratio ?? '1:1',
      num_steps: req.num_steps ?? 50,
      cfg_scale: req.cfg_scale ?? 4.0,
      seed: req.seed ?? 42,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Qwen /text2img failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: QwenText2ImgResponse = await response.json();

  if (data.status !== 'success') {
    throw new Error(`Qwen returned non-success status: ${data.status}`);
  }

  // Download the generated image
  const imageUrl = `${QWEN_BASE_URL}${data.url}`;
  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download Qwen output image: ${imageResponse.status}`,
    );
  }

  const blob = await imageResponse.blob();
  return new File([blob], 'qwen_output.png', { type: 'image/png' });
}

export interface QwenEditResponse {
  status: string;
  request_id: string;
  input_url: string;
  result_url: string; // relative: /download/{id}/result.png
}

/**
 * Call Qwen /edit endpoint — edits an image with a text prompt.
 * Used for texture mode: render of current GLB (or source image) → Qwen style transfer → TRELLIS.2 reference.
 *
 * @param imageFile  The reference image (rendered GLB screenshot or original source image)
 * @param prompt     Text description of the desired texture/style
 */
export async function qwenEditImage(
  imageFile: File,
  prompt: string,
  opts: { steps?: number; cfgScale?: number; seed?: number } = {},
): Promise<File> {
  const form = new FormData();
  form.append('file', imageFile);
  form.append('prompt', prompt);
  if (opts.steps !== undefined) form.append('steps', String(opts.steps));
  if (opts.cfgScale !== undefined)
    form.append('cfg_scale', String(opts.cfgScale));
  if (opts.seed !== undefined) form.append('seed', String(opts.seed));

  const response = await fetch(`${QWEN_BASE_URL}/edit`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(
      `Qwen /edit failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: QwenEditResponse = await response.json();

  if (data.status !== 'success') {
    throw new Error(`Qwen /edit returned non-success status: ${data.status}`);
  }

  const imageResponse = await fetch(`${QWEN_BASE_URL}${data.result_url}`);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download Qwen edit result: ${imageResponse.status}`,
    );
  }

  const blob = await imageResponse.blob();
  return new File([blob], 'qwen_edit_result.png', { type: 'image/png' });
}

/**
 * Returns the full download URL for a given request_id and filename.
 */
export function qwenDownloadUrl(
  requestId: string,
  fileName = 'output.png',
): string {
  return `${QWEN_BASE_URL}/download/${requestId}/${fileName}`;
}
