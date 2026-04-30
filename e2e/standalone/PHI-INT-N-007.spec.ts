// kiwi_test_id: PHI-INT-N-007
import { test, expect } from '@playwright/test';
import { goToImageWorkspace, triggerImageGeneration } from './helpers';

test('PHI-INT-N-007 | Image generation — multi-sample generation (4 images)', async ({ page }) => {
  test.setTimeout(660_000); // 4-image batch generation; allow 11 min total

  await goToImageWorkspace(page);

  // Samples is a PillGroup (buttons: '1','2','4','6').
  // Must use exact:true — default substring match would also hit the Aspect Ratio '4:3' button.
  const sampleBtn4 = page.getByRole('button', { name: '4', exact: true }).first();
  if (await sampleBtn4.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await sampleBtn4.click();
  }

  await triggerImageGeneration(page, 'a blue sphere on a surface');

  // Wait for all 4 generated images (alt="Generated 1" … "Generated 4")
  await expect(page.locator('img[alt^="Generated"]').nth(3)).toBeVisible({ timeout: 600_000 });

  // Each image should be independently navigable to 3D (hover reveals "→ to 3D" button)
  const firstImage = page.locator('img[alt^="Generated"]').first();
  await firstImage.hover();
  await expect(page.locator('button').filter({ hasText: '→ to 3D' }).first()).toBeVisible({ timeout: 30_000 });
});
