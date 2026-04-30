// kiwi_test_id: PHI-INT-E-003
import { test, expect } from '@playwright/test';

test('PHI-INT-E-003 | Image generation — text-to-image timeout (300s)', async ({ page }) => {
  // Mock: immediately abort with timeout error — no need to wait the real 300s client timeout
  await page.route('**/qwen/**', (route) => route.abort('timedout'));

  await page.goto('/workspace/image');

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 30_000 });
  await promptInput.fill('timeout test prompt');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Error should appear shortly after mock abort
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });

  // UI unblocked
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
});
