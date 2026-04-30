// kiwi_test_id: WC-UPLOAD-014
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-014 | getUploadId failure — no upload job created', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  await page.route('**/upload-id**', (route) => route.fulfill({ status: 500, body: 'Failed' }));
  await page.route('**/uploadId**', (route) => route.fulfill({ status: 500, body: 'Failed' }));

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

  // Modal unlocks — did NOT close as success
  await expect(modal.getByRole('button', { name: /cancel/i }).first()).toBeEnabled({ timeout: 30_000 });
  await expect(modal).toBeVisible({ timeout: 5_000 });
});
