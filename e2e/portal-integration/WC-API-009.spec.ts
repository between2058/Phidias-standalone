// kiwi_test_id: WC-API-009
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-API-009 | WC mode — backend 500 shows server error', async ({ page }) => {
  await goToPhidiasWorkspace(page, 'image');

  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal Server Error' }) }),
  );

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 10_000 });
  await promptInput.fill('500 test');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();

  await expect(
    page.locator('[class*="error"], [class*="toast"], [class*="alert"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000 });
});
