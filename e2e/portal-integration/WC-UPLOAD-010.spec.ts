// kiwi_test_id: WC-UPLOAD-010
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-010 | getAssets API failure — modal shows empty state, no crash', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  await page.route('**/assets**', (route) =>
    route.fulfill({ status: 500, body: 'Internal Server Error' }),
  );

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  await assetCard.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /upload.*pegaverse/i })
    .or(page.getByText(/upload.*pegaverse/i))
    .first()
    .click();

  const modal = page.locator('[role="dialog"], [class*="modal"]').first();
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await expect(modal.getByText(/no folders|error|failed/i).first()).toBeVisible({ timeout: 30_000 });

  const cancelBtn = modal.getByRole('button', { name: /cancel/i }).first();
  if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  }
});
