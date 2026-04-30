// kiwi_test_id: PHI-INT-N-010
import { test, expect } from '@playwright/test';
import { goToImageWorkspace, triggerImageGeneration } from './helpers';

test('PHI-INT-N-010 | Image generation — send to model workspace', async ({ page }) => {
  test.setTimeout(660_000); // image generation (~2 min) + navigation; allow 11 min total

  await goToImageWorkspace(page);

  await triggerImageGeneration(page, 'a ceramic teapot');

  // Wait for the generated image
  const firstImage = page.locator('img[alt^="Generated"]').first();
  await expect(firstImage).toBeVisible({ timeout: 300_000 });

  // "→ to 3D" button only appears on hover
  await firstImage.hover();
  const toModelBtn = page.locator('button').filter({ hasText: '→ to 3D' }).first();
  await expect(toModelBtn).toBeVisible({ timeout: 30_000 });
  await toModelBtn.click();

  // Should navigate to model workspace with image pre-filled
  await expect(page).toHaveURL(/workspace\/model/, { timeout: 30_000 });
  await expect(page.locator('input[type="file"], img[src]:not([src=""])').first()).toBeVisible({ timeout: 30_000 });
});
