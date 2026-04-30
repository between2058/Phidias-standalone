// kiwi_test_id: PHI-INT-N-020
import { test, expect } from '@playwright/test';
import { goToModelWorkspace, uploadImageAndGenerate } from './helpers';

test('PHI-INT-N-020 | Model generation — export GLB', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);
  await uploadImageAndGenerate(page);

  // Wait for model to be ready in viewport
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Export button is disabled until the model is loaded; wait for it to become enabled
  const exportBtn = page.getByRole('button', { name: /export/i }).first();
  await expect(exportBtn).toBeEnabled({ timeout: 30_000 });

  // Clicking the main Export button triggers a direct GLB download
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 300_000}),
    exportBtn.click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.glb$/i);
});
