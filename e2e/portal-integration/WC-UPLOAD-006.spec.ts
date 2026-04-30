// kiwi_test_id: WC-UPLOAD-006
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-006 | Folder tree empty — shows empty state', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  // Intercept asset hierarchy to return empty
  await page.route('**/assets**', async (route) => {
    if (route.request().url().includes('hierarchy') || route.request().url().includes('assets')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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

  await expect(modal.getByText(/no folders/i)).toBeVisible({ timeout: 30_000 });
  await expect(modal.getByRole('button', { name: /upload asset/i }).first()).toBeDisabled({ timeout: 5_000 });
});
