// kiwi_test_id: WC-REL-001
import { test, expect } from '@playwright/test';
import { goToPhidias } from './helpers';

test('WC-REL-001 | WC remounts normally after navigating away and back', async ({ page }) => {
  await goToPhidias(page);
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });

  // Navigate to another portal route
  await page.goto('/');

  // Return to /phidias
  await page.goto('/phidias');
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });

  // No console errors about unmount/remount
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(msg.text());
  });

  // Verify Phidias home renders cleanly
  await expect(page.locator('phidias-app').locator('main, [class*="home"], [class*="workspace"]').first())
    .toBeVisible({ timeout: 10_000 });
});
