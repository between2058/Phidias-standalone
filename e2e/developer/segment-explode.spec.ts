import { test, expect } from '@playwright/test';

test.describe('Segment exploded view', () => {
  test('Explode toggle is present and disabled with no model loaded', async ({ page }) => {
    await page.goto('/workspace/segment');

    const explodeBtn = page.getByTestId('explode-toggle');
    await expect(explodeBtn).toBeVisible({ timeout: 15_000 });

    // With no model loaded there are no top-level parts → button is disabled,
    // and the magnitude slider is not rendered.
    await expect(explodeBtn).toBeDisabled();
    await expect(page.getByTestId('explode-amount')).toHaveCount(0);
  });
});
