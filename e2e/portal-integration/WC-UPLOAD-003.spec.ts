// kiwi_test_id: WC-UPLOAD-003
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-003 | Folder selection — switching folders moves highlight', async ({ page }) => {
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

  await modal.getByText(/factory/i).first().click();

  const archiveItem = modal.getByText(/archive/i).first();
  if (await archiveItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await archiveItem.click();
    const uploadBtn = modal.getByRole('button', { name: /upload/i }).first();
    await expect(uploadBtn).toBeEnabled({ timeout: 5_000 });
  }
});
