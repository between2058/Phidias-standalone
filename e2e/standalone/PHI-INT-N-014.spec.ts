// kiwi_test_id: PHI-INT-N-014
import { test, expect } from '@playwright/test';
import { goToModelWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-014 | Model generation — multi-view reconstruction', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);

  // Switch to Multi-view mode
  const multiViewTab = page.getByRole('button', { name: /multi.?view/i }).first();
  if (await multiViewTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await multiViewTab.click();
  }

  // Upload multiple view images
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles([
    { name: 'view1.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
    { name: 'view2.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
  ]);

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // 3D Viewport renders the generated model — real API, long timeout
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000 });
});
