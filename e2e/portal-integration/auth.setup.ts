/**
 * Portal Authentication Setup
 *
 * Runs as the "portal-setup" project before any portal-integration tests.
 * Performs a full login with credentials phidias / phidias, then persists
 * the browser storage state so all portal-integration tests start authenticated.
 *
 * Storage state: playwright/.auth/portal.json
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.resolve('playwright/.auth/portal.json');

setup('authenticate into portal as phidias user', async ({ page }) => {
  await page.goto('/');

  // ── Detect and fill login form ────────────────────────────────────────────
  // Multiple selector strategies for resilience against portal UI variation.
  // UNSTABLE: update this file if portal login UI changes.

  const usernameInput = page
    .getByLabel(/username|user name|帳號|account/i)
    .or(page.getByPlaceholder(/username|user name|帳號|account/i))
    .or(page.locator('input[name="username"], input[name="account"]').first())
    .or(page.locator('input[type="text"]').first());

  const passwordInput = page
    .getByLabel(/password|密碼/i)
    .or(page.getByPlaceholder(/password|密碼/i))
    .or(page.locator('input[type="password"]').first());

  await expect(usernameInput).toBeVisible({ timeout: 20_000 });
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });

  await usernameInput.fill('phidias');
  await passwordInput.fill('phidias');

  const submitButton = page
    .getByRole('button', { name: /log.?in|sign.?in|登入|submit/i })
    .or(page.locator('button[type="submit"]').first());

  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();

  // ── Verify login success ──────────────────────────────────────────────────
  // After login, URL should leave the login page.
  await expect(page).not.toHaveURL(/login|signin|auth/i, { timeout: 30_000 });

  // Persist storage state for reuse
  await page.context().storageState({ path: AUTH_FILE });
});
