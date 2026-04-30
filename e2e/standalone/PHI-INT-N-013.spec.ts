// kiwi_test_id: PHI-INT-N-013
import { test, expect } from '@playwright/test';
import { goToModelWorkspace, uploadImageAndGenerate } from './helpers';

test('PHI-INT-N-013 | Model generation — single image reconstruction', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);
  await uploadImageAndGenerate(page);

  // 3D Viewport renders the generated model
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});
  // Export button becomes enabled once the model is loaded into the scene
  await expect(page.getByRole('button', { name: /export/i }).first()).toBeEnabled({ timeout: 30_000 });
});
