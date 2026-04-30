// kiwi_test_id: PHI-INT-N-012
import { test, expect } from '@playwright/test';
import { goToModelWorkspace } from './helpers';

test('PHI-INT-N-012 | Model generation — text to 3D', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);

  // Switch to Text mode
  const textTab = page.getByRole('button', { name: /text/i }).first();
  if (await textTab.isVisible({ timeout: 300_000}).catch(() => false)) {
    await textTab.click();
  }

  const promptInput = page.locator('textarea, input[type="text"]').first();
  await expect(promptInput).toBeVisible({ timeout: 300_000});
  await promptInput.fill('a simple wooden chair');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 300_000});
  await generateBtn.click();

  // Wait for 3D viewport to show the model
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});
  // Export button becomes enabled once the model is loaded into the scene
  await expect(page.getByRole('button', { name: /export/i }).first()).toBeEnabled({ timeout: 30_000 });
});
