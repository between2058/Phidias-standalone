// kiwi_test_id: WC-UI-013
import { test } from '@playwright/test';

// FIXME: Requires portal PhidiasRoute to pass user="" attribute.
// Modify PhidiasRoute.jsx in portal to pass user="" to <phidias-app>.
// Then remove test.fixme() and run:
//   PLAYWRIGHT_NO_SERVER=1 npx playwright test WC-UI-013.spec.ts --project=portal-integration
test.fixme(true, 'Requires portal configmap: PhidiasRoute must pass user="" to <phidias-app>');

test('WC-UI-013 | Home — user attribute empty shows fallback, no crash', async ({ page }) => {
  // Navigate to /phidias and verify hero shows "Welcome back, " or fallback, not null/undefined
});
