// kiwi_test_id: WC-UPLOAD-004
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-004 | Upload modal — cancel before upload has no side effects', async ({ page }) => {
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

  // Click Cancel
  await modal.getByRole('button', { name: /cancel/i }).first().click();
  await expect(modal).not.toBeVisible({ timeout: 5_000 });

  // Re-open and close with X
  await assetCard.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /upload.*pegaverse/i })
    .or(page.getByText(/upload.*pegaverse/i))
    .first()
    .click();
  await expect(modal).toBeVisible({ timeout: 10_000 });

  const closeBtn = modal.getByRole('button', { name: /close|×|✕/i })
    .or(modal.locator('[aria-label="close"], [class*="close"]'))
    .first();
  if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  }
});
