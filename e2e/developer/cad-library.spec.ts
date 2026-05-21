import { test, expect } from '@playwright/test';

const TEST_RECORD_ID = 'rec_an-nvidia-gb300-nvl72-server-rack-a-tall-enclose_20260518_055942_556781_2acac014';

test.describe('CAD library', () => {
  test('grid loads, detail opens, joint slider moves model', async ({ page }) => {
    await page.goto('/workspace/cad');

    // CAD tab visible in sidebar
    await expect(page.getByRole('link', { name: 'CAD' })).toBeVisible({ timeout: 10_000 });

    // Grid loads at least one card
    await expect(page.locator('button[class*="aspect-square"]').first()).toBeVisible({ timeout: 15_000 });

    // Open a known record directly
    await page.goto(`/workspace/cad/${TEST_RECORD_ID}`);

    // Canvas mounts
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

    // Switch to the Joints tab (the inspector renders the controls there)
    await page.getByRole('tab', { name: /^Joints$/ }).click();

    // At least one slider exists for an articulated record. If the test record has no
    // movable joints, this assertion would need updating — the test record was chosen
    // precisely because it has compiled articulated geometry.
    const slider = page.getByRole('slider').first();
    await expect(slider).toBeVisible({ timeout: 10_000 });

    // Move the slider via React-compatible event dispatch; URL gains a pose param.
    // React controlled inputs ignore plain Event — use a native InputEvent with the
    // value injected via the Object.getOwnPropertyDescriptor setter trick so that
    // React's synthetic onChange fires.
    await slider.evaluate((el: HTMLInputElement) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, el.max !== '' ? el.max : '0.3');
      } else {
        el.value = el.max !== '' ? el.max : '0.3';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page).toHaveURL(/pose=/, { timeout: 5_000 });
  });
});
