// kiwi_test_id: PHI-INT-N-032
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH } from './helpers';
import fs from 'fs';

test('PHI-INT-N-032 | 3D segmentation — part visibility toggle', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Find visibility toggle (eye icon) for first part
  const eyeToggle = page.getByRole('button', { name: /visibility|hide|show|eye/i }).first()
    .or(page.locator('[aria-label*="visibility" i], [aria-label*="eye" i], [class*="eye"], [class*="visibility"]').first());
  await expect(eyeToggle).toBeVisible({ timeout: 300_000});

  // Toggle off
  await eyeToggle.click();

  // Toggle back on
  await eyeToggle.click();

  // Canvas still visible (no crash)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});
});
