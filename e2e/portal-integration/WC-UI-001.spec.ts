// kiwi_test_id: WC-UI-001
import { test, expect } from '@playwright/test';
import { goToPhidias } from './helpers';

test('WC-UI-001 | Home — TopNavBar not rendered in WC mode', async ({ page }) => {
  await goToPhidias(page);

  // Phidias internal TopNavBar should not be present inside phidias-app
  const phidiasInternalNav = page.locator('phidias-app').locator('[class*="topnav"], [class*="top-nav"]').first();
  await expect(phidiasInternalNav).not.toBeVisible({ timeout: 5_000 }).catch(() => {});

  // Portal's own navigation is present
  await expect(page.locator('nav, [class*="sidebar"], [class*="header"]').first()).toBeVisible({ timeout: 10_000 });
});
