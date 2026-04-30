// kiwi_test_id: WC-UI-005
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UI-005 | AssetGrid — right-click shows "Upload to Pegaverse" when host-app=pegaverse', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  await expect(assetCard).toBeVisible({ timeout: 10_000 });
  await assetCard.click({ button: 'right' });

  await expect(
    page.getByRole('menuitem', { name: /upload.*pegaverse/i })
      .or(page.getByText(/upload.*pegaverse/i))
      .first(),
  ).toBeVisible({ timeout: 10_000 });
});
