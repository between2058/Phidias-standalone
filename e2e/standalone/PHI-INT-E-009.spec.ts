// kiwi_test_id: PHI-INT-E-009
import { test, expect } from '@playwright/test';
import { buildMinimalGlb, goToSegmentWorkspace } from './helpers';

test('PHI-INT-E-009 | 3D segmentation — P3SAM timeout (300s)', async ({ page }) => {
  test.setTimeout(120_000);

  await goToSegmentWorkspace(page);

  // Mock: immediately abort with timeout error — no need to wait the real 300s client timeout
  // Narrow the pattern to avoid intercepting the page navigation itself (**/workspace/segment)
  await page.route('**/api/**/segment**', (route) => route.abort('timedout'));
  await page.route('**/api/**/p3sam**', (route) => route.abort('timedout'));

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({
    name: 'test.glb',
    mimeType: 'model/gltf-binary',
    buffer: buildMinimalGlb(),
  });

  const startBtn = page.getByRole('button', { name: /start segmentation/i }).first();
  await expect(startBtn).toBeEnabled({ timeout: 30_000 });
  await startBtn.click();

  // Error should appear shortly after mock abort
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });

  // UI unblocked
  await expect(page.locator('button').first()).toBeEnabled({ timeout: 30_000 });
});
