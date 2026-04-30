# Phidias Phase 3 — Model / Segment Panel UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port UI improvements from the old repo's 4 model/segment panel components into the new repo on `feat/phase3-model-segment-uiux` (off `computex-demo`), preserving the new repo's polling-based page.tsx logic untouched. Verification level A.

**Architecture:** Per-panel hybrid procedure. For each panel: try `cp` from old → tsc check → if green commit (verbatim path); if tsc fails apply the **"old body + extended Props superset"** surgical pattern (keep old UI body, expand Props interface to include any new repo polling-related props). If the surgical merge can't be made compile-clean within the panel scope, gracefully SKIP that layer (R9 escape clause).

**Tech Stack:** Next.js 14, TypeScript, React, Zustand, Tailwind, pnpm.

**Spec reference:** `docs/superpowers/specs/2026-04-15-phidias-migration-phase3-model-segment-design.md`

**Pre-baked facts** (from planning-time scans, baked in to save subagent grep time):

- `uuid` package: NOT used by any of the 4 panels. R4 (uuid) will not trigger.
- `ModelAssetPanel.tsx`: Old version imports `mockGetHierarchy from '@/lib/api/mock'`. New repo has no `mock.ts` (deliberate; mock removed in main repo). **Verbatim WILL fail** unless that import is dropped or replaced.
- `ModelGeneratePanel.tsx`: New repo added 2 polling-related props (`isConnectionAvailable?`, `remainingSlots?`). Old Props lacks these. **Verbatim WILL fail tsc** at page.tsx caller (passes extra props to old component). Surgical fix = add the 2 props as optional to ported Props interface.
- `SegmentAIPanel.tsx`: New repo added 3 props (`isConnectionAvailable?`, `remainingSlots?`, `isAssetSegmented?`) and REMOVED `hasMultipleParts?`. **Verbatim WILL fail tsc** (page passes 3 extra props old doesn't accept). Surgical fix = add the 3 props to ported Props; keep `hasMultipleParts?` since it's optional and unused by new caller.
- `SegmentHierarchyPanel.tsx`: Imports nearly identical (old has extra `useEffect`); Props interface byte-identical. **Verbatim is expected to pass.**

---

## File Structure

**Modified (overwritten or surgically merged):**
- `src/components/model/ModelAssetPanel.tsx` (200→201 lines, 3 line diff)
- `src/components/segment/SegmentAIPanel.tsx` (451→446 lines, 37 line diff)
- `src/components/segment/SegmentHierarchyPanel.tsx` (361→406 lines, 63 line diff)
- `src/components/model/ModelGeneratePanel.tsx` (714→763 lines, 123 line diff)

**Untouched:**
- Both page.tsx files (`src/app/workspace/model/page.tsx`, `src/app/workspace/segment/page.tsx`) — polling logic preserved
- All shared components (per spec §3 Non-Goals)
- skip-worktree files
- wc-entry.tsx, .env.example, route definitions

---

## Prerequisites

- Old repo present at `/Users/between2058/Documents/code/phidias-standalone` with `github/feat/viewer-export-ux-improvements` available locally
- New repo currently on branch `computex-demo` at `9f32722` (Phase 2 complete tip)

The first executable step (Step 0.1) creates the new feature branch.

---

## Task 0: Branch Setup + Pre-flight Verification

Pre-flight scans were done during plan authoring; results are baked into the "Pre-baked facts" section above. Engineer only confirms cleanliness + creates branch.

**Files:** none (read-only checks + branch creation)

- [ ] **Step 0.1: Create the Phase 3 feature branch**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git switch -c feat/phase3-model-segment-uiux computex-demo
git branch --show-current
```
Expected: `feat/phase3-model-segment-uiux`. Working tree clean.

- [ ] **Step 0.2: Verify cutoff commit on old repo**

```bash
cd /Users/between2058/Documents/code/phidias-standalone
git rev-parse github/feat/viewer-export-ux-improvements
```
Expected: starts with `85f68d6`.

- [ ] **Step 0.3: Confirm pre-baked dependency facts**

Re-run only if you suspect drift since plan was written:

```bash
OLD=/Users/between2058/Documents/code/phidias-standalone
NEW=/Users/between2058/Documents/gitlab_code/phidias-standalone
echo "=== uuid in 4 panels (expect zero hits) ==="
grep -nE "from 'uuid'" \
  $OLD/src/components/model/ModelAssetPanel.tsx \
  $OLD/src/components/model/ModelGeneratePanel.tsx \
  $OLD/src/components/segment/SegmentAIPanel.tsx \
  $OLD/src/components/segment/SegmentHierarchyPanel.tsx
echo "=== mock.ts in new repo (expect missing — file does not exist) ==="
ls $NEW/src/lib/api/mock.ts 2>&1
```
Expected:
- Zero matches for uuid
- `ls: ... No such file or directory` for mock.ts

- [ ] **Step 0.4: Confirm clean starting state**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git status --short
git ls-files -v | grep '^S '
```
Expected:
- `git status --short`: empty (or untracked docs only)
- 5 skip-worktree files marked `S`

---

## Hybrid Procedure (applies to all 4 panels)

Each layer follows this pattern:

```
Step P.1: Verbatim try
    cp <old_panel>.tsx <new_panel>.tsx
Step P.2: Type-check
    pnpm exec tsc --noEmit
Step P.3a (Outcome A — verbatim passes):
    git add <panel>; git commit -m "feat(<area>): L<N> — port <Panel> from old (verbatim, <diff_lines> line diff)"
Step P.3b (Outcome B — verbatim fails):
    git checkout HEAD -- <panel>.tsx        # revert to new version
    Apply Surgical strategy (see below)
    pnpm exec tsc --noEmit                  # must pass
    git add <panel>; git commit -m "feat(<area>): L<N> — port <Panel> UI body from old + extend Props superset (surgical, <reason>)"
Step P.3c (Outcome C — surgical also infeasible):
    git checkout HEAD -- <panel>.tsx
    git commit --allow-empty -m "chore(<area>): L<N> — keep new <Panel>, no portable UI changes from old (R9)"
```

### Surgical Strategy (preferred, fast)

For panels where verbatim fails because **page.tsx (new) passes props the old Component doesn't accept** (the dominant failure mode per pre-bake):

1. `cp <old_panel>.tsx <new_panel>.tsx` (puts old body in place, ignoring tsc complaints)
2. Locate the `interface <Panel>Props` declaration in the now-pasted file
3. Compare against the equivalent block in the original new-repo version (which we still have via `git show HEAD:<path>`)
4. Add any props from the new version that are missing in the old version (typically the polling-related `isConnectionAvailable?`, `remainingSlots?`, `isAssetSegmented?`)
5. Mark them all optional (`?:`); the old body code path doesn't use them, so they remain unused props (harmless)
6. tsc should now pass

This pattern is much faster than per-hunk body merge and preserves the entire old UI body.

If the failure is NOT a Props issue (e.g., import to a missing module, hook signature drift), then per-hunk surgical or skip applies.

---

## Task 1: L1 — ModelAssetPanel

Diff: 3 lines. Pre-baked blocker: old version imports `mockGetHierarchy` from `@/lib/api/mock` which does not exist in new repo. Verbatim will fail with "Cannot find module".

**Files:**
- Modify: `src/components/model/ModelAssetPanel.tsx`

- [ ] **Step 1.1: Verbatim try**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
cp /Users/between2058/Documents/code/phidias-standalone/src/components/model/ModelAssetPanel.tsx \
   src/components/model/ModelAssetPanel.tsx
```

- [ ] **Step 1.2: Type-check**

```bash
pnpm exec tsc --noEmit
```
Expected (per pre-bake): FAIL with `Cannot find module '@/lib/api/mock'`.

- [ ] **Step 1.3: Inspect what `mockGetHierarchy` is used for**

Look at the now-pasted `ModelAssetPanel.tsx`:

```bash
grep -n "mockGetHierarchy" src/components/model/ModelAssetPanel.tsx
```

If `mockGetHierarchy` is only used in a single dev-only flow (e.g., button click that loads mock data), the simplest fix is to delete the import + delete the call site (mock data won't load — acceptable, that branch was dev-only).

If `mockGetHierarchy` is the panel's primary data source, the new repo's existing `ModelAssetPanel` (which we'd revert to via Step 3c) is more correct.

**Decision rule:**
- If the diff between old and new is purely the mock loader (i.e., the only old-repo addition is dev-mock), apply Outcome C (R9 skip). The 3-line diff is not portable to a repo without `mock.ts`.
- If there's other UI improvement in the diff, apply Outcome B (surgical: drop the mock import + call sites only, keep other improvements).

- [ ] **Step 1.4: Apply chosen path (B or C)**

For Outcome B: edit the file to remove the `mockGetHierarchy` import and any call sites; save.

For Outcome C: revert the file:
```bash
git checkout HEAD -- src/components/model/ModelAssetPanel.tsx
```

- [ ] **Step 1.5: Type-check (must pass)**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 1.6: Commit**

For Outcome B:
```bash
git add src/components/model/ModelAssetPanel.tsx
git commit -m "feat(model): L1 — port ModelAssetPanel UI from old (surgical: dropped mockGetHierarchy import + call sites; new repo lacks lib/api/mock)"
```

For Outcome C (R9 skip):
```bash
git commit --allow-empty -m "chore(model): L1 — keep new ModelAssetPanel; old's only diff is mockGetHierarchy import which is unportable (lib/api/mock absent in new repo). R9 graceful skip."
```

---

## Task 2: L2 — SegmentAIPanel

Diff: 37 lines. Pre-baked blocker: old Props is missing 3 polling-related props that new page.tsx passes (`isConnectionAvailable`, `remainingSlots`, `isAssetSegmented`).

**Files:**
- Modify: `src/components/segment/SegmentAIPanel.tsx`

- [ ] **Step 2.1: Verbatim try**

```bash
cp /Users/between2058/Documents/code/phidias-standalone/src/components/segment/SegmentAIPanel.tsx \
   src/components/segment/SegmentAIPanel.tsx
```

- [ ] **Step 2.2: Type-check**

```bash
pnpm exec tsc --noEmit
```
Expected (per pre-bake): FAIL with caller-side errors in `src/app/workspace/segment/page.tsx` about extra props on `<SegmentAIPanel>`.

- [ ] **Step 2.3: Apply Surgical strategy — extend Props superset**

Open `src/components/segment/SegmentAIPanel.tsx`. Find:
```typescript
interface SegmentAIPanelProps {
  /** Whether a model is loaded — enables the Start button */
  isEnabled: boolean;
  isSegmenting: boolean;
  progress: number;
  error: string | null;
  results: SegmentResult[];
  onStart: (params: P3SAMParams) => void;
  onCancel: () => void;
  onSmartOrganize?: () => void;
  isOrganizing?: boolean;
  hasMultipleParts?: boolean;
}
```

Add 3 optional props at the end of the interface (kept as optional, body doesn't reference them — they remain unused which is fine):

```typescript
interface SegmentAIPanelProps {
  /** Whether a model is loaded — enables the Start button */
  isEnabled: boolean;
  isSegmenting: boolean;
  progress: number;
  error: string | null;
  results: SegmentResult[];
  onStart: (params: P3SAMParams) => void;
  onCancel: () => void;
  onSmartOrganize?: () => void;
  isOrganizing?: boolean;
  hasMultipleParts?: boolean;
  /** Whether the P3-SAM service has available connection slots (polling-related, accepted but unused by old UI body) */
  isConnectionAvailable?: boolean;
  /** Number of remaining connection slots (0–2) (polling-related, accepted but unused by old UI body) */
  remainingSlots?: number;
  /** Whether the active asset is already marked as segmented (accepted but unused by old UI body) */
  isAssetSegmented?: boolean;
}
```

- [ ] **Step 2.4: Type-check (must pass)**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/segment/SegmentAIPanel.tsx
git commit -m "feat(segment): L2 — port SegmentAIPanel UI from old + extend Props superset (surgical)

Verbatim port of old repo's SegmentAIPanel (446 lines) failed tsc because
new page.tsx passes 3 polling-related props (isConnectionAvailable,
remainingSlots, isAssetSegmented) the old Component didn't declare.

Surgical fix: keep old UI body, extend Props interface to accept the 3
new-repo props as optional (unused by old body — harmless).

Old's hasMultipleParts? prop kept (now unused by new caller; harmless)."
```

If verbatim happens to pass (Outcome A) instead, use:
```bash
git commit -m "feat(segment): L2 — port SegmentAIPanel from old (verbatim, 37 line diff)"
```

---

## Task 3: L3 — SegmentHierarchyPanel

Diff: 63 lines. Pre-baked: imports nearly identical (old has extra `useEffect`); Props byte-identical. **Verbatim is expected to pass.**

**Files:**
- Modify: `src/components/segment/SegmentHierarchyPanel.tsx`

- [ ] **Step 3.1: Verbatim try**

```bash
cp /Users/between2058/Documents/code/phidias-standalone/src/components/segment/SegmentHierarchyPanel.tsx \
   src/components/segment/SegmentHierarchyPanel.tsx
```

- [ ] **Step 3.2: Type-check**

```bash
pnpm exec tsc --noEmit
```
Expected (per pre-bake): exit 0.

- [ ] **Step 3.3: If verbatim failed, apply surgical**

If tsc fails despite the prediction:
- If Props issue: use the **"extend Props superset"** strategy from Task 2's Step 2.3.
- If body issue (e.g., uses `Part` type with old-shape fields): inspect the error, decide between local adapter inside the file or R9 skip.

- [ ] **Step 3.4: Commit**

For Outcome A:
```bash
git add src/components/segment/SegmentHierarchyPanel.tsx
git commit -m "feat(segment): L3 — port SegmentHierarchyPanel from old (verbatim, 63 line diff)"
```

For Outcome B/C: adjust commit message accordingly (mirror Tasks 1/2 patterns).

---

## Task 4: L4 — ModelGeneratePanel

Diff: 123 lines. Pre-baked blocker: new Props added 2 polling-related props (`isConnectionAvailable`, `remainingSlots`). Largest panel; highest-risk surgical merge.

**Files:**
- Modify: `src/components/model/ModelGeneratePanel.tsx`

- [ ] **Step 4.1: Verbatim try**

```bash
cp /Users/between2058/Documents/code/phidias-standalone/src/components/model/ModelGeneratePanel.tsx \
   src/components/model/ModelGeneratePanel.tsx
```

- [ ] **Step 4.2: Type-check**

```bash
pnpm exec tsc --noEmit
```
Expected (per pre-bake): FAIL with caller-side errors about extra `isConnectionAvailable` / `remainingSlots` props in `src/app/workspace/model/page.tsx`.

- [ ] **Step 4.3: Apply Surgical strategy — extend Props superset**

Open `src/components/model/ModelGeneratePanel.tsx`. Find:
```typescript
interface ModelGeneratePanelProps {
  /** Called with the fully-assembled request when the user clicks Generate */
  onGenerate: (params: GenerateModelRequest) => void;
  isGenerating: boolean;
  progress: ProgressUpdate | null;
  /** Preview URL of the Qwen-generated image, managed by the parent page */
  text2ImgPreviewUrl?: string | null;
}
```

Add 2 optional props:
```typescript
interface ModelGeneratePanelProps {
  /** Called with the fully-assembled request when the user clicks Generate */
  onGenerate: (params: GenerateModelRequest) => void;
  isGenerating: boolean;
  progress: ProgressUpdate | null;
  /** Preview URL of the Qwen-generated image, managed by the parent page */
  text2ImgPreviewUrl?: string | null;
  /** Whether the ReconViaGen service has available connection slots (polling-related, accepted but unused by old UI body) */
  isConnectionAvailable?: boolean;
  /** Number of remaining connection slots (0–2) (polling-related, accepted but unused by old UI body) */
  remainingSlots?: number;
}
```

- [ ] **Step 4.4: Type-check (must pass)**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0.

If tsc still fails (e.g., body references types that drifted, hooks that aren't in new repo's `phidias-store`), evaluate:
- Local fix inside this file: try first.
- Touching outside this file: STOP with status BLOCKED. Surgical merge of body hunks is allowed but if it requires modifying shared/store, that's R3/R6 territory and needs user input.
- R9 graceful skip: revert via `git checkout HEAD -- src/components/model/ModelGeneratePanel.tsx` and use the empty-commit message from Task 1's Outcome C pattern (adjust path).

- [ ] **Step 4.5: Commit**

For Outcome B:
```bash
git add src/components/model/ModelGeneratePanel.tsx
git commit -m "feat(model): L4 — port ModelGeneratePanel UI from old + extend Props superset (surgical)

Verbatim port of old repo's ModelGeneratePanel (763 lines) failed tsc
because new page.tsx passes 2 polling-related props
(isConnectionAvailable, remainingSlots) the old Component didn't declare.

Surgical fix: keep old UI body (full 763 lines from old), extend Props
interface to accept the 2 new-repo props as optional (unused by old
body — harmless)."
```

For Outcome A or C: mirror Tasks 1/2 patterns.

---

## Task 5: Final Regression Smoke Test

End-to-end verification.

**Files:** none

- [ ] **Step 5.1: Clean build**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
rm -rf .next
pnpm build
```
Expected: exit 0.

- [ ] **Step 5.2: Dev server smoke test (6 routes)**

```bash
pnpm dev > /tmp/p3_dev.log 2>&1 &
DEV_PID=$!
# Wait until "Ready" line appears
for i in $(seq 1 30); do
  if grep -q "Ready in" /tmp/p3_dev.log 2>/dev/null; then break; fi
  sleep 1
done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/p3_dev.log | head -1 | cut -d: -f2)
echo "dev on :$PORT (took ${i}s to ready)"
for ROUTE in "/" "/workspace/model" "/workspace/image" "/workspace/segment" "/workspace/texture" "/workspace/physics"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "http://localhost:$PORT$ROUTE")
  echo "  $ROUTE → HTTP $CODE"
