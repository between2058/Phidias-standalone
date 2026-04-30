// kiwi_test_id: WC-ERR-005
import { test } from '@playwright/test';

// FIXME: Requires portal configmap change before running.
// Set REACT_APP_PHIDIAS_ENABLED=false in portal ConfigMap and rebuild portal.
// Then remove test.fixme() and run:
//   PLAYWRIGHT_NO_SERVER=1 npx playwright test WC-ERR-005.spec.ts --project=portal-integration
test.fixme(true, 'Requires portal configmap: REACT_APP_PHIDIAS_ENABLED=false + portal rebuild');

test('WC-ERR-005 | PHIDIAS_ENABLED=false — /phidias shows 404', async ({ page }) => {
  // Steps after configmap change:
  // 1. Navigate to /phidias
  // 2. Verify 404 page is shown
  // 3. Verify PhidiasRoute is not loaded
});
