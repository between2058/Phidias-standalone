// kiwi_test_id: WC-ERR-004
import { test, expect } from '@playwright/test';

test('WC-ERR-004 | Unauthenticated user accessing /phidias is redirected to login', async ({ browser }) => {
  // Create a fresh context with no storage state (unauthenticated)
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/phidias');

  // Should be redirected to login page (not stay on /phidias)
  await expect(page).toHaveURL(/login|signin|^\/$/, { timeout: 30_000 });

  // phidias-app should NOT be loaded
  await expect(page.locator('phidias-app')).not.toBeAttached({ timeout: 5_000 });

  await context.close();
});
