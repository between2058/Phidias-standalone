// kiwi_test_id: PHI-INT-N-039
import { test } from '@playwright/test';

// FIXME: Requires k8s configmap change before running.
// In the phidias-standalone ConfigMap, set:
//   VLM_API_URL=<anthropic-compatible-endpoint>  (e.g., https://api.anthropic.com/v1/messages)
//   VLM_API_KEY=<valid-anthropic-key>
// Then remove test.fixme() and run:
//   PLAYWRIGHT_NO_SERVER=1 npx playwright test PHI-INT-N-039.spec.ts --project=standalone
test.fixme(true, 'Requires k8s configmap: VLM_API_URL=<anthropic-endpoint>, VLM_API_KEY=<key>');

test('PHI-INT-N-039 | Smart Organize — Anthropic VLM', async ({ page }) => {
  // Steps after configmap change:
  // 1. Navigate to /workspace/segment
  // 2. Upload test-model.glb and run segmentation
  // 3. Click Smart Organize button
  // 4. Verify parts panel updates with AI-named parts
  // 5. Verify no user-visible errors
});
