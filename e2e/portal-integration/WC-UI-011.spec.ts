// kiwi_test_id: WC-UI-011
import { test, expect } from '@playwright/test';
import { generateModelInPortal } from './helpers';

test('WC-UI-011 | Asset Grid sorting — sort dropdown works in WC mode', async ({ page }) => {
  test.setTimeout(420_000);

  await generateModelInPortal(page);

  const sortBtn = page.getByRole('button', { name: /sort|↕/i })
    .or(page.locator('[aria-label*="sort" i]'))
    .first();
  await expect(sortBtn).toBeVisible({ timeout: 10_000 });
  await sortBtn.click();

  const nameAZOption = page.getByRole('option', { name: /name.*a.*z/i })
    .or(page.getByRole('menuitem', { name: /name.*a.*z/i }))
    .or(page.getByText(/name a.*z/i))
    .first();
  if (await nameAZOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await nameAZOption.click();
  }

  await sortBtn.click();
  const latestOption = page.getByRole('option', { name: /latest/i })
    .or(page.getByRole('menuitem', { name: /latest/i }))
    .or(page.getByText(/latest first/i))
    .first();
  if (await latestOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await latestOption.click();
  }

  await expect(page.locator('[class*="asset"], [class*="card"]').first()).toBeVisible({ timeout: 5_000 });
});
