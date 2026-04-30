// kiwi_test_id: WC-ERR-006
import { test } from '@playwright/test';

// FIXME: Requires code change to inject a crash-triggering prop into a WC component.
// In phidias-standalone source, add a debug crash hook (e.g., if window.__debugCrash) to a component,
// rebuild WC, and deploy. Then remove test.fixme() and trigger the crash via page.evaluate().
test.fixme(true, 'Requires debug crash injection hook in WC component code + rebuild + redeploy');

test('WC-ERR-006 | WC internal React crash — Error Boundary shows fallback UI', async ({ page }) => {
  // Steps after code change:
  // 1. Navigate to /phidias
  // 2. Trigger crash via page.evaluate(() => { window.__debugCrash = true; })
  // 3. Verify WC area shows fallback UI
  // 4. Verify Portal NavBar and other routes still work
});
