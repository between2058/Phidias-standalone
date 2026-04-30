// kiwi_test_id: WC-UI-009
import { test, expect } from '@playwright/test';
import { goToPhidias } from './helpers';

test('WC-UI-009 | Home — navigate away and back keeps WC functional', async ({ page }) => {
  await goToPhidias(page);
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });

  // Navigate away via portal
  await page.goto('/');
  await page.goto('/phidias');

  // WC re-mounts and Phidias home renders
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });
});
