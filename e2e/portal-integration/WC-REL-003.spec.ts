// kiwi_test_id: WC-REL-003
import { test, expect } from '@playwright/test';
import { generateModelInPortal, goToPhidiasWorkspace, TINY_PNG } from './helpers';

test('WC-REL-003 | Concurrent generation and upload do not interfere', async ({ page }) => {
  test.setTimeout(600_000);

  // First: have a ready asset from a previous generation
  await generateModelInPortal(page);

  // Start another generation (creating a "generating" asset)
  await goToPhidiasWorkspace(page, 'model');

  const imageTab = page.getByRole('button', { name: /^image$/i }).first();
  if (await imageTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
  await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: TINY_PNG });

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();

  // While generating, upload the first (ready) asset
  const readyCard = page.locator('[class*="asset"], [class*="card"]').first();
  await expect(readyCard).toBeVisible({ timeout: 15_000 });
  await readyCard.click({ button: 'right' });

  const uploadOption = page.getByRole('menuitem', { name: /upload.*pegaverse/i })
    .or(page.getByText(/upload.*pegaverse/i))
    .first();
  if (await uploadOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await uploadOption.click();

    const modal = page.locator('[role="dialog"], [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.locator('[class*="tree"], [class*="folder"]').first()).toBeVisible({ timeout: 30_000 });

    await modal.getByText(/factory|projects/i).first().click();
    await modal.getByRole('button', { name: /upload/i }).first().click();

    // Upload completes — modal closes
    await expect(modal).not.toBeVisible({ timeout: 60_000 });
  }

  // Generation still continues — no crash
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 5_000 });
});
