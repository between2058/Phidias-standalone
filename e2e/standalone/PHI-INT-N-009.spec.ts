// kiwi_test_id: PHI-INT-N-009
import { test, expect } from '@playwright/test';
import { goToImageWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-009 | Image generation — multi-view generation', async ({ page }) => {
  test.setTimeout(660_000); // multi-view generates 4 images; allow 11 min total

  await goToImageWorkspace(page);

  // Upload reference image (prompt must be empty to trigger generateAngleMulti path)
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'reference.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE });

  // Enable "Generate Multi-view" toggle:
  const multiViewToggle = page.getByTestId('generate-multiview-toggle');
  await expect(multiViewToggle).toBeVisible({ timeout: 30_000 });
  await multiViewToggle.click();

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Wait for 4 images: original + 3 angles (alt="Generated 1" … "Generated 4")
  await expect(page.locator('img[alt^="Generated"]').nth(3)).toBeVisible({ timeout: 600_000 });
});
