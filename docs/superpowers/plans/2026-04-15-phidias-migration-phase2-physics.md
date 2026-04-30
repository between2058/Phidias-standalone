# Phidias Phase 2 — Physics Tab Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Physics tab from the old repo (`github.com/between2058/Phidias-standalone` branch `feat/viewer-export-ux-improvements` @ `85f68d6`) into the new repo on a new feature branch `feat/phase2-physics-migration` off `computex-demo`, routed at `/workspace/physics`, passing verification level A (compile + render; backend API failures acceptable).

**Architecture:** Additive surgical merge in 4 layers (L1–L4), reusing the pattern Phase 1 validated. Foundation (store + proxy + types + API helpers) → shared addition (RenderModeSelector) → 6 new physics components → coupled swap (3 panel overwrites + page swap + wc-entry wire + delete orphan PhysicsPropertiesPanel). One known runtime patch: replace `uuidv4()` from the `uuid` package with `crypto.randomUUID()` in `PhysicsJointsPanel.tsx` because the new repo lacks the `uuid` dep.

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Three.js / R3F / drei, Zustand + Zundo, Tailwind, pnpm.

**Spec reference:** `docs/superpowers/specs/2026-04-15-phidias-migration-phase2-physics-design.md`

**⚠ Spec gap addressed in this plan:** Spec L1 inventory listed only 3 items (store + proxy + env). During planning, scanning `PhysicsExportButtons.tsx` revealed it imports 3 articulation functions from `@/lib/api/phidias` and 4 articulation types from `@/lib/api/types` that do NOT exist in the new repo. This plan expands L1 to 5 items by adding those merges to `phidias.ts` and `types.ts`. If the spec is updated later, mark this gap closed.

---

## File Structure

**Created (new files only):**
- `src/store/physics-store.ts` (200 lines, copied from old)
- `src/app/api/phidias/articulation/[...path]/route.ts` (~30 lines, copied from old)
- `src/components/shared/RenderModeSelector.tsx` (58 lines, copied from old)
- `src/components/physics/AnchorGizmo.tsx` (77 lines)
- `src/components/physics/JointVisualizer.tsx` (135 lines)
- `src/components/physics/MotionPreviewController.tsx` (219 lines)
- `src/components/physics/PhysicsEditorPanel.tsx` (197 lines)
- `src/components/physics/PhysicsExportButtons.tsx` (289 lines)
- `src/components/physics/PhysicsMotionPreview.tsx` (63 lines)
- `src/app/workspace/physics/page.tsx` (384 lines, copied from old, replaces `_physics/`)

**Modified (additive merges):**
- `src/lib/api/types.ts` — add 4 articulation types at EOF in a new section
- `src/lib/api/phidias.ts` — add 3 articulation functions in the existing `// ── Texture tab (legacy async) ──` section style (rename section to `// ── Legacy async (Texture / Physics) ──` for shared use)
- `.env.example` — append `ARTICULATION_API_URL=`
- `src/wc-entry.tsx` — two surgical edits (lazy import path + `<Route>`)

