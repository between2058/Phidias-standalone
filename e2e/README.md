# E2E Test Suite — Phidias Standalone & Portal Integration

## Overview

This directory contains Playwright E2E tests organized into four projects:

| Project | Target | Auth | Command |
|---|---|---|---|
| `developer` | localhost:3000 | None | `npx playwright test --project=developer` |
| `user-journeys` | localhost:3000 | None | `npx playwright test --project=user-journeys` |
| `standalone` | http://172.18.245.177:31200 | None | `PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=standalone` |
| `portal-setup` | http://172.18.245.177:30147 | Logs in | (runs automatically before portal-integration) |
| `portal-integration` | http://172.18.245.177:30147 | phidias/phidias | `PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=portal-integration` |

---

## Quick Start

### Run all deployed tests (standalone + portal)

```bash
cd phidias-standalone
PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=standalone --project=portal-integration
```

### Run a single test by Kiwi test ID

```bash
# Standalone test
PLAYWRIGHT_NO_SERVER=1 npx playwright test e2e/standalone/PHI-INT-N-013.spec.ts --project=standalone

# Portal test
PLAYWRIGHT_NO_SERVER=1 npx playwright test e2e/portal-integration/WC-UI-002.spec.ts --project=portal-integration
```

### Run all standalone tests

```bash
PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=standalone
```

### Run all portal tests

```bash
PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=portal-integration
```

### Open HTML report

```bash
npx playwright show-report
```

---

## File Structure

