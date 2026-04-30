# Phidias Phase 1 Pilot — Texture Tab Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Texture tab from the old repo (`github.com/between2058/Phidias-standalone` branch `feat/viewer-export-ux-improvements` @ `85f68d6`) into the new repo, routed at `/workspace/texture`, passing verification level A (compile + render; no polling rewiring).

**Architecture:** Additive surgical merge. Each of the 6 layers (L1–L6) is one commit; `pnpm build` / `pnpm tsc --noEmit` must be green before the next layer starts. The old repo's async pattern is preserved verbatim by adding an `editImageLegacy` helper alongside the new polling-style `editImage`. Shared components (`ExportDropdown`, `ThreeViewport`, `workspace-context`, `ProgressBar`) are NOT touched per spec Q5=A.

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Three.js/R3F, Tailwind, pnpm.

**Spec reference:** `docs/superpowers/specs/2026-04-15-phidias-migration-phase1-texture-design.md`

---

## File Structure

**Created:**
- `src/app/workspace/texture/page.tsx` (228 lines, copied from old repo)
- `src/app/api/phidias/trellis2/[...path]/route.ts` (59 lines, copied from old repo)

**Modified:**
- `src/lib/api/phidias.ts` — adds `textureTrellis` function + `editImageLegacy` function in a new `// ── Texture tab (legacy async) ──` section at EOF.
- `src/components/texture/TextureGeneratePanel.tsx` — overwritten with old repo's version (451 lines).
- `src/wc-entry.tsx` — two small edits: fix lazy import path + add `<Route>`.
- `.env.example` — append `TRELLIS2_API_URL=`.

**Deleted:**
- `src/app/workspace/_texture/` (underscore-prefixed disabled folder replaced by `texture/`).

**Untouched (even though diffed between repos):**
- `src/lib/api/types.ts` — `ProgressUpdate` and `TextureRequest` verified identical.
- `src/components/shared/ExportDropdown.tsx`, `ThreeViewport.tsx`
- `src/lib/workspace-context.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/app/workspace/layout.tsx`, `src/app/globals.css`
- `package.json`, `pnpm-lock.yaml`, `next.config.mjs`, `tsconfig.json`, `vite.wc.config.mts` (skip-worktree protected for local SDK stub)

---

## Prerequisites

Before starting, verify these paths exist on this machine:

- Old repo present at `/Users/between2058/Documents/code/phidias-standalone` with branch `feat/viewer-export-ux-improvements` checked out locally (or at least fetched as `github/feat/viewer-export-ux-improvements`).
- New repo (this one) has a clean `git status` (the skip-worktree workaround files do not show as dirty).

---

## Task 0: Pre-flight Verification

Confirms nothing has drifted since the spec was written.

**Files:** none (read-only checks)

- [ ] **Step 0.1: Verify cutoff commit on old repo**

Run:
```bash
cd /Users/between2058/Documents/code/phidias-standalone
git rev-parse github/feat/viewer-export-ux-improvements
```
Expected output: `85f68d68... ` (starts with `85f68d6`)

- [ ] **Step 0.2: Verify identical types (expect clean diff → L1 NO-OP)**

Run:
```bash
OLD=/Users/between2058/Documents/code/phidias-standalone
NEW=/Users/between2058/Documents/gitlab_code/phidias-standalone
awk '/^export interface ProgressUpdate/,/^}$/' $OLD/src/lib/api/types.ts > /tmp/old_pu.ts
awk '/^export interface ProgressUpdate/,/^}$/' $NEW/src/lib/api/types.ts > /tmp/new_pu.ts
diff /tmp/old_pu.ts /tmp/new_pu.ts
awk '/^export interface TextureRequest/,/^}$/' $OLD/src/lib/api/types.ts > /tmp/old_tr.ts
awk '/^export interface TextureRequest/,/^}$/' $NEW/src/lib/api/types.ts > /tmp/new_tr.ts
diff /tmp/old_tr.ts /tmp/new_tr.ts
```
Expected output: both diffs produce no output (identical). If either shows a diff, PAUSE — L1 is no longer NO-OP and needs merging; update this plan first.

