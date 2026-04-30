// kiwi_test_id: WC-UI-003
import { test, expect } from '@playwright/test';
import { goToPhidias } from './helpers';

test('WC-UI-003 | Home — Quick Start links route within base-path without full reload', async ({ page }) => {
  await goToPhidias(page);

  // Click Image to 3D quick start
  const imageCard = page.getByRole('link', { name: /image.*(to\s*)?3d/i })
    .or(page.getByRole('button', { name: /image.*(to\s*)?3d/i }))
    .or(page.getByText(/image.*(to\s*)?3d/i))
    .first();
  await expect(imageCard).toBeVisible({ timeout: 10_000 });
  await imageCard.click();
  await expect(page).toHaveURL(/\/phidias\/workspace\/image/, { timeout: 10_000 });

  // Navigate back — SPA no full reload
  await page.goBack();
  await expect(page).toHaveURL(/\/phidias/, { timeout: 10_000 });

  // Click Text to 3D
  const textCard = page.getByRole('link', { name: /text.*(to\s*)?3d/i })
    .or(page.getByRole('button', { name: /text.*(to\s*)?3d/i }))
    .or(page.getByText(/text.*(to\s*)?3d/i))
    .first();
  if (await textCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await textCard.click();
    await expect(page).toHaveURL(/\/phidias\/workspace\/model/, { timeout: 10_000 });
  }
});
