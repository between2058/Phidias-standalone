// kiwi_test_id: PHI-INT-N-038
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH } from './helpers';
import fs from 'fs';

test('PHI-INT-N-038 | Smart Organize — OpenAI-compatible VLM', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  const smartOrganizeBtn = page.getByRole('button', { name: /smart.?organize/i }).first();
  await expect(smartOrganizeBtn).toBeVisible({ timeout: 300_000});
  await smartOrganizeBtn.click();

  // All parts should receive AI names — parts panel updates
  const partItems = page.locator('[class*="part"], [class*="segment-item"]');
  await expect(partItems.first()).toBeVisible({ timeout: 300_000});
  // Verify panel updated (no spinner visible after completion)
  await expect(page.locator('[class*="loading"], [class*="spinner"]').first())
    .not.toBeVisible({ timeout: 300_000});
});
