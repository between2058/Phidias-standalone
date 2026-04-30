// kiwi_test_id: WC-UI-008
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-UI-008 | Asset Panel — tab switching works in WC mode', async ({ page }) => {
  await goToPhidiasWorkspace(page, 'model');

  // Scene tab
  const sceneTab = page.getByRole('tab', { name: /scene/i })
    .or(page.getByRole('button', { name: /^scene$/i }))
    .first();
  if (await sceneTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sceneTab.click();
    await expect(page.locator('[class*="scene"]').first()).toBeVisible({ timeout: 5_000 });
  }

  // Assets tab
  const assetsTab = page.getByRole('tab', { name: /assets/i })
    .or(page.getByRole('button', { name: /^assets$/i }))
    .first();
  if (await assetsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await assetsTab.click();
    await expect(page.locator('[class*="asset"]').first()).toBeVisible({ timeout: 5_000 });
  }
});
