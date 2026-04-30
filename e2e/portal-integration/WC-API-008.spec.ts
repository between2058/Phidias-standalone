// kiwi_test_id: WC-API-008
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace, TINY_PNG } from './helpers';

test('WC-API-008 | WC mode — backend 401 shows auth error', async ({ page }) => {
  await goToPhidiasWorkspace(page, 'image');

  // Simulate all API calls returning 401
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthorized' }) }),
  );

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 10_000 });
  await promptInput.fill('auth test');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();

  // Auth error message shown — no crash
  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });
});
