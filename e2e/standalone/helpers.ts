/**
 * Shared helpers for standalone E2E tests.
 */

import { type Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export const TEST_GLB_PATH = path.join(__dirname, '../fixtures/test-model.glb');
export const GLB_EXISTS = fs.existsSync(TEST_GLB_PATH);

// Real JPEG image (1290×1607) — required for API endpoints that run PIL Image.open().
// TINY_PNG (1×1 px, ~68 bytes) causes "OSError: broken data stream" in PIL.
export const TEST_IMAGE_PATH = path.join(__dirname, '../fixtures/test-image.jpg');
export const TEST_IMAGE = fs.readFileSync(TEST_IMAGE_PATH);

/** Build a minimal (geometry-less) GLB buffer for UI-level testing. */
export function buildMinimalGlb(): Buffer {
  const jsonStr = '{"asset":{"version":"2.0"}}';
  const padding = (4 - (jsonStr.length % 4)) % 4;
  const jsonData = Buffer.from(jsonStr + ' '.repeat(padding), 'ascii');
  const totalLen = 12 + 8 + jsonData.length;
  const buf = Buffer.allocUnsafe(totalLen);
  let o = 0;
  buf.writeUInt32LE(0x46546C67, o); o += 4;
  buf.writeUInt32LE(2, o); o += 4;
  buf.writeUInt32LE(totalLen, o); o += 4;
  buf.writeUInt32LE(jsonData.length, o); o += 4;
  buf.writeUInt32LE(0x4E4F534A, o); o += 4;
  jsonData.copy(buf, o);
  return buf;
}

/** Navigate to the image workspace and wait for it to load. */
export async function goToImageWorkspace(page: Page): Promise<void> {
  await page.goto('/workspace/image');
  await expect(page.locator('textarea, input[type="text"]').first()).toBeAttached({ timeout: 30_000 });
}

/** Navigate to the model workspace and wait for it to load. */
export async function goToModelWorkspace(page: Page): Promise<void> {
  await page.goto('/workspace/model');
  await expect(page.getByRole('button', { name: /generate/i }).first()).toBeAttached({ timeout: 30_000 });
}

/** Navigate to the segment workspace and wait for it to load. */
export async function goToSegmentWorkspace(page: Page): Promise<void> {
  await page.goto('/workspace/segment');
  await expect(page.locator('input[type="file"], [class*="upload"], [class*="drop"]').first()).toBeAttached({ timeout: 30_000 });
}

/**
 * Fill prompt and click Generate in the image workspace.
 * Returns after clicking the generate button (does NOT wait for completion).
 */
export async function triggerImageGeneration(page: Page, prompt: string): Promise<void> {
  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 30_000 });
  await promptInput.fill(prompt);
  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();
}

/**
 * Upload an image to the model workspace (Image mode) and click generate.
 * Does NOT wait for 3D generation to complete.
 */
export async function uploadImageAndGenerate(page: Page): Promise<void> {
  const imageTab = page.getByRole('button', { name: /image/i }).first();
  if (await imageTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await imageTab.click();
  }
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE });
  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();
}

/**
 * Wait for a 3D model to appear in the viewport.
 * This waits for a real API response — keep a long timeout.
 */
export async function waitForModelInViewport(page: Page): Promise<void> {
  await expect(
    page.locator('[class*="hierarchy"], [class*="scene"], canvas').first(),
  ).toBeVisible({ timeout: 300_000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000 });
}

/**
 * Run full segmentation: upload GLB and click Start Segmentation.
 * Waits for segmentation to complete — keep long timeouts (real API).
 */
export async function runSegmentation(page: Page, glbBuffer: Buffer, filename = 'test-model.glb'): Promise<void> {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: filename, mimeType: 'model/gltf-binary', buffer: glbBuffer });

  const startBtn = page.getByRole('button', { name: /start segmentation/i }).first();
  await expect(startBtn).toBeEnabled({ timeout: 30_000 });
  await startBtn.click();

  // Wait for segmentation to start then finish — real API, long timeout
  // Use .first() to avoid strict-mode violation: both the button inner span and
  // a standalone <span>Segmenting</span> may be present simultaneously.
  await expect(page.getByText(/segmenting/i).first()).toBeVisible({ timeout: 300_000 }).catch(() => { });
  await expect(page.getByText(/segmenting/i).first()).not.toBeVisible({ timeout: 300_000 });
}
