// kiwi_test_id: PHI-INT-E-005
import { test, expect } from '@playwright/test';
import { TINY_PNG } from './helpers';

test('PHI-INT-E-005 | Model generation — batch timeout (600s)', async ({ page }) => {
  // Mock: immediately abort with timeout error — no need to wait the real 600s client timeout
  // Note: **/batch** is redundant since **/reconviagen/** already covers generate-batch
  await page.route('**/reconviagen/**', (route) => route.abort('timedout'));

  await page.goto('/workspace/model');

  const batchTab = page.getByRole('button', { name: /batch/i }).first();
  if (await batchTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await batchTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles([
    { name: 'model1.png', mimeType: 'image/png', buffer: TINY_PNG },
    { name: 'model2.png', mimeType: 'image/png', buffer: TINY_PNG },
    { name: 'model3.png', mimeType: 'image/png', buffer: TINY_PNG },
  ]);

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Error should appear shortly after mock abort
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });

  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
});
