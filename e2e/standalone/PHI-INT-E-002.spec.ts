// kiwi_test_id: PHI-INT-E-002
import { test, expect } from '@playwright/test';

test('PHI-INT-E-002 | Connection refused — user sees actionable error', async ({ page }) => {
  // Simulate unreachable backend
  await page.route('**/phidias/**', (route) => route.abort('connectionrefused'));
  await page.route('**/qwen/**', (route) => route.abort('connectionrefused'));
  await page.route('**/reconviagen/**', (route) => route.abort('connectionrefused'));

  await page.goto('/workspace/image');

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 30_000});
  await promptInput.fill('a test object');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000});
  await generateBtn.click();

  // UI shows an error message — app does not crash
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000});

  // Page still interactive
  await expect(generateBtn).toBeVisible({ timeout: 30_000});
});
