// kiwi_test_id: PHI-INT-N-018
import { test, expect } from '@playwright/test';
import { goToModelWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-018 | Model generation — advanced parameters', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);

  // Switch to Image mode and upload
  const imageTab = page.getByRole('button', { name: /image/i }).first();
  if (await imageTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE });

  // Expand advanced parameters
  const advancedToggle = page.getByRole('button', { name: /advanced|parameters|settings/i }).first();
  if (await advancedToggle.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await advancedToggle.click();
  }

  // Set Seed=100
  const seedInput = page.getByLabel(/seed/i).or(page.locator('input[name*="seed" i]')).first();
  if (await seedInput.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await seedInput.fill('100');
  }

  // Set Texture Size=2048
  const textureSizeInput = page.getByLabel(/texture.?size/i).or(page.locator('input[name*="texture" i]')).first();
  if (await textureSizeInput.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await textureSizeInput.fill('2048');
  }

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Generation should succeed — real API, long timeout
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000 });
});
