// kiwi_test_id: WC-UI-004
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-UI-004 | Workspace Layout — TopNavBar not rendered in WC mode', async ({ page }) => {
  await goToPhidiasWorkspace(page, 'model');
  const phidiasNavBar = page.locator('phidias-app').locator('[class*="topnav"], [class*="top-nav"]').first();
  await expect(phidiasNavBar).not.toBeVisible({ timeout: 5_000 }).catch(() => {});

  await goToPhidiasWorkspace(page, 'image');
  await expect(phidiasNavBar).not.toBeVisible({ timeout: 5_000 }).catch(() => {});

  // Portal nav still visible
  await expect(page.locator('[class*="sidebar"], [class*="nav"], header').first()).toBeVisible({ timeout: 5_000 });
});
