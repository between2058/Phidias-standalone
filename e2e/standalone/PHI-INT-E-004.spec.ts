// kiwi_test_id: PHI-INT-E-004
import { test, expect } from '@playwright/test';
import { TINY_PNG } from './helpers';

test('PHI-INT-E-004 | Model generation — ReconViaGen timeout (300s)', async ({ page }) => {
  // Mock: immediately abort with timeout error — no need to wait the real 300s client timeout
  await page.route('**/reconviagen/**', (route) => route.abort('timedout'));

  await page.goto('/workspace/model');

  const imageTab = page.getByRole('button', { name: /image/i }).first();
  if (await imageTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: TINY_PNG });

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Error should appear shortly after mock abort
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });

  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
});
