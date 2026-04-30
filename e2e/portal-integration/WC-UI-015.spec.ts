// kiwi_test_id: WC-UI-015
import { test } from '@playwright/test';

// FIXME: Requires portal PhidiasRoute to pass host-app="other-app".
// Modify PhidiasRoute.jsx in portal to pass host-app="other-app" to <phidias-app>.
// Then remove test.fixme() and run:
//   PLAYWRIGHT_NO_SERVER=1 npx playwright test WC-UI-015.spec.ts --project=portal-integration
test.fixme(true, 'Requires portal configmap: PhidiasRoute must pass host-app="other-app" to <phidias-app>');

test('WC-UI-015 | WC mode — no "Upload to Pegaverse" when host-app != pegaverse', async ({ page }) => {
  // Right-click asset, verify "Upload to Pegaverse" absent from context menu
});
