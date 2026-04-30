# Phidias Phase 3.5 — Targeted UI/UX Issue Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 targeted UI/UX issues user surfaced after Phase 3 (TransformPanel white border, Smart Organize early-reveal gate, double-click rename, rename/group/merge export name sync) by making rescoped surgical edits to 5 files (+ 1 dead-file deletion) on top of `feat/phase3-model-segment-uiux`.

**Architecture:** 4 layers, 1 commit per issue. Each layer touches defined hunks in specific files; polling logic and other shared-component internals stay untouched. Final layer (L4) opens a `segmentRenameHandler` channel on workspace-context so the existing shared `HierarchyPanel.onRename` support lights up when on segment route.

**Tech Stack:** Next.js 14, TypeScript, React, Zustand, Three.js / R3F, Tailwind (hardcoded colors for this phase), pnpm.

**Spec reference:** `docs/superpowers/specs/2026-04-15-phidias-migration-phase3.5-targeted-fixes-design.md`

**Pre-baked facts** (gathered during plan authoring; engineer does not need to re-explore):

**L1 — TransformPanel border usage (current state)**:
```
src/components/shared/TransformPanel.tsx:
  L43: 'w-full bg-bg-card border border-phidias-border rounded ...'
  L44: 'focus:outline-none focus:border-accent-purple transition-colors'
  L80: <div className="flex items-center justify-between px-3 py-2 border-b border-phidias-border">
  L97: <div className="flex items-center justify-between px-3 py-2 border-b border-phidias-border">
```
Old repo uses `border-[#333355]` and `focus:border-[#7c3aed]` hardcoded at the same positions.

**L2 — hasMultipleParts implementation (from old repo)**:
```typescript
// src/app/workspace/segment/page.tsx (old) line 1348-1351:
const hasMultipleParts = useMemo(
  () => parts.filter((p) => !p.isGroup).length > 1,
  [parts],
);
```
Current new-repo passes `isAssetSegmented` at `src/app/workspace/segment/page.tsx:1545-1552`:
```typescript
isAssetSegmented={
  // Show Smart Organize ONLY when segmentation is confirmed to have completed...
  !!(assets.find(a => a.id === activeAssetId)?.segmentation)
}
```

**L3 — `threeGroup.name` assignment sites (4 locations to change)**:
```
src/app/workspace/segment/page.tsx:
  L826:  threeGroup.name = part.id;       // in rebuildThreeScene, inside `targetParts.forEach(part => ... if (part.isGroup) ...)`
         → change to: part.name
  L837:  threeGroup.name = part.id;       // same iteration, `else if (part.meshIds.length > 1)` branch
         → change to: part.name
  L991:  threeGroup.name = mergedId;      // in handleMerge; mergedPart spreads `first`, inherits `first.name`
         → change to: mergedPart.name
  L1023: threeGroup.name = groupId;       // in handleGroup; newGroup has `name: \`Group (${selected.length})\``
         → change to: newGroup.name
  L1315: threeGroup.name = `group_${part.name.toLowerCase()...}`  // ALREADY uses part.name — LEAVE UNCHANGED
```

**L4 — workspace-context + ScenePanel + _handleRenamePart current state**:
```
src/lib/workspace-context.tsx:
  L94: const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
  L87-89 (interface WorkspaceContextValue):
    segmentHierarchy: HierarchyItem[] | null;
    setSegmentHierarchy: (items: HierarchyItem[] | null) => void;
  L101-103 (provider state):
    const [segmentHierarchy, setSegmentHierarchy] = useState<HierarchyItem[] | null>(null);
  L158-159 (context value):
    segmentHierarchy,
    setSegmentHierarchy,

src/components/shared/ScenePanel.tsx:
  L21: const { sceneGraph, segmentHierarchy } = useWorkspace();
  L49-56: <HierarchyPanel items={items} selectedId={...} selectedIds={...}
            onSelect={sceneGraph?.onSelect} onMultiSelect={sceneGraph?.onMultiSelect}
            onVisibilityToggle={sceneGraph?.onVisibilityToggle} />
  — NO onRename prop currently passed.

src/app/workspace/segment/page.tsx:
  L1058-1061:
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _handleRenamePart = useCallback((id: string, name: string) => {
      setParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    }, [setParts]);
