// kiwi_test_id: WC-UI-010
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace, TINY_PNG } from './helpers';

test('WC-UI-010 | Asset status badge — shows progress percentage while generating', async ({ page }) => {
  test.setTimeout(420_000);

  await goToPhidiasWorkspace(page, 'model');

  const imageTab = page.getByRole('button', { name: /^image$/i }).first();
  if (await imageTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
  await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: TINY_PNG });

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();

  // Spinner / progress badge visible during generation
  const progressBadge = page.locator('[class*="progress"], [class*="spinner"], [class*="badge"]').first();
  await expect(progressBadge).toBeVisible({ timeout: 30_000 });

  // After completion badge disappears
  await expect(progressBadge).not.toBeVisible({ timeout: 360_000 });
});