**Overwritten (3 diff'd panels):**
- `src/components/physics/PhysicsJointsPanel.tsx` (was 327, becomes 413; +1 surgical patch for `uuidv4()` → `crypto.randomUUID()`)
- `src/components/physics/PhysicsMaterialsPanel.tsx` (was 135, becomes 168)
- `src/components/physics/PhysicsPartsPanel.tsx` (was 127, becomes 322)

**Deleted:**
- `src/app/workspace/_physics/` (underscored disabled folder, 503-line page.tsx removed)
- `src/components/physics/PhysicsPropertiesPanel.tsx` (264-line orphan after `_physics/` removal)

**Untouched (per spec Q5=A and skip-worktree):**
- Shared: `ExportDropdown.tsx`, `ThreeViewport.tsx`, `HierarchyPanel.tsx`, `workspace-context.tsx`, `ProgressBar.tsx`, `layout.tsx`, `globals.css`
- Stores: `phidias-store.ts`, `segment-store.ts` (both diff'd between repos but spec says don't touch; segment-store's exported symbol list is identical so should be safe)
- Skip-worktree: `next.config.mjs`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.wc.config.mts`

---

## Prerequisites

- Old repo present at `/Users/between2058/Documents/code/phidias-standalone` with `github/feat/viewer-export-ux-improvements` available locally (verified ahead of time during brainstorming)
- New repo currently on branch `computex-demo` (Phase 1 complete tip `6749cbc`)

The first executable step (Step 0.1 below) creates the new feature branch `feat/phase2-physics-migration` off `computex-demo`.

---

## Task 0: Pre-flight Verification + Branch Setup

Pre-flight scan was performed during plan writing; results are baked in below. Engineer only needs to confirm them.

**Files:** none (read-only checks + branch creation)

- [ ] **Step 0.1: Create the Phase 2 feature branch**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git switch -c feat/phase2-physics-migration computex-demo
git branch --show-current
```
Expected: `feat/phase2-physics-migration`. Working tree should be clean (no uncommitted files).

- [ ] **Step 0.2: Verify cutoff commit on old repo**

```bash
cd /Users/between2058/Documents/code/phidias-standalone
git rev-parse github/feat/viewer-export-ux-improvements
```
Expected: starts with `85f68d6`.

- [ ] **Step 0.3: Confirm pre-baked dependency facts**

The following were verified during plan authoring. Re-run only if you suspect drift:

**uuid usage in old physics**:
```bash
cd /Users/between2058/Documents/code/phidias-standalone
grep -rn "from 'uuid'" src/components/physics/ src/store/physics-store.ts src/app/workspace/physics/
```
Expected: ONE hit only — `src/components/physics/PhysicsJointsPanel.tsx:5:import { v4 as uuidv4 } from 'uuid';`. No other physics file uses `uuid`. Plan handles this in Task 4 by replacing `uuidv4()` with `crypto.randomUUID()` (Node 19+ / modern browser built-in; new repo's `package.json` does not include the `uuid` dep).

**zustand / zundo present in new repo**: confirmed in `package.json` (`zustand ^5.0.11`, `zundo ^2.3.0`). `physics-store.ts` will resolve.

**Articulation API presence in new repo phidias.ts**:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
grep -nE "exportArticulationUsda|exportArticulationUsdz|downloadArticulationFile" src/lib/api/phidias.ts
```
Expected: NO hits. Confirmed missing — Task 1 adds them.

**Articulation type presence in new repo types.ts**:
```bash
grep -nE "ArticulationExportPart|ArticulationExportJoint|ArticulationExportData|ArticulationExportResult" src/lib/api/types.ts
```
Expected: NO hits. Confirmed missing — Task 1 adds them.

**HierarchyItem type still in HierarchyPanel.tsx**:
```bash
grep -n "^export interface HierarchyItem" src/components/shared/HierarchyPanel.tsx
```
Expected: line 7. (HierarchyPanel itself is shared / not modified per Q5=A.)

**segment-store top-level export drift**:
```bash
diff <(grep -E "^export (const|function|interface|type)" /Users/between2058/Documents/code/phidias-standalone/src/store/segment-store.ts) <(grep -E "^export (const|function|interface|type)" /Users/between2058/Documents/gitlab_code/phidias-standalone/src/store/segment-store.ts)
```
Expected: empty diff (same exported symbols). Note: this only checks top-level signatures; deep field/parameter drift could still trigger R3 at compile time.

- [ ] **Step 0.4: Confirm clean starting state**

```bash
git status --short
git ls-files -v | grep '^S '
```
Expected:
- `git status --short` is empty
- 5 skip-worktree files marked `S`: `next.config.mjs`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.wc.config.mts`

If `git status` shows modifications to files this plan will edit, PAUSE and reconcile.

---

## Task 1: L1 — Foundation (5 items)

Adds physics-store, articulation proxy, env var, articulation types in types.ts, and articulation functions in phidias.ts. Pure additive — no existing consumers.

**Files:**
- Create: `src/store/physics-store.ts`
- Create: `src/app/api/phidias/articulation/[...path]/route.ts`
- Modify: `.env.example` (append)
- Modify: `src/lib/api/types.ts` (append articulation section)
- Modify: `src/lib/api/phidias.ts` (append articulation functions to existing legacy section)

- [ ] **Step 1.1: Copy `physics-store.ts`**

```bash
cp /Users/between2058/Documents/code/phidias-standalone/src/store/physics-store.ts \
   /Users/between2058/Documents/gitlab_code/phidias-standalone/src/store/physics-store.ts
```

- [ ] **Step 1.2: Copy articulation proxy folder**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
mkdir -p src/app/api/phidias/articulation
cp -r /Users/between2058/Documents/code/phidias-standalone/src/app/api/phidias/articulation/[...path] \
      src/app/api/phidias/articulation/
wc -l src/app/api/phidias/articulation/\[...path\]/route.ts
```
Expected: ~30 lines.

- [ ] **Step 1.3: Append `ARTICULATION_API_URL=` to `.env.example`**

Open `.env.example` and append a single line at EOF:
```
ARTICULATION_API_URL=
```

- [ ] **Step 1.4: Append articulation types to `src/lib/api/types.ts`**

Open `src/lib/api/types.ts` and append the following at EOF (after the last existing export, before any trailing newline):

```typescript

// ============================================================================
// ── Articulation export types (Physics tab, ported from old repo) ───────────
// Used by exportArticulationUsda / exportArticulationUsdz / downloadArticulationFile
// in src/lib/api/phidias.ts and by PhysicsExportButtons.tsx.
// ============================================================================

export interface ArticulationExportPart {
  id: string;
  name: string;
  type: 'link' | 'base' | 'tool' | 'joint';
  mass: number | null;
  density: number;
  collision_type: 'convexHull' | 'mesh' | 'convexDecomposition' | 'none';
  static_friction: number;
  dynamic_friction: number;
  restitution: number;
}

export interface ArticulationExportJoint {
  name: string;
  parent: string;
  child: string;
  type: 'fixed' | 'revolute' | 'prismatic';
  axis: [number, number, number];
  anchor: [number, number, number];
  lower_limit: number | null;
  upper_limit: number | null;
  drive_stiffness: number | null;
  drive_damping: number | null;
  drive_max_force: number | null;
  drive_type: 'position' | 'velocity' | 'none';
  disable_collision: boolean;
}

export interface ArticulationExportData {
  glb_file: File;
  model_name: string;
  parts: ArticulationExportPart[];
  joints: ArticulationExportJoint[];
}

export interface ArticulationExportResult {
  success: boolean;
  filename: string;
  download_url: string;
}
```

- [ ] **Step 1.5: Append articulation functions to `src/lib/api/phidias.ts`**

Open `src/lib/api/phidias.ts`. The existing legacy section header is:
```
// ── Texture tab (legacy async) ──────────────────────────────────────────────
```
Replace it with a broader header (rename only that comment block) then append the 3 articulation functions. Do this as a single Edit replacing the existing single-section comment with a renamed comment, then append the new functions at EOF:

First, rename the existing section header. Find:
```typescript
// ============================================================================
// ── Texture tab (legacy async) ──────────────────────────────────────────────
// Functions in this section preserve the pre-polling callback/direct-result
// async patterns that the Texture tab (ported from the old repo) expects.
// Do NOT merge these into the polling-style variants above — they return
// fully-resolved results, not job submission handles.
// ============================================================================
```
Change to:
```typescript
// ============================================================================
// ── Legacy async API (Texture / Physics tabs) ───────────────────────────────
// Functions in this section preserve the pre-polling callback/direct-result
// async patterns that the Texture and Physics tabs (ported from the old repo)
// expect. Do NOT merge these into the polling-style variants above — they
// return fully-resolved results, not job submission handles.
// ============================================================================
```

Then append the following 3 functions at EOF (after the existing `editImageLegacy` definition):

```typescript

/**
 * Export articulation as USDA file via Physics backend.
 * Ported verbatim from old repo phidias.ts lines 875-897 (commit 85f68d6).
 */
export async function exportArticulationUsda(
  exportData: ArticulationExportData,
): Promise<ArticulationExportResult> {
  const formData = new FormData();
  formData.append('file', exportData.glb_file);
  formData.append(
    'articulation',
    JSON.stringify({
      model_name: exportData.model_name,
      parts: exportData.parts,
      joints: exportData.joints,
    }),
  );
  const { data } = await client.post<ArticulationExportResult>(
    `${getBackendApi()}/phidias/articulation/export-usda`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  return data;
}

/**
 * Export articulation as USDZ file via Physics backend.
 * Ported verbatim from old repo phidias.ts lines 899-921 (commit 85f68d6).
 */
export async function exportArticulationUsdz(
  exportData: ArticulationExportData,
): Promise<ArticulationExportResult> {
  const formData = new FormData();
  formData.append('file', exportData.glb_file);
  formData.append(
    'articulation',
    JSON.stringify({
      model_name: exportData.model_name,
      parts: exportData.parts,
      joints: exportData.joints,
    }),
  );
  const { data } = await client.post<ArticulationExportResult>(
    `${getBackendApi()}/phidias/articulation/export-usdz`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  return data;
}

/**
 * Download an articulation export file by filename.
 * Ported verbatim from old repo phidias.ts lines 923-931 (commit 85f68d6).
 */
export async function downloadArticulationFile(
  filename: string,
): Promise<Blob> {
  const { data } = await client.get<Blob>(
    `${getBackendApi()}/phidias/articulation/download/${filename}`,
    { timeout: 60000 },
  );
  return data;
}
```

Note: the new functions reference types added in Step 1.4 (`ArticulationExportData`, `ArticulationExportResult`). They will only resolve if Step 1.4 was completed first.

- [ ] **Step 1.6: Build check**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
pnpm build
```
Expected: exit 0. The articulation route appears in the route table as `/api/phidias/articulation/[...path]`. No frontend consumer yet, so no warning about unused exports.

- [ ] **Step 1.7: Commit**

```bash
git add src/store/physics-store.ts \
        src/app/api/phidias/articulation \
        .env.example \
        src/lib/api/types.ts \
        src/lib/api/phidias.ts
git commit -m "feat(physics): L1 — add physics-store, articulation proxy/types/functions, env var

Foundation layer for Phase 2 Physics tab migration. All additive; no
existing consumers.

- Add src/store/physics-store.ts (200 lines, zustand + zundo, ported from old repo)
- Add src/app/api/phidias/articulation/[...path]/route.ts proxy
- Append ARTICULATION_API_URL= to .env.example
- Append 4 articulation types to src/lib/api/types.ts
  (ArticulationExportPart/Joint/Data/Result)
- Append 3 articulation functions to src/lib/api/phidias.ts
  (exportArticulationUsda/Usdz, downloadArticulationFile);
  rename existing 'Texture tab' legacy section comment to
  'Texture / Physics tabs' to reflect shared use"
```

---

## Task 2: L2 — Shared Addition (RenderModeSelector)

Adds a 58-line shared component that the old Physics page imports. Pure additive; no existing consumer in the new repo. Per spec: this is an *addition* not an *upgrade*, so it doesn't violate the "don't touch shared components" rule.

**Files:**
- Create: `src/components/shared/RenderModeSelector.tsx`

- [ ] **Step 2.1: Copy `RenderModeSelector.tsx`**

```bash
cp /Users/between2058/Documents/code/phidias-standalone/src/components/shared/RenderModeSelector.tsx \
   /Users/between2058/Documents/gitlab_code/phidias-standalone/src/components/shared/RenderModeSelector.tsx
wc -l /Users/between2058/Documents/gitlab_code/phidias-standalone/src/components/shared/RenderModeSelector.tsx
```
Expected: 58 lines.

- [ ] **Step 2.2: Type-check**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
pnpm exec tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/shared/RenderModeSelector.tsx
git commit -m "feat(physics): L2 — add RenderModeSelector shared component

Required by Physics page.tsx (L4). Pure additive — new repo has no
existing RenderModeSelector, so no shared-component upgrade. No
behavioral change to other tabs."
```

---

## Task 3: L3 — New-only Physics Components (6 files)

Adds 6 components that exist only in the old repo. Some reference the diff'd panels (Joints/Materials/Parts), so this layer may fail tsc on its own — see the merge fallback at the bottom of this task.

**Files:**
- Create: `src/components/physics/AnchorGizmo.tsx`
- Create: `src/components/physics/JointVisualizer.tsx`
- Create: `src/components/physics/MotionPreviewController.tsx`
- Create: `src/components/physics/PhysicsEditorPanel.tsx`
- Create: `src/components/physics/PhysicsExportButtons.tsx`
- Create: `src/components/physics/PhysicsMotionPreview.tsx`

- [ ] **Step 3.1: Copy all 6 components**

```bash
OLD=/Users/between2058/Documents/code/phidias-standalone
NEW=/Users/between2058/Documents/gitlab_code/phidias-standalone
cp $OLD/src/components/physics/AnchorGizmo.tsx              $NEW/src/components/physics/AnchorGizmo.tsx
cp $OLD/src/components/physics/JointVisualizer.tsx          $NEW/src/components/physics/JointVisualizer.tsx
cp $OLD/src/components/physics/MotionPreviewController.tsx  $NEW/src/components/physics/MotionPreviewController.tsx
cp $OLD/src/components/physics/PhysicsEditorPanel.tsx       $NEW/src/components/physics/PhysicsEditorPanel.tsx
cp $OLD/src/components/physics/PhysicsExportButtons.tsx     $NEW/src/components/physics/PhysicsExportButtons.tsx
cp $OLD/src/components/physics/PhysicsMotionPreview.tsx     $NEW/src/components/physics/PhysicsMotionPreview.tsx
ls -la $NEW/src/components/physics/
```
Expected: 10 .tsx files in `src/components/physics/` (4 pre-existing + 6 new).

- [ ] **Step 3.2: Type-check**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
pnpm exec tsc --noEmit
```

**Two possible outcomes:**

**Outcome A (best case): tsc passes.**
This means `PhysicsEditorPanel`'s imports of `PhysicsJointsPanel` / `PhysicsMaterialsPanel` / `PhysicsPartsPanel` happen to be prop-compatible with the new repo's existing versions. Proceed to Step 3.3.

**Outcome B (likely): tsc fails on prop drift inside `PhysicsEditorPanel.tsx` (R4 from spec).**
Errors will look like `Property 'X' does not exist on type 'IntrinsicAttributes & PhysicsJointsPanelProps'` or similar. This is the expected coupling between L3 and L4 — the old `PhysicsEditorPanel` expects old prop interfaces of those 3 panels, but they will only be overwritten in L4.

If Outcome B: SKIP Steps 3.3 and 3.4 (do not commit); jump directly to Task 4. Task 4 will commit L3 + L4 together as one merged atomic commit (same pattern as Phase 1's L4+L5+L6 merge).

- [ ] **Step 3.3: (Outcome A only) Commit L3 alone**

```bash
git add src/components/physics/
git commit -m "feat(physics): L3 — add 6 new-only physics components

Pure additive copies from old repo (no existing consumers in new repo
yet — page.tsx that uses these arrives in L4):
- AnchorGizmo (77 lines)
- JointVisualizer (135 lines)
- MotionPreviewController (219 lines)
- PhysicsEditorPanel (197 lines, imports the 3 panels — prop interfaces happened to match)
- PhysicsExportButtons (289 lines, uses articulation API from L1)
- PhysicsMotionPreview (63 lines)"
```

- [ ] **Step 3.4: (Outcome A only) Type-check after commit (sanity)**

```bash
pnpm exec tsc --noEmit
```
Expected: exit 0 (same as before commit).

---

## Task 4: L4 — Coupled Swap (6 items, atomic)

Replaces the 3 diff'd physics panels, swaps `_physics/` → `physics/`, deletes the orphaned `PhysicsPropertiesPanel`, patches `wc-entry.tsx`, and applies the `uuid` → `crypto.randomUUID()` patch.

If Task 3 took Outcome B (tsc failed → no commit), this task ALSO commits the 6 L3 components and uses an extended commit message reflecting the L3+L4 merge.

**Files:**
- Modify (overwrite): `src/components/physics/PhysicsJointsPanel.tsx`
- Modify (overwrite): `src/components/physics/PhysicsMaterialsPanel.tsx`
- Modify (overwrite): `src/components/physics/PhysicsPartsPanel.tsx`
- Modify (surgical patch): `src/components/physics/PhysicsJointsPanel.tsx` (uuid replacement)
- Delete: `src/components/physics/PhysicsPropertiesPanel.tsx`
- Delete: `src/app/workspace/_physics/`
- Create: `src/app/workspace/physics/page.tsx`
- Modify: `src/wc-entry.tsx` (two surgical edits)

- [ ] **Step 4.1: Overwrite the 3 diff'd panels**

```bash
OLD=/Users/between2058/Documents/code/phidias-standalone
NEW=/Users/between2058/Documents/gitlab_code/phidias-standalone
cp $OLD/src/components/physics/PhysicsJointsPanel.tsx      $NEW/src/components/physics/PhysicsJointsPanel.tsx
cp $OLD/src/components/physics/PhysicsMaterialsPanel.tsx   $NEW/src/components/physics/PhysicsMaterialsPanel.tsx
cp $OLD/src/components/physics/PhysicsPartsPanel.tsx       $NEW/src/components/physics/PhysicsPartsPanel.tsx
wc -l $NEW/src/components/physics/PhysicsJointsPanel.tsx \
      $NEW/src/components/physics/PhysicsMaterialsPanel.tsx \
      $NEW/src/components/physics/PhysicsPartsPanel.tsx
```
Expected line counts: 413, 168, 322.

- [ ] **Step 4.2: Patch `uuidv4()` → `crypto.randomUUID()` in `PhysicsJointsPanel.tsx`**

The new repo lacks the `uuid` npm package (Phase 1 / earlier removed it). The drop-in replacement is `crypto.randomUUID()` (Node 19+ / all modern browsers). PhysicsJointsPanel's only `uuid` usage is at the top-level import + 1+ call sites.

Open `src/components/physics/PhysicsJointsPanel.tsx`:

1. Find the import line near the top:
```typescript
import { v4 as uuidv4 } from 'uuid';
```
**Delete this entire line.**

2. Find every call site of `uuidv4()` and replace with `crypto.randomUUID()`:

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
grep -n "uuidv4(" src/components/physics/PhysicsJointsPanel.tsx
```
Expected: 1+ matches. For each match, change `uuidv4()` to `crypto.randomUUID()`.

After edits, verify cleanup:
```bash
grep -nE "uuidv4|from 'uuid'" src/components/physics/PhysicsJointsPanel.tsx
```
Expected: NO matches.

- [ ] **Step 4.3: Delete orphan `PhysicsPropertiesPanel.tsx`**

```bash
git rm src/components/physics/PhysicsPropertiesPanel.tsx
```

- [ ] **Step 4.4: Delete underscored `_physics/` folder**

```bash
git rm -r src/app/workspace/_physics
```

- [ ] **Step 4.5: Create `physics/` folder + copy old `page.tsx`**

```bash
mkdir -p src/app/workspace/physics
cp /Users/between2058/Documents/code/phidias-standalone/src/app/workspace/physics/page.tsx \
   src/app/workspace/physics/page.tsx
wc -l src/app/workspace/physics/page.tsx
```
Expected: 384 lines.

- [ ] **Step 4.6: Patch `wc-entry.tsx` (two surgical edits)**

Open `src/wc-entry.tsx`.

**Edit 1:** Find the line:
```typescript
const PhysicsPage = React.lazy(() => import('./app/workspace/_physics/page'));
```
Change to:
```typescript
const PhysicsPage = React.lazy(() => import('./app/workspace/physics/page'));
```

**Edit 2:** Inside `<Routes>` find the workspace group (which now includes `workspace/texture` from Phase 1):
```tsx
<Route element={<WorkspaceLayoutRoute />}>
  <Route path="workspace/model" element={<ModelPage />} />
  <Route path="workspace/image" element={<ImagePage />} />
  <Route path="workspace/segment" element={<SegmentPage />} />
  <Route path="workspace/texture" element={<TexturePage />} />
</Route>
```
Add a physics route after texture:
```tsx
<Route element={<WorkspaceLayoutRoute />}>
  <Route path="workspace/model" element={<ModelPage />} />
  <Route path="workspace/image" element={<ImagePage />} />
  <Route path="workspace/segment" element={<SegmentPage />} />
  <Route path="workspace/texture" element={<TexturePage />} />
  <Route path="workspace/physics" element={<PhysicsPage />} />
</Route>
```

Do NOT touch the lazy imports for `_retopo` / `_world` (they remain disabled).

- [ ] **Step 4.7: Build**

```bash
pnpm build
```

**Possible failure modes (handle inside Physics scope only — don't touch shared components):**

- **R2 — `workspace-context` / `ThreeViewport` / `HierarchyPanel` / `ExportDropdown` prop drift**: error inside `physics/page.tsx` or one of the components. Try a local adapter inside the Physics folder. Do NOT modify the shared file. If unfixable locally, STOP with status BLOCKED.
- **R3 — `segment-store` action/state drift**: error inside `physics/page.tsx` calling `useSegmentStore`. Same response as R2.
- **R5 — uuid leftover**: if Step 4.2 missed a `uuidv4` reference, tsc / runtime will error. Re-run the grep from Step 4.2 and fix.
- **R8 — orphaned import to a missing utility**: typically resolves with a local import path adjustment inside the Physics folder.

Expected after fixes: exit 0, `/workspace/physics` appears in route table.

- [ ] **Step 4.8: Dev server smoke test (6 routes)**

```bash
pnpm dev &
DEV_PID=$!
sleep 8
ACTIVE_PORT=""
for PORT in 3000 3001 3002 3003; do
  if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/" 2>/dev/null; then
    ACTIVE_PORT=$PORT
    break
  fi
done
echo "dev on :$ACTIVE_PORT"
if [ -n "$ACTIVE_PORT" ]; then
  for ROUTE in "/" "/workspace/model" "/workspace/image" "/workspace/segment" "/workspace/texture" "/workspace/physics"; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ACTIVE_PORT$ROUTE")
    echo "  $ROUTE → HTTP $CODE"
  done
fi
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```
Expected: every route returns 200. If any returns 500, capture the dev-server output and report.

- [ ] **Step 4.9: Commit**

**If Task 3 took Outcome A (L3 already committed)**, commit L4 standalone:

```bash
git add src/components/physics/PhysicsJointsPanel.tsx \
        src/components/physics/PhysicsMaterialsPanel.tsx \
        src/components/physics/PhysicsPartsPanel.tsx \
        src/components/physics/PhysicsPropertiesPanel.tsx \
        src/app/workspace/_physics \
        src/app/workspace/physics \
        src/wc-entry.tsx
git commit -m "feat(physics): L4 — coupled swap (overwrite 3 panels + page swap + wc-entry)

- Overwrite PhysicsJointsPanel (413 lines), PhysicsMaterialsPanel (168 lines),
  PhysicsPartsPanel (322 lines) with old repo's versions
- Patch PhysicsJointsPanel: replace 'uuid' v4 import + uuidv4() calls with
  crypto.randomUUID() (new repo lacks the uuid package; drop-in replacement)
- Delete PhysicsPropertiesPanel.tsx (only-in-new orphan after _physics/ removal)
- Delete src/app/workspace/_physics/ (underscored, disabled route)
- Create src/app/workspace/physics/page.tsx (384 lines from old repo)
- Patch wc-entry.tsx: lazy import _physics → physics; add Route entry"
```

**If Task 3 took Outcome B (L3+L4 merged)**, commit both layers together:

```bash
git add src/components/physics/ \
        src/app/workspace/_physics \
        src/app/workspace/physics \
        src/wc-entry.tsx
git commit -m "feat(physics): L3+L4 — port physics components + page + wire wc-entry

Merged L3 and L4 because PhysicsEditorPanel (L3) imports the 3 diff'd
panels (PhysicsJointsPanel / MaterialsPanel / PartsPanel) with old prop
interfaces — only valid after L4's overwrites. Same coupling pattern as
Phase 1's L4+L5+L6 merge.

- Add 6 new-only physics components: AnchorGizmo, JointVisualizer,
  MotionPreviewController, PhysicsEditorPanel, PhysicsExportButtons,
  PhysicsMotionPreview
- Overwrite 3 diff'd panels (PhysicsJointsPanel/MaterialsPanel/PartsPanel)
  with old repo's versions
- Patch PhysicsJointsPanel: uuid v4 → crypto.randomUUID() (new repo
  lacks uuid package; drop-in replacement)
- Delete PhysicsPropertiesPanel.tsx (only-in-new orphan after _physics/ removal)
- Delete src/app/workspace/_physics/ (underscored, disabled)
- Create src/app/workspace/physics/page.tsx (384 lines from old)
- Patch wc-entry.tsx: lazy import _physics → physics; add Route entry"
```

---

## Task 5: Final Regression Smoke Test

End-to-end verification that Phase 2 is complete and Phase 1 didn't regress.

**Files:** none (verification only)

- [ ] **Step 5.1: Clean build**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
rm -rf .next
pnpm build
```
Expected: exit 0. Route table should now show:
- `/workspace/texture` (Phase 1)
- `/workspace/physics` (Phase 2)
- `/api/phidias/trellis2/[...path]` (Phase 1)
- `/api/phidias/articulation/[...path]` (Phase 2)

- [ ] **Step 5.2: Dev server smoke test (6 routes)**

Re-run the smoke test from Step 4.8. Expected: all 6 routes HTTP 200.

- [ ] **Step 5.3: Confirm skip-worktree protection held**

```bash
git status --short
git ls-files -v | grep '^S '
```
Expected:
- `git status --short` empty (all changes committed)
- 5 skip-worktree files still marked `S`

If any of the 5 protected files appears modified, STOP — investigate before proceeding.

- [ ] **Step 5.4: Inspect commit history for this phase**

```bash
git log --oneline computex-demo..HEAD
```
Expected: 3 or 4 commits depending on Outcome A/B in Task 3.
- Outcome A: L1, L2, L3, L4 (4 commits)
- Outcome B: L1, L2, L3+L4 merged (3 commits)

Each commit message starts with `feat(physics):`.

- [ ] **Step 5.5: Verification bar checklist (from spec §7)**

Tick each item after manual confirmation from Steps 5.1–5.4:

- [x] `pnpm install` unchanged (no new deps)
- [x] `pnpm build` passes
- [x] `/workspace/physics` renders with PhysicsEditorPanel + viewport visible, no console errors
- [x] Other routes (`/`, `/workspace/model`, `/workspace/image`, `/workspace/segment`, `/workspace/texture`) still HTTP 200
- [x] No runtime crash on Physics page load (articulation API 4xx/5xx OK — backend may not be live)

If all boxes tick, Phase 2 is complete. Notify the user; await go-ahead before merging into `computex-demo`.

---

## Known Follow-ups (out of this phase's scope)

- **Phase 3** — Model / Segment tab UI/UX refresh (preserve new repo's polling logic; overlay old repo's UI improvements where non-conflicting).
- **Phase 4** — Shared UI polish (`TopNavBar`, `LeftIconSidebar`, `globals.css`, etc.).
- **R1 follow-up** — If the articulation backend has been retired or moved, populating `ARTICULATION_API_URL` won't help. Either set it to a working URL or schedule a future spec to migrate the articulation flow onto the polling pattern.
- **R2/R3/R8 cleanup** — If Step 4.7 forced any local adapters around shared components, document each as a TODO for Phase 4.
- **Spec gap closure** — Optionally update `2026-04-15-phidias-migration-phase2-physics-design.md` Section 5 L1 inventory to reflect the 5 items (vs. originally listed 3).
- **`uuid` package** — Confirm via grep that no other code paths in the repo expect `uuid`; if so, the package can be considered formally retired.