```

**Shared HierarchyPanel onRename support (already in place, no change needed)**:
```
src/components/shared/HierarchyPanel.tsx:
  L23, L36: onRename?: (id: string, name: string) => void;
  L86-93: rename keydown handler
  L105: onDoubleClick={onRename ? (e) => { ... setEditingId(item.id); ... } : undefined}
  L141: <input ref={renameInputRef} ... />
  L199, L207: forwarded to nested HierarchyNode
```

**Dead code to delete in L4**:
```
src/components/segment/SegmentHierarchyPanel.tsx (Phase 3 L3 port; zero references in new repo)
```

---

## File Structure

**Modified (rescoped per spec §3)**:
- `src/components/shared/TransformPanel.tsx` (3 class-string replacements)
- `src/app/workspace/segment/page.tsx` (2 hunks for L2, 4 hunks for L3, 2 hunks for L4)
- `src/lib/workspace-context.tsx` (add 1 optional field + setter)
- `src/components/shared/ScenePanel.tsx` (1 prop forward)

**Deleted**:
- `src/components/segment/SegmentHierarchyPanel.tsx` (Phase 3 L3 dead code)

**Untouched (per spec)**:
- ThreeViewport.tsx, HierarchyPanel.tsx (internal), ExportDropdown.tsx, AssetsPanel.tsx, LeftIconSidebar.tsx, TopNavBar.tsx, ProgressBar.tsx
- globals.css, tailwind.config.ts, layout.tsx
- Skip-worktree: next.config.mjs, package.json, pnpm-lock.yaml, tsconfig.json, vite.wc.config.mts

---

## Prerequisites

- Branch `feat/phase3-model-segment-uiux` currently at tip `d237cf8` (Phase 3 complete with lint fix)
- This plan continues on the SAME branch (no new branch created)

---

## Task 0: Pre-flight Verification

Pre-baked facts were gathered during plan writing; engineer only confirms nothing has drifted.

**Files:** none

- [ ] **Step 0.1: Confirm current branch state**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git branch --show-current
git log --oneline -1
git status --short
```
Expected:
- Branch: `feat/phase3-model-segment-uiux`
- HEAD: `d237cf8 chore(phase3): lint — prefix 2 unused symbols with _ for ESLint compliance`
- Working tree clean

- [ ] **Step 0.2: Re-verify L1 TransformPanel border lines (per pre-baked fact)**

```bash
grep -nE "border-phidias-border|border-accent-purple" src/components/shared/TransformPanel.tsx
```
Expected 4 matches at lines 43, 44, 80, 97.

- [ ] **Step 0.3: Re-verify L3 threeGroup.name lines**

```bash
grep -nE "threeGroup\.name\s*=" src/app/workspace/segment/page.tsx
```
Expected 5 matches: lines 826, 837, 991, 1023, 1315 (last one already uses `part.name`).

- [ ] **Step 0.4: Re-verify L4 `_handleRenamePart` location**

```bash
grep -n "_handleRenamePart" src/app/workspace/segment/page.tsx
```
Expected: line 1059 (definition). No other callers (the symbol is deliberately unused).

- [ ] **Step 0.5: Re-verify SegmentHierarchyPanel is dead code (safe to delete in L4)**

```bash
grep -rn "SegmentHierarchyPanel" src --include="*.tsx" --include="*.ts"
```
Expected ONLY match: `src/components/segment/SegmentHierarchyPanel.tsx` itself. If anything else appears, STOP and reconcile.

- [ ] **Step 0.6: Skip-worktree protection intact**

```bash
git ls-files -v | grep '^S '
```
Expected: 5 `S` lines — `next.config.mjs`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.wc.config.mts`.

---

## Task 1: L1 — TransformPanel border revert

3 class-string edits in a single file.

**Files:**
- Modify: `src/components/shared/TransformPanel.tsx` (lines 43-44, 80, 97)

- [ ] **Step 1.1: Replace the input-field border classes (lines 43-44)**

Find:
```
'w-full bg-bg-card border border-phidias-border rounded text-text-primary text-[11px] px-1.5 py-1',
'focus:outline-none focus:border-accent-purple transition-colors',
```
Replace with:
```
'w-full bg-bg-card border border-[#333355] rounded text-text-primary text-[11px] px-1.5 py-1',
'focus:outline-none focus:border-[#7c3aed] transition-colors',
```

- [ ] **Step 1.2: Replace first header-row border-b (line 80)**

Find:
```
<div className="flex items-center justify-between px-3 py-2 border-b border-phidias-border">
```
Replace with:
```
<div className="flex items-center justify-between px-3 py-2 border-b border-[#333355]">
```

- [ ] **Step 1.3: Replace second header-row border-b (line 97)**

Same replacement as Step 1.2 (the second occurrence — use `replace_all` OR edit individually by providing extra surrounding context).

- [ ] **Step 1.4: Verify no remaining `border-phidias-border` or `border-accent-purple` in this file**

```bash
grep -nE "border-phidias-border|border-accent-purple" src/components/shared/TransformPanel.tsx
```
Expected: zero matches.

- [ ] **Step 1.5: Build check**

```bash
pnpm build
```
Expected: exit 0, next-lint green.

- [ ] **Step 1.6: Commit**

```bash
git add src/components/shared/TransformPanel.tsx
git commit -m "fix(phase3.5): L1 — revert TransformPanel borders to hardcoded colors

