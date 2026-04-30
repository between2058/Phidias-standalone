// kiwi_test_id: PHI-INT-E-011
import { test, expect } from '@playwright/test';

test('PHI-INT-E-011 | Image generation — empty prompt and no reference image', async ({ page }) => {
  await page.goto('/workspace/image');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeAttached({ timeout: 30_000 });

  const isDisabled = await generateBtn.isDisabled();
  if (!isDisabled) {
    // If enabled, clicking should show validation error, no API call
    // Use short timeout: if a request were incorrectly sent it would appear within ms, not minutes
    const requestPromise = page.waitForRequest('**/qwen/**', { timeout: 3_000 }).catch(() => null);
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
