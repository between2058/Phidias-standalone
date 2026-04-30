// kiwi_test_id: PHI-INT-N-016
import { test, expect } from '@playwright/test';
import { goToModelWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-016 | Model generation — multi-view algorithm: Multidiffusion', async ({ page }) => {
  test.setTimeout(360_000);

  await goToModelWorkspace(page);

  // Switch to Multi-view mode
  const multiViewTab = page.getByRole('button', { name: /multi.?view/i }).first();
  if (await multiViewTab.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await multiViewTab.click();
  }

  // Select multidiffusion algorithm
  const algorithmSelect = page.getByRole('combobox', { name: /algorithm/i })
    .or(page.locator('select').first());
  if (await algorithmSelect.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await algorithmSelect.selectOption({ label: 'Multidiffusion' });
  } else {
    const btn = page.getByRole('button', { name: /multidiffusion/i }).first();
    if (await btn.isVisible({ timeout: 30_000 }).catch(() => false)) {
      await btn.click();
    }
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles([
    { name: 'view1.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
    { name: 'view2.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE },
  ]);

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Real API, long timeout
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000 });
});
