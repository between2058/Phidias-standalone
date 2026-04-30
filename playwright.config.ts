import { defineConfig, devices } from '@playwright/test';

/**
 * Phidias Standalone — Playwright configuration
 *
 * Five test projects:
 *   1. "developer"           — API contract tests (developer-faceted), localhost:3000
 *   2. "user-journeys"       — Full browser user-journey tests (user-faceted), localhost:3000
 *   3. "standalone"          — Smoke tests against deployed standalone (no login required)
 *   4. "portal-setup"        — Auth setup: login to portal and save storageState
 *   5. "portal-integration"  — Smoke tests against deployed portal (authenticated)
 *
 * For projects 1 & 2, the webServer block starts the Next.js dev server automatically.
 * Set PLAYWRIGHT_NO_SERVER=1 to skip the dev server (required when running 3–5 only).
 *
 * Deployed target URLs:
 *   Standalone:  http://172.18.245.177:31200  (no auth)
 *   Portal:      http://172.18.245.177:30147  (phidias / phidias)
 */

const STANDALONE_BASE_URL = 'http://172.18.245.177:31200';
const PORTAL_BASE_URL = 'http://172.18.245.177:30147';
const PORTAL_STORAGE_STATE = 'playwright/.auth/portal.json';

export default defineConfig({
  testDir: './e2e',

  /* 將 workers 設為 1 */
  workers: 1,

  /* Timeout for each test */
  timeout: 180_000,

  /* Timeout for each action (click, fill, …) */
  use: {
    actionTimeout: 120_000,
    navigationTimeout: 30_000,
    baseURL: 'http://localhost:3000',
    /* Capture screenshot only on failure */
    screenshot: 'only-on-failure',
    /* Keep a trace on the first retry */
    trace: 'on-first-retry',
    // launchOptions: {
    //   devtools: true,
    // },
  },

  /* HTML report in playwright-report/ */
  reporter: [['html', { open: 'never' }], ['list']],

  projects: [
    // ── Local dev-server tests (existing) ──────────────────────────────────
    {
      name: 'developer',
      testMatch: '**/developer/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
    {
      name: 'user-journeys',
      testMatch: '**/user/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        viewport: { width: 1440, height: 900 },
      },
    },

    // ── Deployed standalone (no login) ─────────────────────────────────────
    {
      name: 'standalone',
      testMatch: '**/standalone/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        baseURL: STANDALONE_BASE_URL,
        viewport: { width: 1440, height: 900 },
      },
    },

    // ── Deployed portal — auth setup ───────────────────────────────────────
    {
      name: 'portal-setup',
      testMatch: '**/portal-integration/auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        baseURL: PORTAL_BASE_URL,
        viewport: { width: 1440, height: 900 },
      },
    },

    // ── Deployed portal — integration tests (requires login) ───────────────
    {
      name: 'portal-integration',
      testMatch: '**/portal-integration/**/*.spec.ts',
      dependencies: ['portal-setup'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        baseURL: PORTAL_BASE_URL,
        storageState: PORTAL_STORAGE_STATE,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  /**
   * Spin up Next.js dev server before the tests.
   * If you already have the dev server running, set the
   * PLAYWRIGHT_NO_SERVER=1 env var to skip this.
   * When running only standalone / portal-integration tests,
   * always set PLAYWRIGHT_NO_SERVER=1.
   */
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
});