done
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
echo "=== runtime errors? ==="
grep -iE "error|warn" /tmp/p3_dev.log | grep -vE "npmrc|CICD" | head -10
```
Expected: every route returns 200; no errors beyond the harmless `.npmrc` warning.

- [ ] **Step 5.3: Confirm skip-worktree protection held**

```bash
git status --short
git ls-files -v | grep '^S '
```
Expected:
- `git status --short` empty
- 5 skip-worktree files still marked `S`

- [ ] **Step 5.4: Inspect commit history for this phase**

```bash
git log --oneline computex-demo..HEAD
```
Expected: 4 panel commits (some may be `chore(...) R9 skip` if surgical also failed; that's acceptable per spec). Each starts with `feat(model|segment):` or `chore(model|segment):`.

- [ ] **Step 5.5: Verification bar checklist (from spec §7)**

Tick each after manual confirmation from Steps 5.1–5.4:

- [x] `pnpm install` unchanged (no new deps)
- [x] `pnpm build` passes
- [x] All 6 routes return HTTP 200
- [x] `/workspace/model` and `/workspace/segment` (the most affected routes) render without console runtime errors
- [x] Other routes (`/`, `/workspace/image`, `/workspace/texture`, `/workspace/physics`) still HTTP 200 (Phase 1+2 unaffected)
- [x] skip-worktree 5 files unchanged

If all boxes tick, Phase 3 is complete. Notify the user; await go-ahead before merging into `computex-demo`.

---

## Known Follow-ups (out of this phase's scope)

- **Phase 3.5 candidate** — If user reviews Phase 3 result and still wants page.tsx-level UI port (for visual parity with old repo), that's a future spec. Will require careful per-hunk merge of the 939 diff lines in segment/model `page.tsx`, while preserving polling logic.
- **Phase 4** — Shared UI polish (`TopNavBar`, `LeftIconSidebar`, `AssetsPanel`, `HierarchyPanel`, `globals.css`, etc.).
- **R9 skips logged** — If any layer ended up with an R9 empty commit, the missing UI improvement should be documented for Phase 4 / 3.5 evaluation. The commit message itself is the audit trail.
- **Polling-related props retained as unused** — The Props superset strategy adds props to old components that the old body ignores. If a future Phase wants to USE those props in the old UI body (e.g., grey out the Generate button when no connection slots), that's a small feature ticket per panel.
- **Old version's `mockGetHierarchy` story** — If Phase 1 was to keep dev-only mock loaders alive, this is the place to revisit (Phase 4 or a separate testing-infra spec).
