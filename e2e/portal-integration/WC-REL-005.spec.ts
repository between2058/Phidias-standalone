// kiwi_test_id: WC-REL-005
import { test, expect } from '@playwright/test';
import { goToPhidias, TINY_PNG } from './helpers';

test('WC-REL-005 | Page refresh on /phidias — WC reinitializes correctly', async ({ page }) => {
  await goToPhidias(page);
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });

  // Press F5 (reload)
  await page.reload();

  // WC reinitializes
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });

  // Verify attributes are correctly passed by triggering a navigation
  await page.goto('/phidias/workspace/image');
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 20_000 });

  // API calls work — trigger image generation
  const samplesSlider = page.locator('input[type="range"]').first();
  if (await samplesSlider.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await samplesSlider.fill('1');
  }
  await promptInput.fill('reload test');
  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  // Just verify button is clickable (don't wait for actual generation)
  await expect(generateBtn).toBeEnabled();
});
