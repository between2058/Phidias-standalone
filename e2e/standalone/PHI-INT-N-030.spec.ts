// kiwi_test_id: PHI-INT-N-030
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH, buildMinimalGlb } from './helpers';
import fs from 'fs';

test('PHI-INT-N-030 | 3D segmentation — color-coded parts visualization', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);

  // Parts panel shows color dots for each part
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Each part item should have a color indicator
  const colorDots = page.locator('[class*="color"], [class*="dot"], [style*="background"]');
  await expect(colorDots.first()).toBeVisible({ timeout: 300_000});

  // At least one part listed
  const partItems = page.locator('[class*="part"], [class*="segment-item"], [class*="panel-item"]');
  await expect(partItems.first()).toBeVisible({ timeout: 300_000});
});
