// kiwi_test_id: WC-ERR-007
import { test } from '@playwright/test';

// FIXME: Requires replacing phidias-wc.js on phidias-static nginx with a corrupted file.
// Steps to set up:
//   1. kubectl exec into phidias-static pod
//   2. Replace /usr/share/nginx/html/phidias-wc.js with a file containing "SYNTAX ERROR!!!"
//   3. Remove test.fixme() and run the test
//   4. Restore the original file after testing
test.fixme(true, 'Requires replacing phidias-wc.js on phidias-static nginx with corrupted file');

test('WC-ERR-007 | Corrupted WC bundle — portal shows error UI', async ({ page }) => {
  // Steps after bundle corruption:
  // 1. Navigate to /phidias
  // 2. Verify error UI is displayed (not blank page)
  // 3. Verify Portal other routes still accessible
});
