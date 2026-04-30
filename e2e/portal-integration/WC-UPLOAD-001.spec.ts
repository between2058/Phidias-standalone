// kiwi_test_id: WC-UPLOAD-001
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UPLOAD-001 | Upload to Pegaverse — select folder and upload successfully', async ({ page }) => {
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
  await expect(modal.getByText(/upload.*pegaverse/i)).toBeVisible({ timeout: 10_000 });

  // Folder tree loads
  await expect(modal.locator('[class*="tree"], [class*="folder"]').first()).toBeVisible({ timeout: 30_000 });

  // Select Factory folder
  const factoryFolder = modal.getByText(/factory/i).first();
  await expect(factoryFolder).toBeVisible({ timeout: 10_000 });
  await factoryFolder.click();

  // Upload button enabled
  const uploadBtn = modal.getByRole('button', { name: /upload asset|upload/i }).first();
  await expect(uploadBtn).toBeEnabled({ timeout: 5_000 });
  await uploadBtn.click();

  // Progress bar appears
  await expect(modal.locator('[class*="progress"], [role="progressbar"]').first()).toBeVisible({ timeout: 30_000 });

  // Modal auto-closes on completion
  await expect(modal).not.toBeVisible({ timeout: 60_000 });
});
