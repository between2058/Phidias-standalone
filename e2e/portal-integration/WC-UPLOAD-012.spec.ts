// kiwi_test_id: WC-UPLOAD-012
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-012 | Fetch asset modelUrl fails — modal unlocks for retry/cancel', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  await page.route('**/*.glb', (route) => route.fulfill({ status: 404, body: 'Not Found' }));
  await page.route('**/models/**', (route) => route.fulfill({ status: 404, body: 'Not Found' }));

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

  // Cancel re-enabled after failure
  await expect(modal.getByRole('button', { name: /cancel/i }).first()).toBeEnabled({ timeout: 30_000 });
  await expect(modal).toBeVisible({ timeout: 5_000 });
});
