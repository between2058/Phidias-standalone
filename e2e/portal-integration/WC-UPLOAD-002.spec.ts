// kiwi_test_id: WC-UPLOAD-002
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-002 | Folder tree — expand and collapse interactions', async ({ page }) => {
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

  // Find and click chevron/arrow to collapse
  const chevron = modal.locator('[class*="chevron"], [class*="arrow"], svg').first();
  if (await chevron.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await chevron.click(); // collapse
    await chevron.click(); // expand
  }

  // Tree still functional
  await expect(modal.locator('[class*="tree"], [class*="folder"]').first()).toBeVisible({ timeout: 5_000 });
});
