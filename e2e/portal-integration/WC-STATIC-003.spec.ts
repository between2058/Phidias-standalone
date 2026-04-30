// kiwi_test_id: WC-STATIC-003
import { test, expect } from '@playwright/test';
import { goToPhidiasWorkspace } from './helpers';

test('WC-STATIC-003 | 3D static assets resolve from staticBase without 404', async ({ page }) => {
  const staticErrors: string[] = [];
  page.on('response', (response) => {
    if (
      response.status() === 404 &&
      (response.url().includes('.hdr') || response.url().includes('.jpg') || response.url().includes('.png'))
    ) {
      staticErrors.push(response.url());
    }
  });

  await goToPhidiasWorkspace(page, 'model');

  // Wait for 3D canvas to appear
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

  // No HDRI / texture 404s
  expect(staticErrors).toHaveLength(0);
});
