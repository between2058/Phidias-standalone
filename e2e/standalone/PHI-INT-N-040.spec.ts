// kiwi_test_id: PHI-INT-N-040
import { test, expect } from '@playwright/test';
import { goToSegmentWorkspace, runSegmentation, GLB_EXISTS, TEST_GLB_PATH } from './helpers';
import fs from 'fs';

test('PHI-INT-N-040 | Smart Organize — fallback name for missing parts', async ({ page }) => {
  test.skip(!GLB_EXISTS, 'Requires e2e/fixtures/test-model.glb — see e2e/fixtures/README.md');
  test.setTimeout(360_000);

  await goToSegmentWorkspace(page);

  const glbBuffer = fs.readFileSync(TEST_GLB_PATH);
  await runSegmentation(page, glbBuffer);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300_000});

  // Intercept VLM response to return only partial results (omit one part)
  await page.route('**/smart-organize**', async (route) => {
    const response = {
      parts: [
        { id: 0, name: 'Wheel', group: 'Drivetrain' },
        { id: 1, name: 'Frame', group: 'Body' },
        // Part 2 intentionally omitted to trigger fallback naming
      ],
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  const smartOrganizeBtn = page.getByRole('button', { name: /smart.?organize/i }).first();
  await expect(smartOrganizeBtn).toBeVisible({ timeout: 300_000});
  await smartOrganizeBtn.click();

  // Wait for parts panel to update
  await expect(page.locator('[class*="part"], [class*="segment-item"]').first())
    .toBeVisible({ timeout: 300_000});

  // Missing part should show fallback: "Part N (colorname)" and "Ungrouped"
  const fallbackPart = page.getByText(/part\s+\d+\s*\(|ungrouped/i).first();
  await expect(fallbackPart).toBeVisible({ timeout: 300_000});
});