```
e2e/
├── standalone/               # Phidias Standalone tests (31200)
│   ├── helpers.ts            # Shared utilities (TINY_PNG, goToWorkspace, etc.)
│   ├── PHI-INT-N-006.spec.ts # Image generation — text to image
│   ├── PHI-INT-N-007.spec.ts # Image generation — multi-sample
│   ├── PHI-INT-N-008.spec.ts # Image generation — image editing
│   ├── PHI-INT-N-009.spec.ts # Image generation — multi-view
│   ├── PHI-INT-N-010.spec.ts # Image generation — send to model workspace
│   ├── PHI-INT-N-011.spec.ts # Image generation — send multi-view to model
│   ├── PHI-INT-N-012.spec.ts # Model generation — text to 3D
│   ├── PHI-INT-N-013.spec.ts # Model generation — single image
│   ├── PHI-INT-N-014.spec.ts # Model generation — multi-view
│   ├── PHI-INT-N-015.spec.ts # Model generation — Stochastic algorithm
│   ├── PHI-INT-N-016.spec.ts # Model generation — Multidiffusion algorithm
│   ├── PHI-INT-N-017.spec.ts # Model generation — batch (3 images)
│   ├── PHI-INT-N-018.spec.ts # Model generation — advanced parameters
│   ├── PHI-INT-N-019.spec.ts # Model generation — GLB rendered in viewport
│   ├── PHI-INT-N-020.spec.ts # Model generation — export GLB
│   ├── PHI-INT-N-028.spec.ts # 3D segmentation — upload GLB and segment
│   ├── PHI-INT-N-029.spec.ts # 3D segmentation — custom parameters
│   ├── PHI-INT-N-030.spec.ts # 3D segmentation — color-coded parts
│   ├── PHI-INT-N-031.spec.ts # 3D segmentation — trigger Smart Organize
│   ├── PHI-INT-N-032.spec.ts # 3D segmentation — part visibility toggle
│   ├── PHI-INT-N-033.spec.ts # 3D segmentation — export segmented GLB
│   ├── PHI-INT-N-038.spec.ts # Smart Organize — OpenAI-compatible VLM
│   ├── PHI-INT-N-039.spec.ts # Smart Organize — Anthropic VLM [FIXME]
│   ├── PHI-INT-N-040.spec.ts # Smart Organize — fallback naming
│   ├── PHI-INT-E-002.spec.ts # Error: connection refused
│   ├── PHI-INT-E-003.spec.ts # Error: image gen timeout (300s)
│   ├── PHI-INT-E-004.spec.ts # Error: model gen timeout (300s)
│   ├── PHI-INT-E-005.spec.ts # Error: batch timeout (600s)
│   ├── PHI-INT-E-009.spec.ts # Error: P3SAM timeout (300s)
│   ├── PHI-INT-E-010.spec.ts # Error: VLM timeout (600s)
│   ├── PHI-INT-E-011.spec.ts # Error: empty prompt validation
│   ├── PHI-INT-E-012.spec.ts # Error: no file selected
│   ├── PHI-INT-E-013.spec.ts # Error: non-GLB file rejected
│   ├── PHI-INT-E-020.spec.ts # Error: upstream 502
│   └── PHI-INT-E-034.spec.ts # Error: download failure after generation
├── portal-integration/       # Portal × WC tests (30147)
│   ├── auth.setup.ts         # Login setup (runs as portal-setup project)
│   ├── helpers.ts            # Shared utilities (goToPhidias, generateModelInPortal, etc.)
│   ├── WC-UI-001.spec.ts     # TopNavBar not rendered in WC mode
│   ├── WC-UI-002.spec.ts     # Welcome message shows username
│   ├── WC-UI-003.spec.ts     # Quick Start links SPA navigation
│   ├── WC-UI-004.spec.ts     # Workspace TopNavBar absent
│   ├── WC-UI-005.spec.ts     # Upload to Pegaverse in context menu
│   ├── WC-UI-008.spec.ts     # Asset Panel tab switching
│   ├── WC-UI-009.spec.ts     # Navigate away and back keeps WC
│   ├── WC-UI-010.spec.ts     # Progress badge during generation
│   ├── WC-UI-011.spec.ts     # Asset Grid sorting
│   ├── WC-UI-012.spec.ts     # Asset Grid filtering
│   ├── WC-UI-013.spec.ts     # Empty user attribute fallback [FIXME]
│   ├── WC-UI-014.spec.ts     # Context menu during generating state
│   ├── WC-UI-015.spec.ts     # No Upload to Pegaverse for other host-app [FIXME]
│   ├── WC-UPLOAD-001.spec.ts # Full upload flow — select folder and upload
│   ├── WC-UPLOAD-002.spec.ts # Folder tree expand/collapse
│   ├── WC-UPLOAD-003.spec.ts # Switch folder selection
│   ├── WC-UPLOAD-004.spec.ts # Cancel before upload
│   ├── WC-UPLOAD-005.spec.ts # Large file progress bar
│   ├── WC-UPLOAD-006.spec.ts # Empty folder tree state
│   ├── WC-UPLOAD-007.spec.ts # Auto-append .glb extension
│   ├── WC-UPLOAD-008.spec.ts # Cancel disabled during upload
│   ├── WC-UPLOAD-009.spec.ts # Upload button disabled without folder
│   ├── WC-UPLOAD-010.spec.ts # getAssets failure empty state
│   ├── WC-UPLOAD-012.spec.ts # Fetch modelUrl failure unlocks modal
│   ├── WC-UPLOAD-013.spec.ts # XHR upload failure unlocks modal
│   ├── WC-UPLOAD-014.spec.ts # getUploadId failure no job created
│   ├── WC-API-008.spec.ts    # Backend 401 shows auth error
│   ├── WC-API-009.spec.ts    # Backend 500 shows server error
│   ├── WC-STATIC-001.spec.ts # WC bundle loaded from CDN base
│   ├── WC-STATIC-003.spec.ts # 3D static assets resolve from staticBase
│   ├── WC-STATIC-007.spec.ts # CDN unreachable shows error UI [FIXME]
│   ├── WC-STATIC-008.spec.ts # HDRI 404 graceful degradation
│   ├── WC-ERR-004.spec.ts    # Unauthenticated redirect to login
│   ├── WC-ERR-005.spec.ts    # PHIDIAS_ENABLED=false shows 404 [FIXME]
│   ├── WC-ERR-006.spec.ts    # Error Boundary fallback UI [FIXME]
│   ├── WC-ERR-007.spec.ts    # Corrupted bundle shows error [FIXME]
│   ├── WC-REL-001.spec.ts    # WC remounts after navigation
│   ├── WC-REL-003.spec.ts    # Concurrent generation + upload
│   └── WC-REL-005.spec.ts    # Page refresh reinitializes WC
└── fixtures/
    └── README.md             # Instructions for test-model.glb fixture
```

