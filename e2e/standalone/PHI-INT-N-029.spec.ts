// kiwi_test_id: PHI-INT-N-029
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, GLB_EXISTS, TEST_GLB_PATH } from './helpers';
import fs from 'fs';

test('PHI-INT-N-029 | 3D segmentation — custom parameters', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  // Set custom parameters before uploading
  const pointDensityInput = page.getByLabel(/point.?density/i)
    .or(page.locator('input[name*="point" i]')).first();
  if (await pointDensityInput.isVisible({ timeout: 300_000}).catch(() => false)) {
    await pointDensityInput.fill('1024');
  }

  const areaThresholdInput = page.getByLabel(/area.?threshold/i)
    .or(page.locator('input[name*="area" i]')).first();
  if (await areaThresholdInput.isVisible({ timeout: 300_000}).catch(() => false)) {
    await areaThresholdInput.fill('0.6');
  }

  const seedInput = page.getByLabel(/seed/i).first();
  if (await seedInput.isVisible({ timeout: 300_000}).catch(() => false)) {
    await seedInput.fill('7');
  }

  // Upload and segment
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 300_000});
  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await fileInput.setInputFiles({ name: 'test-model.glb', mimeType: 'model/gltf-binary', buffer: glbBuffer });

  const startBtn = page.getByRole('button', { name: /start segmentation/i }).first();
  await expect(startBtn).toBeEnabled({ timeout: 300_000});
  await startBtn.click();

  await expect(page.getByText(/segmenting/i).first()).not.toBeVisible({ timeout: 300_000});
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});
});
