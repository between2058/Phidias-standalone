// kiwi_test_id: PHI-INT-E-020
import { test, expect } from '@playwright/test';

test('PHI-INT-E-020 | Proxy — upstream 502 Bad Gateway', async ({ page }) => {
  await page.route('**/phidias/**', (route) =>
    route.fulfill({ status: 502, body: 'Bad Gateway' }),
  );
  await page.route('**/qwen/**', (route) =>
    route.fulfill({ status: 502, body: 'Bad Gateway' }),
  );
  await page.route('**/reconviagen/**', (route) =>
    route.fulfill({ status: 502, body: 'Bad Gateway' }),
  );

  await page.goto('/workspace/image');

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 30_000});
  await promptInput.fill('502 test');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000});
  await generateBtn.click();

  // Error notification appears — app does not crash
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000});

  // Page still at image workspace
  await expect(page).toHaveURL(/workspace\/image/, { timeout: 30_000});
});
