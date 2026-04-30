// kiwi_test_id: WC-STATIC-007
import { test } from '@playwright/test';

// FIXME: Requires portal configmap change before running.
// Set REACT_APP_PHIDIAS_CDN_BASE=http://invalid-host/phidias in portal ConfigMap and rebuild.
// Then remove test.fixme() and run:
//   PLAYWRIGHT_NO_SERVER=1 npx playwright test WC-STATIC-007.spec.ts --project=portal-integration
test.fixme(true, 'Requires portal configmap: REACT_APP_PHIDIAS_CDN_BASE=http://invalid-host/phidias');

test('WC-STATIC-007 | CDN base unreachable — portal shows error UI', async ({ page }) => {
  // Steps after configmap change:
  // 1. Navigate to /phidias
  // 2. Verify "Could not load Phidias" error UI appears
  // 3. Verify Portal other routes still work
});
