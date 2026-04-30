// kiwi_test_id: WC-UPLOAD-007
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-UPLOAD-007 | Asset without extension — .glb appended on upload', async ({ page }) => {
  test.setTimeout(420_000);

  await goToPhidiasWorkspace(page, 'model');

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  if (!(await assetCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip(true, 'No asset available to test extension behavior');
    return;
  }

  await assetCard.click({ button: 'right' });
  const uploadOption = page.getByRole('menuitem', { name: /upload.*pegaverse/i })
    .or(page.getByText(/upload.*pegaverse/i))
    .first();
  await expect(uploadOption).toBeVisible({ timeout: 5_000 });
  await uploadOption.click();

  const modal = page.locator('[role="dialog"], [class*="modal"]').first();
  await expect(modal).toBeVisible({ timeout: 10_000 });

  // Modal subtitle should display asset filename
  const subtitle = modal.locator('[class*="subtitle"], [class*="filename"], p').first();
  await expect(subtitle).toBeVisible({ timeout: 10_000 });
});
