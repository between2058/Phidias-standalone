// kiwi_test_id: PHI-INT-E-010
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH } from './helpers';
import fs from 'fs';

test('PHI-INT-E-010 | Smart Organize — VLM timeout (600s)', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Mock: immediately abort with timeout error — no need to wait the real 600s client timeout
  await page.route('**/smart-organize**', (route) => route.abort('timedout'));
  await page.route('**/vlm**', (route) => route.abort('timedout'));

  const smartOrganizeBtn = page.getByRole('button', { name: /smart.?organize/i }).first();
  await expect(smartOrganizeBtn).toBeVisible({ timeout: 30_000 });
  await smartOrganizeBtn.click();

  // Error should appear shortly after mock abort
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });
});
