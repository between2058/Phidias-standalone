// kiwi_test_id: WC-UI-014
import { test, expect } from '@playwright/test';
import { generateModelInPortal, goToPhidiasWorkspace, TINY_PNG } from './helpers';

test('WC-UI-014 | AssetGrid — context menu behavior while asset is generating', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  // Trigger another generation to observe generating state
  await goToPhidiasWorkspace(page, 'model');

  const imageTab = page.getByRole('button', { name: /^image$/i }).first();
  if (await imageTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await imageTab.click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
  await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: TINY_PNG });

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();

  // Right-click the generating asset card
  const assetCard = page.locator('[class*="asset"], [class*="card"]').first();
  await expect(assetCard).toBeVisible({ timeout: 10_000 });
  await assetCard.click({ button: 'right' });

  // Context menu opens — verify app does not crash
  const contextMenu = page.locator('[role="menu"], [class*="context-menu"]').first();
  await expect(contextMenu).toBeVisible({ timeout: 5_000 });
});
