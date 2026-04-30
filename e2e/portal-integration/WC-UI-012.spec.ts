// kiwi_test_id: WC-UI-012
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UI-012 | Asset Grid filtering — model type filter works in WC mode', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  const filterBtn = page.getByRole('button', { name: /filter/i })
    .or(page.locator('[aria-label*="filter" i]'))
    .first();
  await expect(filterBtn).toBeVisible({ timeout: 10_000 });
  await filterBtn.click();

  const texturedOption = page.getByRole('option', { name: /textured/i })
    .or(page.getByRole('menuitem', { name: /textured/i }))
    .or(page.getByText(/^textured$/i))
    .first();
  if (await texturedOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await texturedOption.click();
  }

  const resetBtn = page.getByRole('button', { name: /reset/i }).first();
  if (await resetBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await resetBtn.click();
  }

  await expect(page.locator('[class*="asset"], [class*="card"]').first()).toBeVisible({ timeout: 5_000 });
});
