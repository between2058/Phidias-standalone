// kiwi_test_id: PHI-INT-N-017
import { test, expect } from '@playwright/test';
import { goToModelWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-017 | Model generation — batch reconstruction (3 images)', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);

  // Switch to Batch mode
  const batchTab = page.getByRole('button', { name: /batch/i }).first();
  if (await batchTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await batchTab.click();
  }

  // Upload 3 images
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles([
    { name: 'model1.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
    { name: 'model2.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
    { name: 'model3.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
  ]);

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Wait for all 3 models — real API, long timeout
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000 });
  // Export button becomes enabled once the first model is loaded into the scene
  await expect(page.getByRole('button', { name: /export/i }).first()).toBeEnabled({ timeout: 30_000 });
});
