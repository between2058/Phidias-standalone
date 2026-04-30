// kiwi_test_id: WC-STATIC-008
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-STATIC-008 | HDRI 404 — 3D viewport degrades gracefully, no crash', async ({ page }) => {
  // Block HDRI resource loading
  await page.route('**/*.hdr', (route) => route.fulfill({ status: 404, body: 'Not Found' }));
  await page.route('**/*.exr', (route) => route.fulfill({ status: 404, body: 'Not Found' }));

  await goToPhidiasWorkspace(page, 'model');

  // 3D viewport still renders (fallback background)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

  // No React crash — phidias-app still attached
  await expect(page.locator('phidias-app')).toBeAttached({ timeout: 5_000 });
});
