/**
 * Shared helpers for portal-integration tests.
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

/** Build a minimal (geometry-less) GLB buffer for UI-level testing. */
export function buildMinimalGlb(): Buffer {
  const jsonStr = '{"asset":{"version":"2.0"}}';
  const padding = (4 - (jsonStr.length % 4)) % 4;
  const jsonData = Buffer.from(jsonStr + ' '.repeat(padding), 'ascii');
  const totalLen = 12 + 8 + jsonData.length;
  const buf = Buffer.allocUnsafe(totalLen);
  let o = 0;
  buf.writeUInt32LE(0x46546C67, o); o += 4;
  buf.writeUInt32LE(2, o);          o += 4;
  buf.writeUInt32LE(totalLen, o);   o += 4;
  buf.writeUInt32LE(jsonData.length, o); o += 4;
  buf.writeUInt32LE(0x4E4F534A, o); o += 4;
  jsonData.copy(buf, o);
  return buf;
}

/**
 * Navigate to the Phidias section in the portal and wait for phidias-app
 * custom element to be attached to the DOM.
 *
 * The portal exposes Phidias at /phidias (base-path="phidias").
 */
export async function goToPhidias(page: Page): Promise<void> {
  await page.goto('/phidias');
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });
}

/**
 * Navigate to a specific Phidias workspace inside the portal.
 * base-path is /phidias, so workspace paths are /phidias/workspace/*.
 */
export async function goToPhidiasWorkspace(
  page: Page,
  workspace: 'model' | 'image' | 'segment',
): Promise<void> {
  await page.goto(`/phidias/workspace/${workspace}`);
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 20_000 });
}

/**
 * Generate a model in the portal's Phidias WC and wait for it to appear in
 * the Asset Panel. Returns after the asset card is visible.
 * timeout: 360_000 ms
 */
export async function generateModelInPortal(page: Page): Promise<void> {
  await goToPhidiasWorkspace(page, 'model');

  const imageTab = page.getByRole('button', { name: /^image$/i }).first();
  if (await imageTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
  await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: TINY_PNG });

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();

  // Wait for asset to appear in Asset Panel (empty state must leave)
  const emptyState = page.getByText(/3D model will appear here/i);
  await expect(emptyState).not.toBeVisible({ timeout: 360_000 });

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  await expect(assetCard).toBeVisible({ timeout: 10_000 });
}
