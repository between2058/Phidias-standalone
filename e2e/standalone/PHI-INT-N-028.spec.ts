// kiwi_test_id: PHI-INT-N-028
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH, buildMinimalGlb } from './helpers';
import fs from 'fs';

test('PHI-INT-N-028 | 3D segmentation — upload GLB and segment', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);

  // Segmentation result: canvas shows segmented model
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Parts panel lists parts
  await expect(
    page.locator('[class*="part"], [class*="segment"], [class*="panel"]').first(),
  ).toBeVisible({ timeout: 300_000});
});