---

## Tests Requiring k8s Configmap Changes

These tests are marked `test.fixme()` and **cannot run** until the corresponding configmap change is applied to the k8s cluster. After the change, remove `test.fixme()` and run the individual file.

| Test ID | File | Required Change |
|---|---|---|
| PHI-INT-N-039 | `standalone/PHI-INT-N-039.spec.ts` | phidias-standalone ConfigMap: `VLM_API_URL=<anthropic-endpoint>`, `VLM_API_KEY=<key>` |
| WC-UI-013 | `portal-integration/WC-UI-013.spec.ts` | portal PhidiasRoute: pass `user=""` to `<phidias-app>` |
| WC-UI-015 | `portal-integration/WC-UI-015.spec.ts` | portal PhidiasRoute: pass `host-app="other-app"` to `<phidias-app>` |
| WC-STATIC-007 | `portal-integration/WC-STATIC-007.spec.ts` | portal ConfigMap: `REACT_APP_PHIDIAS_CDN_BASE=http://invalid-host/phidias` |
| WC-ERR-005 | `portal-integration/WC-ERR-005.spec.ts` | portal ConfigMap: `REACT_APP_PHIDIAS_ENABLED=false` + rebuild |
| WC-ERR-006 | `portal-integration/WC-ERR-006.spec.ts` | Inject crash-triggering prop into WC component code |
| WC-ERR-007 | `portal-integration/WC-ERR-007.spec.ts` | Replace `phidias-wc.js` on phidias-static nginx with corrupted file |

### How to run after configmap change

```bash
# 1. Apply configmap change to k8s cluster
# 2. Wait for pod restart
# 3. Remove test.fixme() from the spec file
# 4. Run the specific test:
PLAYWRIGHT_NO_SERVER=1 npx playwright test e2e/standalone/PHI-INT-N-039.spec.ts --project=standalone
PLAYWRIGHT_NO_SERVER=1 npx playwright test e2e/portal-integration/WC-UI-013.spec.ts --project=portal-integration
```

---

## GLB Fixture

Segment workspace tests (PHI-INT-N-028 through N-033, N-038, N-040) require a real GLB file:

```
e2e/fixtures/test-model.glb
```

See `e2e/fixtures/README.md` for details on how to obtain/create this file.

Tests that depend on it call `test.skip(!GLB_EXISTS, ...)` and are safely skipped when absent.

---

## Timeout Reference

| Test | Timeout |
|---|---|
| Image generation (single) | 120s–180s |
| Model generation (single) | 360s |
| Model generation (batch 3×) | 720s |
| 3D segmentation | 360s |
| Smart Organize | 600s |
| Timeout error tests | test timeout = client timeout + 100s buffer |

---

## Parallelism

By default, Playwright runs spec files in parallel (one worker per file). This is intentional — long-running tests like segment tests (each 300s) run simultaneously instead of sequentially.

To control workers:

```bash
# Run with 4 workers (default)
PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=standalone --workers=4

# Run sequentially (debug mode)
PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=standalone --workers=1
```

---

## Updating Kiwi

After running tests, the Playwright HTML report (`playwright-report/index.html`) maps 1:1 to Kiwi test IDs via file names. Each file is one test case — update Kiwi status directly from the report.
