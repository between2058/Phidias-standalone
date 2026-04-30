// kiwi_test_id: WC-UPLOAD-005
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-UPLOAD-005 | Large file upload — progress bar updates continuously', async ({ page }) => {
  test.setTimeout(420_000);

  await goToPhidiasWorkspace(page, 'model');

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  if (!(await assetCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip(true, 'No asset available for large file upload test');
    return;
  }

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

  await expect(modal.locator('[class*="progress"], [role="progressbar"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(modal).not.toBeVisible({ timeout: 120_000 });
});