Issue: Segment tab's TransformPanel UI border appeared white at runtime,
despite new repo's Tailwind tokens (border-phidias-border, border-accent-purple)
mapping to CSS variables (--border = #333355, --accent-purple = ...)
defined identically to old repo.

Root cause not fully diagnosed (Tailwind JIT / CSS variable resolution at
runtime suspected). Pragmatic fix: revert the 3 class usages in this file
back to the old repo's hardcoded color literals — identical color, bypasses
the token resolution chain entirely.

- line 43: border-phidias-border → border-[#333355]
- line 44: focus:border-accent-purple → focus:border-[#7c3aed]
- line 80, 97: border-b border-phidias-border → border-b border-[#333355]

No other consumers of TransformPanel affected (visual consistent with old repo).
Phase 3.5 rescoping of Q5=A for this single file is justified per spec §3."
```

---

## Task 2: L2 — Smart Organize gate → `hasMultipleParts`

Replace `isAssetSegmented` gate with `hasMultipleParts` (multi-part detection), restoring old repo's behavior where Smart Organize unlocks as soon as segmentation produces multiple parts (not only after GLB download completes).

**Files:**
- Modify: `src/app/workspace/segment/page.tsx` (2 hunks)

- [ ] **Step 2.1: Add `hasMultipleParts` useMemo**

Find a suitable location to insert the useMemo — ideally right before the `return` statement that renders JSX. A safe landmark is the line just before the JSX render. Search for an existing useMemo or useCallback block in the 1300-1350 range of the current file.

Insert this block immediately before the `return (` statement of the top-level component:

```typescript
const hasMultipleParts = useMemo(
  () => parts.filter((p) => !p.isGroup).length > 1,
  [parts],
);
```

To find where, run:
```bash
grep -n "^  return (" src/app/workspace/segment/page.tsx
```
Pick the first `return (` that lines up with the top-level component (usually the only one at column 3 near the middle of the file). Insert the useMemo block 2-3 lines above it, after any existing useMemo/useCallback calls.

- [ ] **Step 2.2: Replace the `isAssetSegmented` prop at line ~1545**

Find the full block (7 lines):
```typescript
isAssetSegmented={
  // Show Smart Organize ONLY when segmentation is confirmed to have
  // completed and the GLB result has been downloaded — i.e. the
  // asset has a real segmentation object in the store.  Do NOT
  // enable it just because results[] has a placeholder entry
  // (that gets set as soon as the job is submitted).
  !!(assets.find(a => a.id === activeAssetId)?.segmentation)
}
```

Replace with:
```typescript
hasMultipleParts={hasMultipleParts}
```

Note: the adjacent lines `isConnectionAvailable={isP3SAMAvailable}` and `remainingSlots={p3samRemainingSlots}` stay untouched (they are Phase 3 L2 Props superset additions and remain wired).

- [ ] **Step 2.3: Verify no dangling `isAssetSegmented` references in this file**

```bash
grep -n "isAssetSegmented" src/app/workspace/segment/page.tsx
```
Expected: zero matches (prop removed; the symbol was only used here).

The prop itself remains declared in `SegmentAIPanel.tsx`'s Props superset (Phase 3 L2 addition) — now it is an unused optional prop. Harmless.

- [ ] **Step 2.4: Build check**

```bash
pnpm build
```
Expected: exit 0. No new errors.

- [ ] **Step 2.5: Dev smoke (manual check)**

Start `pnpm dev`, visit `/workspace/segment` with a model that has been segmented into multiple parts. Verify: Smart Organize button appears as soon as parts are visible (not gated behind GLB download completion).

This step is a **best-effort** manual check; if no suitable test asset is available, the code inspection in Step 2.3 is sufficient per verification bar A.

- [ ] **Step 2.6: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "fix(phase3.5): L2 — restore hasMultipleParts gate for Smart Organize

Issue: Smart Organize button only appeared after segmentation fully
completed + GLB download finished (via isAssetSegmented gate that
checks asset.segmentation).

User expectation (per old repo behavior): button should unlock as soon
as multiple parts are detected, without waiting for download.

- Add hasMultipleParts useMemo (parts.filter(p => !p.isGroup).length > 1)
- Replace <SegmentAIPanel isAssetSegmented={...}> with hasMultipleParts={hasMultipleParts}
- isAssetSegmented prop remains declared in SegmentAIPanel.tsx Props superset
  (Phase 3 L2 addition) as unused optional — harmless

Polling pathway (useJobManager, isP3SAMAvailable, remainingSlots props)
untouched. Rescoping of 'do not touch page.tsx' for this hunk is
justified per Phase 3.5 spec §3."
```

---

## Task 3: L3 — `threeGroup.name` id → name for export accuracy

4 surgical edits in `segment/page.tsx` so that renamed / grouped / merged wrapper Groups carry their display name (not the stable ID) into the Three.js scene — which then flows through `exportSceneToGlb` into the exported GLB.

**Files:**
- Modify: `src/app/workspace/segment/page.tsx` (4 line changes)

This task is dispatched to a subagent because of multiple related changes requiring code-reading judgment (mergedPart.name resolution etc.).

- [ ] **Step 3.1: Dispatch implementer subagent with full Task 3 instructions (see below)**

The subagent prompt content:

```
You are the implementer for Task 3 (L3) of Phase 3.5. CWD:
/Users/between2058/Documents/gitlab_code/phidias-standalone. Branch:
feat/phase3-model-segment-uiux (do NOT switch).

Make exactly the following 4 changes to src/app/workspace/segment/page.tsx:

Change 1: line 826 (in rebuildThreeScene, part.isGroup branch)
  Before: threeGroup.name = part.id;
  After:  threeGroup.name = part.name;
  Context: inside `targetParts.forEach((part) => { if (part.isGroup && ...) { ... } })`.
  Verify surrounding: line 824 starts the if block; `part` is in scope with .name.

Change 2: line 837 (same iteration, else-if multi-mesh branch)
  Before: threeGroup.name = part.id;
  After:  threeGroup.name = part.name;
  Context: `} else if (part.meshIds.length > 1) { ... }`. Same `part` scope.

Change 3: line 991 (in handleMerge)
  Before: threeGroup.name = mergedId;
  After:  threeGroup.name = mergedPart.name;
  Context: `const mergedPart: Part = { ...first, id: mergedId, meshIds: allMeshIds };`
  — mergedPart spreads `first`, inherits `first.name`. mergedPart is in scope.

Change 4: line 1023 (in handleGroup)
  Before: threeGroup.name = groupId;
  After:  threeGroup.name = newGroup.name;
  Context: `const newGroup: Part = { id: groupId, name: \`Group (${selected.length})\`, ... };`
  newGroup is in scope.

DO NOT change line 1315 — it already uses part.name.
DO NOT change individual mesh.name anywhere (old repo fix
  e92d700/758146d explicitly preserved original mesh names for material
  tracking).

After edits:
1. Run `grep -nE "threeGroup\.name\s*=" src/app/workspace/segment/page.tsx`
   Expected 5 matches, 4 with *.name (lines 826, 837, 991, 1023) and 1
   pre-existing part.name interpolation (line 1315).
2. Run `pnpm build` — expect exit 0.
3. Commit with:
   git add src/app/workspace/segment/page.tsx
   git commit -m "fix(phase3.5): L3 — threeGroup.name uses part.name not id for export accuracy

Issue: After rename/merge/group, exported GLB contained part.id strings
(e.g. 'merged_1728394857123') instead of the user's renamed/given name.
Root cause: 4 sites in segment/page.tsx assigned threeGroup.name = part.id
(or mergedId / groupId), carrying the stable identifier into the scene
graph. exportSceneToGlb serialises scene node names verbatim.

Changes (4 hunks):
- L826, L837 (rebuildThreeScene iteration): part.id -> part.name
- L991 (handleMerge): mergedId -> mergedPart.name
- L1023 (handleGroup): groupId -> newGroup.name

Preserved (untouched):
- Individual mesh.name (old-repo fix e92d700/758146d guards material tracking)
- L1315 (already uses part.name)
- Polling logic, state machine, all other segment page code"

Hard constraints:
- Do NOT modify any file other than src/app/workspace/segment/page.tsx
- Do NOT modify skip-worktree'd files
- Do NOT change individual mesh.name (wrapper Group name only)
- If a line's exact context doesn't match what's described above (file
  has drifted since plan writing), STOP with status BLOCKED.

Report DONE / BLOCKED with:
- `grep -nE "threeGroup\.name\s*=" ...` output
- `pnpm build` outcome
- `git log --oneline -1`
- `git diff HEAD~1 HEAD --stat`
Keep report under 200 words.
```

- [ ] **Step 3.2: Controller verifies subagent's spec compliance (inline)**

After subagent returns DONE:
```bash
grep -nE "threeGroup\.name\s*=" src/app/workspace/segment/page.tsx
git diff HEAD~1 HEAD --stat
```
Expected: 5 matches total; 1 file changed, 4+/4- (exactly 4 insertions + 4 deletions — no scope creep).

- [ ] **Step 3.3: If diff-stat exceeds 4+4 lines, re-dispatch subagent for fix**

Acceptable: 4 insertions + 4 deletions. Anything more means scope creep — identify and revert surplus changes.

---

## Task 4: L4 — Rename wiring (workspace-context + ScenePanel + page handler + delete dead panel)

4-file cross-change opening a `segmentRenameHandler` channel on workspace-context.

**Files:**
- Modify: `src/lib/workspace-context.tsx` (add 1 field + setter)
- Modify: `src/app/workspace/segment/page.tsx` (2 hunks)
- Modify: `src/components/shared/ScenePanel.tsx` (1 prop forward)
- Delete: `src/components/segment/SegmentHierarchyPanel.tsx` (Phase 3 L3 dead code)

This task is dispatched to a subagent.

- [ ] **Step 4.1: Dispatch implementer subagent with full Task 4 instructions (see below)**

The subagent prompt content:

```
You are the implementer for Task 4 (L4) of Phase 3.5. CWD:
/Users/between2058/Documents/gitlab_code/phidias-standalone. Branch:
feat/phase3-model-segment-uiux (do NOT switch).

Implement rename wiring across 4 files per the sequence below. The target
architecture: segment/page.tsx registers its handleRenamePart on
workspace-context; ScenePanel reads the handler and forwards it as
HierarchyPanel's onRename prop; shared HierarchyPanel already has the
internal onRename handling (no change needed).

Pre-baked facts: see plan's top-of-document 'Pre-baked facts / L4' block.

### Change A: src/lib/workspace-context.tsx

A.1: In `interface WorkspaceContextValue` (around line 87-91), add after
`setSegmentHierarchy`:
```
  segmentRenameHandler: ((id: string, name: string) => void) | null;
  setSegmentRenameHandler: (handler: ((id: string, name: string) => void) | null) => void;
```

A.2: In `WorkspaceProvider`, around line 101-103 (near `const [segmentHierarchy, setSegmentHierarchy] = useState<...>`), add state:
```
  const [segmentRenameHandler, setSegmentRenameHandler] = useState<
    ((id: string, name: string) => void) | null
  >(null);
```

A.3: In the provider's context value (around line 158-159, near
`segmentHierarchy, setSegmentHierarchy,`), add:
```
        segmentRenameHandler,
        setSegmentRenameHandler,
```

### Change B: src/components/shared/ScenePanel.tsx

B.1: Destructure new fields from useWorkspace (line 21):
  Before: const { sceneGraph, segmentHierarchy } = useWorkspace();
  After:  const { sceneGraph, segmentHierarchy, segmentRenameHandler } = useWorkspace();

B.2: Pass onRename to HierarchyPanel (around line 49-56). Current:
```
        <HierarchyPanel
          items={items}
          selectedId={sceneGraph?.selectedId ?? undefined}
          selectedIds={sceneGraph?.selectedIds ?? undefined}
          onSelect={sceneGraph?.onSelect}
          onMultiSelect={sceneGraph?.onMultiSelect}
          onVisibilityToggle={sceneGraph?.onVisibilityToggle}
        />
```
Add one prop:
```
        <HierarchyPanel
          items={items}
          selectedId={sceneGraph?.selectedId ?? undefined}
          selectedIds={sceneGraph?.selectedIds ?? undefined}
          onSelect={sceneGraph?.onSelect}
          onMultiSelect={sceneGraph?.onMultiSelect}
          onVisibilityToggle={sceneGraph?.onVisibilityToggle}
          onRename={segmentRenameHandler ?? undefined}
        />
```

### Change C: src/app/workspace/segment/page.tsx

C.1: Rename `_handleRenamePart` → `handleRenamePart` (lines 1058-1061).
  Before:
```
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleRenamePart = useCallback((id: string, name: string) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, [setParts]);
```
  After:
```
  const handleRenamePart = useCallback((id: string, name: string) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, [setParts]);
```

C.2: Register handler via workspace-context. Grep `useWorkspace()` in the
file to find where the destructure is; add `setSegmentRenameHandler` to
the destructure, then add a useEffect right after other useEffect blocks
(search for a useEffect near where segmentHierarchy is being set):

```
  useEffect(() => {
    setSegmentRenameHandler(handleRenamePart);
    return () => setSegmentRenameHandler(null);
  }, [handleRenamePart, setSegmentRenameHandler]);
```

If the file's existing useWorkspace destructure doesn't include
`setSegmentRenameHandler`, add it. For example:
  Before: const { setSegmentHierarchy } = useWorkspace();
  After:  const { setSegmentHierarchy, setSegmentRenameHandler } = useWorkspace();
(adapt to the actual existing destructure shape).

### Change D: Delete dead SegmentHierarchyPanel

D.1: Confirm zero references:
```
grep -rn "SegmentHierarchyPanel" src --include="*.tsx" --include="*.ts"
```
Expected ONLY: src/components/segment/SegmentHierarchyPanel.tsx itself.

D.2: Delete the file:
```
git rm src/components/segment/SegmentHierarchyPanel.tsx
```

### Verification

```
pnpm build
```
Expected: exit 0, next-lint green.

Manual smoke (best-effort): `pnpm dev`, visit /workspace/segment, double-
click a part name in the hierarchy panel → it should become an editable
input → type a new name + Enter → name updates visually.

### Commit

```
git add src/lib/workspace-context.tsx \
        src/components/shared/ScenePanel.tsx \
        src/app/workspace/segment/page.tsx \
        src/components/segment/SegmentHierarchyPanel.tsx
git commit -m "fix(phase3.5): L4 — wire segment rename through workspace-context -> ScenePanel -> HierarchyPanel

Issue: Double-click on a part in the segment hierarchy did not rename.
Root cause: new repo's _handleRenamePart in segment/page.tsx was
deliberately disabled (underscore prefix + eslint-disable no-unused-vars
annotation). The shared HierarchyPanel already supports onRename internally
(onDoubleClick + rename input) — only the wiring was severed.

Architecture (Option B from spec):
- workspace-context exposes a segmentRenameHandler field that segment page
  registers on mount and clears on unmount.
- ScenePanel reads the handler and forwards to HierarchyPanel's onRename prop.
- Shared HierarchyPanel's existing internal rename UX lights up automatically.

Changes:
- workspace-context.tsx: add segmentRenameHandler (nullable) + setter to
  WorkspaceContextValue, provider state, provider value.
- ScenePanel.tsx: destructure segmentRenameHandler; pass as
  onRename={segmentRenameHandler ?? undefined} to HierarchyPanel.
- segment/page.tsx: un-disable handleRenamePart (remove _ prefix +
  eslint-disable); add useEffect to register/deregister handler on
  workspace-context.
- Delete SegmentHierarchyPanel.tsx (Phase 3 L3 dead code after Option B
  chosen in Phase 3.5 brainstorming)"
```

Hard constraints:
- Do NOT modify files outside the 4 listed
- Do NOT modify skip-worktree'd files
- Do NOT modify HierarchyPanel.tsx internals (onRename support already present)
- Do NOT add features beyond wiring (e.g. don't add validation,
  confirmation dialogs, or other rename safeguards)

Report DONE / BLOCKED / NEEDS_CONTEXT with:
- pnpm build outcome
- git log --oneline -1
- git diff HEAD~1 HEAD --stat (expected: 4 files changed)
- grep -rn "SegmentHierarchyPanel" src — should have zero matches
- Any unexpected issues in any of A/B/C/D steps
Keep report under 400 words.
```

- [ ] **Step 4.2: Controller verifies subagent's spec compliance (inline)**

After subagent returns DONE:
```bash
grep -rn "SegmentHierarchyPanel" src --include="*.tsx" --include="*.ts"   # should be empty
grep -n "_handleRenamePart" src/app/workspace/segment/page.tsx            # should be empty (symbol renamed)
grep -n "segmentRenameHandler" src/lib/workspace-context.tsx              # should have 3+ matches
git diff HEAD~1 HEAD --stat                                                # should list 4 files
```

---

## Task 5: Final Regression Smoke Test

End-to-end verification after all 4 layers.

**Files:** none

- [ ] **Step 5.1: Clean build**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
rm -rf .next
pnpm build
```
Expected: exit 0, next-lint green.

- [ ] **Step 5.2: Dev server smoke test (6 routes)**

```bash
pkill -f "next dev" 2>/dev/null; sleep 1
pnpm dev > /tmp/p35_dev.log 2>&1 &
DEV_PID=$!
for i in $(seq 1 30); do
  grep -q "Ready in" /tmp/p35_dev.log 2>/dev/null && break
  sleep 1
done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/p35_dev.log | head -1 | cut -d: -f2)
echo "dev on :$PORT"
for ROUTE in "/" "/workspace/model" "/workspace/image" "/workspace/segment" "/workspace/texture" "/workspace/physics"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "http://localhost:$PORT$ROUTE")
  echo "  $ROUTE → HTTP $CODE"
done
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
grep -iE "error|warn" /tmp/p35_dev.log | grep -vE "npmrc|CICD" | head -10
```
Expected: every route HTTP 200; no runtime errors in dev log beyond the harmless `.npmrc` warning.

- [ ] **Step 5.3: Skip-worktree intact**

```bash
git status --short
git ls-files -v | grep '^S '
```
Expected:
- Empty `git status --short`
- 5 `S` lines (skip-worktree files unchanged)

- [ ] **Step 5.4: Phase 3.5 commit log review**

```bash
git log --oneline computex-demo..HEAD
```
Expected last-on-top sequence:
- `... fix(phase3.5): L4 — wire segment rename...`
- `... fix(phase3.5): L3 — threeGroup.name uses part.name...`
- `... fix(phase3.5): L2 — restore hasMultipleParts gate...`
- `... fix(phase3.5): L1 — revert TransformPanel borders...`
- `d237cf8 chore(phase3): lint — prefix 2 unused symbols with _...`
- (older Phase 3 commits below)

- [ ] **Step 5.5: Verification bar checklist**

Tick each after manual / code confirmation:

- [x] `pnpm install` unchanged (no new deps)
- [x] `pnpm build` passes (next-lint green)
- [x] All 6 routes return HTTP 200
- [x] Issue 1: TransformPanel border is dark purple (#333355), not white
- [x] Issue 2: Smart Organize button appears when multiple parts detected (not gated behind download completion)
- [x] Issue 3: Double-click part name → editable input → rename works
- [x] Issue 4: After rename/merge/group, the wrapper Group's Three.js name matches the part's display name (code-level verified via git diff; real export test left to user)
- [x] skip-worktree 5 files unchanged

If all boxes tick, Phase 3.5 is complete. Notify user; await go-ahead before fast-forwarding Phase 3 + 3.5 into `computex-demo`.

---

## Known Follow-ups (out of this phase's scope)

- **Phase 4** — Shared UI polish (TopNavBar, LeftIconSidebar, AssetsPanel, globals.css, NavActions, UploadToPegaverseModal, AgentChatPanel). The 4 issues Phase 3.5 addressed are targeted; broader visual parity work remains.
- **Tailwind token root cause** — Why did `border-phidias-border` resolve to white at runtime despite CSS variable being defined? If/when someone wants to diagnose, L1's hardcoded revert can be revisited. Pure cosmetic, no functional impact.
- **Export test with real backend** — Issue 4's fix is code-correct (`threeGroup.name` now carries display name); end-to-end rename→group→export GLB validation requires a working articulation/export backend. Out of verification bar A.
- **Phase 3 L3 commit status** — `ea94dcb feat(segment): L3 — port SegmentHierarchyPanel from old (verbatim, 63 line diff)` becomes effectively no-op once SegmentHierarchyPanel.tsx is deleted in L4. Keep the commit in history (revert adds noise); L4's commit message explains the deletion rationale.
