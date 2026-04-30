// kiwi_test_id: WC-UI-002
import { test, expect } from '@playwright/test';
import { goToPhidias } from './helpers';

test('WC-UI-002 | Home — welcome message shows portal-passed username', async ({ page }) => {
  await goToPhidias(page);

  // Hero section shows "Welcome back, phidias"
  await expect(page.getByText(/welcome back.*phidias/i)).toBeVisible({ timeout: 10_000 });
});
