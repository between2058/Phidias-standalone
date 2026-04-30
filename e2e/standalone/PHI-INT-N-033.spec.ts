// kiwi_test_id: PHI-INT-N-033
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH } from './helpers';
import fs from 'fs';

test('PHI-INT-N-033 | 3D segmentation — export segmented GLB', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Click Export dropdown
  const exportBtn = page.getByRole('button', { name: /export/i }).first();
  await expect(exportBtn).toBeVisible({ timeout: 300_000});
  await exportBtn.click();

  // Select GLB
  const glbOption = page.getByRole('menuitem', { name: /glb/i })
    .or(page.getByText(/export.*glb|download.*glb/i))
    .first();
  await expect(glbOption).toBeVisible({ timeout: 300_000});

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 300_000}),
    glbOption.click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.glb$/i);
});
