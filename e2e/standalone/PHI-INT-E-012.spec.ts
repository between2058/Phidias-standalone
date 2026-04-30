// kiwi_test_id: PHI-INT-E-012
import { test, expect } from '@playwright/test';

test('PHI-INT-E-012 | Model generation — generate without selecting a file', async ({ page }) => {
  await page.goto('/workspace/model');

  const imageTab = page.getByRole('button', { name: /image/i }).first();
  if (await imageTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeAttached({ timeout: 30_000 });

  const isDisabled = await generateBtn.isDisabled();
  if (!isDisabled) {
    // Use short timeout: if a request were incorrectly sent it would appear within ms, not minutes
    const requestPromise = page.waitForRequest('**/reconviagen/**', { timeout: 3_000 }).catch(() => null);
    await generateBtn.click();
    const request = await requestPromise;
    expect(request).toBeNull();

    await expect(
      page.locator('[class*="error"], [class*="validation"], [class*="required"], [role="alert"]').first(),
    ).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(generateBtn).toBeDisabled();
  }
});
