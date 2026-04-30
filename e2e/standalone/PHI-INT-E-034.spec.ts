// kiwi_test_id: PHI-INT-E-034
import { test, expect } from '@playwright/test';

test('PHI-INT-E-034 | Image generation — download failure after successful generation', async ({ page }) => {
  // Allow generation API to succeed, block image download
  await page.route('**/qwen/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ images: ['/api/phidias/images/result-404.png'] }),
    });
  });

  await page.route('**/images/result-404.png', (route) =>
    route.fulfill({ status: 404, body: 'Not Found' }),
  );

  await page.goto('/workspace/image');

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 30_000});
  await promptInput.fill('download failure test');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000});
  await generateBtn.click();

  // UI shows error for download failure — not a broken image
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000});
});
