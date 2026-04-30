// kiwi_test_id: PHI-INT-N-008
import { test, expect } from '@playwright/test';
import { goToImageWorkspace, TEST_IMAGE } from './helpers';

test('PHI-INT-N-008 | Image generation — image editing with reference', async ({ page }) => {
  await goToImageWorkspace(page);

  // Upload a reference image
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'reference.jpg', mimeType: 'image/jpeg', buffer: TEST_IMAGE });

  // Enter edit prompt
  const promptInput = page.locator('textarea, input[type="text"]').first();
  await promptInput.fill('change background to a forest');

  const generateBtn = page.getByRole('button', { name: /generate/i }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 30_000 });
  await generateBtn.click();

  // Wait for generated result — use alt^="Generated" to avoid matching the upload preview (alt="preview")
  await expect(page.locator('img[alt^="Generated"]').first()).toBeVisible({ timeout: 300_000 });
});
