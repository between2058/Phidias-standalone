// kiwi_test_id: PHI-INT-N-006
import { test, expect } from '@playwright/test';
import { goToImageWorkspace, triggerImageGeneration } from './helpers';

test('PHI-INT-N-006 | Image generation — text to image', async ({ page }) => {
  await goToImageWorkspace(page);

  // Samples is a PillGroup (buttons '1','2','4','6') — default is already '1', no action needed

  await triggerImageGeneration(page, 'a red cube on a white table');

  // Spinner appears inside the Generate button while generating
  await expect(page.locator('.spinner').first()).toBeVisible({ timeout: 30_000 });

  // Wait for a generated image — alt starts with "Generated" to avoid matching the upload preview
  await expect(page.locator('img[alt^="Generated"]').first()).toBeVisible({ timeout: 300_000 });

  // Spinner disappears once done
  await expect(page.locator('.spinner').first()).not.toBeVisible({ timeout: 30_000 });
});