- [ ] **Step 0.3: Verify new repo has required infra symbols**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
grep -nE "^(export )?(async )?function (getBackendApi|downloadPhidiasImage|blobToDataURL)" src/lib/api/phidias.ts
grep -n "ReconViaGenOutput\|QwenEditResponse" src/lib/api/phidias.ts
grep -nE "^export" src/app/api/phidias/_proxy.ts
```
Expected output contains:
- `getBackendApi`, `downloadPhidiasImage`, `blobToDataURL` functions
- `ReconViaGenOutput`, `QwenEditResponse` interfaces
- `export async function proxyRequest(` in `_proxy.ts`

If any symbol is missing, PAUSE — L2 cannot proceed without them.

- [ ] **Step 0.4: Confirm clean starting state**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git status --short
git ls-files -v | grep '^S '
```
Expected: `git status --short` output is empty (or only contains pre-existing local files unrelated to this task). The `ls-files -v | grep ^S` output should show the 5 skip-worktree'd files: `next.config.mjs`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.wc.config.mts`.

If `git status` shows modifications to files we will edit in this plan (e.g., `src/lib/api/phidias.ts`, `src/wc-entry.tsx`), PAUSE and reconcile before starting.

---

## Task 1: L1 — Types (NO-OP Verification)

Per Task 0.2, types are identical. This task only records that verification happened; no file changes.

**Files:** none

- [ ] **Step 1.1: Write a one-line confirmation commit (empty tree)**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git commit --allow-empty -m "chore(texture): L1 — types.ts already matches old repo (no changes)"
```

Rationale: Keeping the layer-per-commit discipline means each layer has a git anchor we can revert if something downstream exposes a hidden issue.

If you prefer not to leave an empty commit in history, skip this step and fold the rationale into Task 2's commit message.

---

## Task 2: L2 — API Client Functions (Add `textureTrellis` + `editImageLegacy`)

Adds two functions to the end of `src/lib/api/phidias.ts` in an explicit legacy section. This preserves the old (non-polling) async behavior that the Texture tab expects, while leaving the new polling-style `editImage` / `textureTrellis`-free codepaths of the new repo untouched.

**Files:**
- Modify: `src/lib/api/phidias.ts` (append new section at EOF)

- [ ] **Step 2.1: Append legacy section to `src/lib/api/phidias.ts`**

Open `src/lib/api/phidias.ts` and append the following block at the end of the file (after the last existing export, before any trailing newline):

```typescript

// ============================================================================
// ── Texture tab (legacy async) ──────────────────────────────────────────────
// Functions in this section preserve the pre-polling callback/direct-result
// async patterns that the Texture tab (ported from the old repo) expects.
// Do NOT merge these into the polling-style variants above — they return
// fully-resolved results, not job submission handles.
// ============================================================================

/**
 * Texturing pipeline against Trellis.2 backend.
 * Returns a fully-resolved ReconViaGenOutput (NOT a polling handle).
 *
 * Ported verbatim from old repo phidias.ts lines 438-476 (commit 85f68d6).
 */
export async function textureTrellis(
  referenceImage: File | Blob,
  meshFile: File | Blob,
  params: {
    seed?: number;
    resolution?: number;
    texture_size?: number;
  } = {},
): Promise<ReconViaGenOutput> {
  const formData = new FormData();
  // Ensure blobs have correct MIME type and filename for FastAPI validation
  const imgBlob = new File(
    [referenceImage],
    'reference.png',
    { type: referenceImage.type || 'image/png' },
  );
  const glbBlob = new File(
    [meshFile],
    'model.glb',
    { type: meshFile.type || 'model/gltf-binary' },
  );
  formData.append('file', imgBlob, 'reference.png');
  formData.append('mesh_file', glbBlob, 'model.glb');
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.resolution !== undefined)
    formData.append('resolution', String(params.resolution));
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/trellis2/texture`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}

/**
 * Legacy direct-result Qwen edit pipeline: POSTs to /qwen/edit, then downloads
 * every image URL in the response and converts each to a data URL, returning
 * the enriched QwenEditResponse synchronously.
 *
 * NOTE: the new repo's `editImage` returns a JobSubmitResponse for polling.
 * This function keeps the OLD direct-result contract for the Texture tab.
 *
 * Ported verbatim from old repo phidias.ts lines 760-797 (commit 85f68d6).
 */
export async function editImageLegacy(
  imageBlob: File | Blob,
  prompt: string,
  params: Record<string, unknown> = {},
): Promise<QwenEditResponse> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'image.png');
  formData.append('prompt', prompt);
  if (params.steps !== undefined)
    formData.append('steps', String(params.steps));
  if (params.cfg_scale !== undefined)
    formData.append('cfg_scale', String(params.cfg_scale));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.num_samples !== undefined)
    formData.append('num_samples', String(params.num_samples));

  const { data } = await client.post<QwenEditResponse>(
    `${getBackendApi()}/phidias/qwen/edit`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );

  const requestId = data.request_id;
  const downloadedUrls = await Promise.all(
    (data.urls || []).map(async (url) => {
      const fileName = url.split('/').pop() || '';
      const blob = await downloadPhidiasImage(requestId, fileName, 'qwen');
      return await blobToDataURL(blob);
    }),
  );

  return { ...data, urls: downloadedUrls };
}
```

- [ ] **Step 2.2: Type-check**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
pnpm exec tsc --noEmit
```
Expected: exit code 0, no new TypeScript errors. If `ReconViaGenOutput` or `QwenEditResponse` are reported as not found, they need to be imported or declared — investigate (they should exist per Task 0.3).

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/api/phidias.ts
git commit -m "feat(texture): L2 — add textureTrellis + editImageLegacy for legacy async pattern"
```

---

## Task 3: L3 — Add Trellis2 Proxy Route + Env Var

Standalone mode forwards `/phidias/trellis2/*` requests to the Trellis.2 backend. This task copies the 59-line proxy route from the old repo and registers the env var.

**Files:**
- Create: `src/app/api/phidias/trellis2/[...path]/route.ts`
- Modify: `.env.example`

- [ ] **Step 3.1: Copy the trellis2 proxy folder**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
mkdir -p src/app/api/phidias/trellis2
cp -r /Users/between2058/Documents/code/phidias-standalone/src/app/api/phidias/trellis2/[...path] \
      src/app/api/phidias/trellis2/
```

- [ ] **Step 3.2: Verify file contents**

Run:
```bash
cat src/app/api/phidias/trellis2/\[...path\]/route.ts | head -5
wc -l src/app/api/phidias/trellis2/\[...path\]/route.ts
```
Expected first 5 lines start with `import { NextRequest, NextResponse } from 'next/server';` and total is 59 lines. The `proxyRequest` import uses a relative path `../../_proxy`; the new repo's `_proxy.ts` exports this symbol (verified in Task 0.3) so it should resolve.

- [ ] **Step 3.3: Add env var to `.env.example`**

Append one line to `.env.example`:
```
TRELLIS2_API_URL=
```

- [ ] **Step 3.4: Build check**

Run:
```bash
pnpm build
```
Expected: build completes without errors. The new route is registered but idle until the frontend calls it.

If the build fails with an import error on `proxyRequest`, inspect `src/app/api/phidias/_proxy.ts` to confirm the export name and path.

- [ ] **Step 3.5: Commit**

```bash
git add src/app/api/phidias/trellis2 .env.example
git commit -m "feat(texture): L3 — add trellis2 proxy route + TRELLIS2_API_URL env var"
```

---

## Task 4: L4 — Port TextureGeneratePanel Component

The panel is a self-contained 451-line component. Overwrite wholesale; there is no merge with the new repo's version.

**Files:**
- Modify: `src/components/texture/TextureGeneratePanel.tsx` (full overwrite)

- [ ] **Step 4.1: Copy panel from old repo**

Run:
```bash
cp /Users/between2058/Documents/code/phidias-standalone/src/components/texture/TextureGeneratePanel.tsx \
   /Users/between2058/Documents/gitlab_code/phidias-standalone/src/components/texture/TextureGeneratePanel.tsx
```

- [ ] **Step 4.2: Type-check**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
pnpm exec tsc --noEmit
```
Expected: exit code 0.

Possible failure modes and responses:
- **`Toggle` / `CollapsibleSection` / `PillGroup` prop mismatch in `@/components/ui/ProgressBar`**: both repos export these symbols (verified in spec), but their prop shape may have drifted. If tsc reports prop errors on these components, the minimal fix is to adjust the call site inside `TextureGeneratePanel.tsx` to match the new repo's prop shape. If the drift is wide (multiple unknown props), PAUSE and raise with the user — this borders on Q5=A violation.
- **`cn` utility import fails**: grep `src/lib/utils.ts` for `export function cn` or `export const cn`. Both repos should have it; if not, investigate before proceeding.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/texture/TextureGeneratePanel.tsx
git commit -m "feat(texture): L4 — port TextureGeneratePanel.tsx from old repo"
```

---

## Task 5: L5 — Enable `/workspace/texture` Route + Port Page

Renames `_texture` → `texture` (enables App Router routing), overwrites `page.tsx` with the old repo's 228-line version, and patches the single `editImage` import to use `editImageLegacy`.

**Files:**
- Delete: `src/app/workspace/_texture/`
- Create: `src/app/workspace/texture/page.tsx`

- [ ] **Step 5.1: Remove the underscored folder**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git rm -r src/app/workspace/_texture
```

- [ ] **Step 5.2: Create `texture/` folder and copy page**

Run:
```bash
mkdir -p src/app/workspace/texture
cp /Users/between2058/Documents/code/phidias-standalone/src/app/workspace/texture/page.tsx \
   src/app/workspace/texture/page.tsx
```

- [ ] **Step 5.3: Patch `editImage` → `editImageLegacy` import in the new page**

Open `src/app/workspace/texture/page.tsx`. Find the import line near the top:
```typescript
import { textureTrellis, downloadPhidiasImage, editImage } from '@/lib/api/phidias';
```
Change to:
```typescript
import { textureTrellis, downloadPhidiasImage, editImageLegacy } from '@/lib/api/phidias';
```

Then update the call site (around line 114 of the ported file):
```typescript
const qwenResult = await editImage(screenshotBlob, params.prompt, {
```
Change `editImage` → `editImageLegacy`:
```typescript
const qwenResult = await editImageLegacy(screenshotBlob, params.prompt, {
```

Verify no other references to `editImage` remain in the file:
```bash
grep -n "editImage\b" src/app/workspace/texture/page.tsx
```
Expected: only `editImageLegacy` matches (no bare `editImage`).

- [ ] **Step 5.4: Build**

Run:
```bash
pnpm build
```
Expected: build completes, `/workspace/texture` route appears in Next.js route table.

Possible failure modes:
- **`ExportDropdown` prop drift**: if the call site in `texture/page.tsx` passes props the new repo's `ExportDropdown` doesn't accept, fix locally inside the page (e.g., wrap with adapter or strip unsupported props). Do NOT upgrade `ExportDropdown` (Q5=A).
- **`ThreeViewport.RenderMode` type missing**: verify `src/components/shared/ThreeViewport.tsx` exports `RenderMode`; if not, narrow the import or define a local type alias in `page.tsx`.
- **`useWorkspace` return shape mismatch**: if `useWorkspace()` returns fields the ported page expects but new repo's context doesn't provide, add a guard/default in the page.

- [ ] **Step 5.5: Smoke test in dev server**

Run in one terminal:
```bash
pnpm dev
```

In another terminal (or a browser):
```bash
curl -s -o /dev/null -w "HTTP %{http_code} bytes=%{size_download}\n" http://localhost:3000/workspace/texture
# If port 3000 is busy, try 3001
```
Expected: `HTTP 200`, bytes > 5000.

Then open the URL in a browser. Verify:
- TextureGeneratePanel controls visible (resolution selector, texture size, prompt input, etc.)
- ThreeViewport loading state or empty scene visible
- Browser console has no red errors on page load (network 4xx/5xx from unreachable Trellis2 backend is OK — not a crash)
- Other routes still work: visit `/workspace/model`, `/workspace/image`, `/workspace/segment`, `/` — all should render normally.

- [ ] **Step 5.6: Commit**

```bash
git add src/app/workspace/_texture src/app/workspace/texture
git commit -m "feat(texture): L5 — enable /workspace/texture route + port page.tsx"
```

Note: `git add src/app/workspace/_texture` stages the deletion from Step 5.1.

---

## Task 6: L6 — Wire Web Component Entry

Updates `src/wc-entry.tsx` so that when the app is built as a Web Component, the Texture page loads from the new path and is actually routable.

**Files:**
- Modify: `src/wc-entry.tsx` (two edits)

- [ ] **Step 6.1: Fix the lazy import path**

Open `src/wc-entry.tsx`. Find this line (~line 49):
```typescript
const TexturePage = React.lazy(() => import('./app/workspace/_texture/page'));
```
Change to:
```typescript
const TexturePage = React.lazy(() => import('./app/workspace/texture/page'));
```

- [ ] **Step 6.2: Add the `<Route>` entry**

Inside the `<Routes>` block (~line 95), locate the workspace group:
```tsx
<Route element={<WorkspaceLayoutRoute />}>
  <Route path="workspace/model" element={<ModelPage />} />
  <Route path="workspace/image" element={<ImagePage />} />
  <Route path="workspace/segment" element={<SegmentPage />} />
</Route>
```
Add a texture route after segment:
```tsx
<Route element={<WorkspaceLayoutRoute />}>
  <Route path="workspace/model" element={<ModelPage />} />
  <Route path="workspace/image" element={<ImagePage />} />
  <Route path="workspace/segment" element={<SegmentPage />} />
  <Route path="workspace/texture" element={<TexturePage />} />
</Route>
```

- [ ] **Step 6.3: Type-check**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: exit code 0. (`pnpm build:wc` is known-broken due to the local SDK stub in `vite.wc.config.mts`; per spec we do not attempt the WC bundle build in this phase.)

- [ ] **Step 6.4: Commit**

```bash
git add src/wc-entry.tsx
git commit -m "feat(texture): L6 — wire /workspace/texture into wc-entry Routes"
```

---

## Task 7: Final Regression Smoke Test

End-to-end verification that Phase 1 is complete and nothing else broke.

**Files:** none (verification only)

- [ ] **Step 7.1: Clean build**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
rm -rf .next
pnpm build
```
Expected: exit code 0.

- [ ] **Step 7.2: Dev server smoke test**

Run:
```bash
pnpm dev
```
Visit each in a browser and confirm no red console errors on page load:
- `/` — home page
- `/workspace/model`
- `/workspace/image`
- `/workspace/segment`
- `/workspace/texture` (NEW)

- [ ] **Step 7.3: Confirm skip-worktree protection held**

Run:
```bash
git status --short
git ls-files -v | grep '^S '
```
Expected:
- `git status --short` is empty (all Phase 1 changes already committed across Tasks 1–6).
- The 5 skip-worktree files are still marked `S` (unchanged by this plan).

If any of the 5 skip-worktree files appears as modified, STOP and raise — the plan was supposed to avoid them; something drifted.

- [ ] **Step 7.4: Log commits for this phase**

Run:
```bash
git log --oneline -10
```
Expected: the most recent commits are L1–L6 (plus the Task 1 empty commit if kept). Each should have a clear `feat(texture):` or `chore(texture):` prefix.

- [ ] **Step 7.5: Verification bar (from spec §8)**

Check off each verification item:
- [x] `pnpm install` unchanged (no new deps)
- [x] `pnpm build` passes
- [x] `/workspace/texture` renders with panel controls visible, no console errors
- [x] Other routes (`/workspace/model`, `image`, `segment`, `/`) still render normally
- [x] No runtime crash on Texture page load (API 4xx/5xx from absent backend is acceptable)

If all boxes tick, Phase 1 is complete. Update the spec's Follow-up section (§11) with any findings to hand off to Phase 2 (Physics).

---

## Known Follow-ups (out of this phase's scope)

- Phase 2 — Physics tab port (`_physics/` → `physics/` + articulation proxy + `physics-store`, etc.). Will reuse the L1–L6 pattern established here, plus new tasks for the store and R3F components.
- If Trellis.2 backend has retired the sync `/phidias/trellis2/texture` endpoint, `textureTrellis` calls will 4xx/5xx at runtime. Either populate `TRELLIS2_API_URL` with a working URL, or schedule a future spec to migrate `textureTrellis` onto the polling pattern (Phase 4+).
- If Task 5.4 forced local adapters around `ExportDropdown` / `ThreeViewport` / `workspace-context`, track those TODOs for Phase 4 (Shared UI polish).
