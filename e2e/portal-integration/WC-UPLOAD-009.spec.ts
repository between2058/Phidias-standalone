// kiwi_test_id: WC-UPLOAD-009
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-009 | No folder selected — Upload button disabled', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  await assetCard.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /upload.*pegaverse/i })
    .or(page.getByText(/upload.*pegaverse/i))
    .first()
    .click();

  const modal = page.locator('[role="dialog"], [class*="modal"]').first();
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal.locator('[class*="tree"], [class*="folder"]').first()).toBeVisible({ timeout: 30_000 });

  // Do NOT select any folder — Upload Asset should be disabled
  const uploadBtn = modal.getByRole('button', { name: /upload asset|upload/i }).first();
  await expect(uploadBtn).toBeDisabled({ timeout: 5_000 });
});
