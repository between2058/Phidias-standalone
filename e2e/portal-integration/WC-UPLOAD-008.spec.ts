// kiwi_test_id: WC-UPLOAD-008
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-008 | Upload in progress — Cancel button disabled', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  // Slow down POST to observe in-progress state
  await page.route('**/assets**', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((r) => setTimeout(r, 5_000));
      await route.continue();
    } else {
      await route.continue();
    }
  });

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  await assetCard.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /upload.*pegaverse/i })
    .or(page.getByText(/upload.*pegaverse/i))
    .first()
    .click();

  const modal = page.locator('[role="dialog"], [class*="modal"]').first();
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal.locator('[class*="tree"], [class*="folder"]').first()).toBeVisible({ timeout: 30_000 });

  await modal.getByText(/factory|projects/i).first().click();
  await modal.getByRole('button', { name: /upload/i }).first().click();

  // Cancel disabled while uploading
  await expect(modal.getByRole('button', { name: /cancel/i }).first()).toBeDisabled({ timeout: 10_000 });
});
