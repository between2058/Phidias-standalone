// kiwi_test_id: PHI-INT-N-011
import { test, expect } from '@playwright/test';
import { goToImageWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-011 | Image generation — send multi-view to model workspace', async ({ page }) => {
  test.setTimeout(660_000); // multi-view generation + navigation; allow 11 min total

  await goToImageWorkspace(page);

  // Upload reference image (prompt must be empty to trigger generateAngleMulti path)
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'reference.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE });

  // Enable "Generate Multi-view" toggle
  const multiViewToggle = page.getByTestId('generate-multiview-toggle');
  await expect(multiViewToggle).toBeVisible({ timeout: 30_000 });
  await multiViewToggle.click();

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Wait for 4 images: original + 3 angles
  await expect(page.locator('img[alt^="Generated"]').nth(3)).toBeVisible({ timeout: 600_000 });

  // "→ to multi-view" button appears below the grid when images.length > 1 (always visible, no hover needed)
  const toMultiViewBtn = page.locator('button').filter({ hasText: '→ to multi-view' }).first();
  await expect(toMultiViewBtn).toBeVisible({ timeout: 30_000 });
  await toMultiViewBtn.click();

  // Model workspace should activate multi-view mode
  await expect(page).toHaveURL(/workspace\/model/, { timeout: 30_000 });
  await expect(page.locator('img[src]:not([src=""])').first()).toBeVisible({ timeout: 30_000 });
});
