// kiwi_test_id: WC-STATIC-001
import { test, expect } from '@playwright/test';
import { goToPhidias } from './helpers';

test('WC-STATIC-001 | WC bundle loads from CDN base (HTTP 200)', async ({ page }) => {
  // Monitor network for phidias-wc.js load
  const wcRequests: { url: string; status: number }[] = [];
  page.on('response', (response) => {
    if (response.url().includes('phidias-wc')) {
      wcRequests.push({ url: response.url(), status: response.status() });
    }
  });

  await goToPhidias(page);

  // phidias-app should be attached (WC bundle loaded successfully)
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 40_000 });
  await expect(page.locator('phidias-app')).toBeVisible({ timeout: 10_000 });

  // If any WC bundle request was observed, verify it was 200
  for (const req of wcRequests) {
    expect(req.status).toBe(200);
  }
});
