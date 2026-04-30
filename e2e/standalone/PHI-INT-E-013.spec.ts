// kiwi_test_id: PHI-INT-E-013
import { test, expect } from '@playwright/test';
import { TINY_PNG } from './helpers';

test('PHI-INT-E-013 | 3D segmentation — reject non-GLB file upload', async ({ page }) => {
  await page.goto('/workspace/segment');

  // Upload a JPEG into the GLB upload area
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000});
  await fileInput.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: TINY_PNG });

  // UI should reject the file type
  await expect(
    page.locator('[class*="error"], [class*="invalid"], [class*="reject"], [role="alert"]').first(),
  ).toBeVisible({ timeout: 30_000});

  // Start Segmentation button should remain disabled
  const startBtn = page.getByRole('button', { name: /start segmentation/i }).first();
  if (await startBtn.isVisible({ timeout: 30_000}).catch(() => false)) {
    await expect(startBtn).toBeDisabled();
  }
});
