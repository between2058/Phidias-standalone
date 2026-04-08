# Viewer, Export & UX Improvements Design

**Date:** 2026-04-08
**Scope:** 7 issues covering render modes, data flow, export, and UI consistency

---

## Overview

This spec addresses 7 user-reported issues grouped into 3 domains:

- **Domain A** — Render Mode System (issues 2, 3)
- **Domain B** — Data Flow & Export (issues 5, 6, 7)
- **Domain C** — Independent Fixes (issues 1, 4)

---

## Domain A: Render Mode System

### Issue 2: Normal Mode

**Goal:** Add a normal visualization mode that maps surface normal directions to RGB colors (MeshNormalMaterial style: blue = facing camera, pink/green = side-facing).

**Changes:**

1. Extend `RenderMode` type in `ThreeViewport.tsx`:
   ```typescript
   export type RenderMode = 'solid' | 'wireframe' | 'textured' | 'matcap' | 'normal';
   ```

2. Add `'normal'` case in the render mode switch within `ThreeViewport.tsx`:
   - Apply `THREE.MeshNormalMaterial` to all meshes
   - Store original materials in `userData.__origMaterial` (same pattern as other modes)
   - Restore originals when switching away from normal mode

### Issue 3: Wireframe Mode UI Exposure

**Goal:** The wireframe render mode already exists in `ThreeViewport.tsx` (blue `MeshBasicMaterial` with `wireframe=true`), but no UI control is exposed on most pages. Make it selectable.

### Shared: RenderModeSelector Component

**New file:** `src/components/shared/RenderModeSelector.tsx`

- A row of icon buttons (Lucide icons), styled to match existing UI (glassmorphism, purple accent)
- Props:
  - `availableModes: RenderMode[]` — which modes to show (page controls this)
  - `current: RenderMode` — active mode
  - `onChange: (mode: RenderMode) => void`
- Each page integrates the selector and manages its own `renderMode` state
- Initial integration targets:
  - Segment page: `['textured', 'solid', 'wireframe', 'normal']`, default `'textured'`
  - Model page: same set, default `'textured'`
- Other pages: unchanged for now

**Not in scope:**
- No changes to matcap implementation
- No vertex normal arrows (VertexNormalsHelper) — only RGB color mapping

---

## Domain B: Data Flow & Export

### Root Cause Analysis

The core issue is a disconnect between React state (`parts[]` in Zustand) and the Three.js scene graph:

1. `rebuildThreeScene()` creates `THREE.Group` objects with `threeGroup.name = part.id` (synthetic IDs like `group_170654200`) instead of `part.name` (user-defined names)
2. `handleRenamePart()` only updates `parts[].name` in Zustand — never syncs to the Three.js object's `.name` property
3. `GLTFExporter` exports whatever is in the Three.js scene, so exported GLBs contain synthetic IDs instead of meaningful names
4. This affects all export paths, even within the Segment tab

### Issue 5: Export Not Reflecting Modifications

**Changes:**

1. **`rebuildThreeScene()` fix:**
   - Set `threeGroup.name = part.name` (not `part.id`)
   - Store `part.id` in `threeGroup.userData.partId` for internal lookups
   - For single-mesh parts: also sync `mesh.name = part.name`

2. **`handleRenamePart()` Three.js sync:**
   - After updating `parts[]`, find the corresponding Three.js object in `sceneRef.current` and update its `.name`
   - This is a targeted point update — no full `rebuildThreeScene()` needed for rename

3. **Export path validation:**
   - Verify `ExportDropdown` in Segment tab receives the correct `sceneRef.current` (the rebuilt scene)
   - Verify material restoration (`__origMaterial`) does not disrupt group hierarchy
   - Verify group structure is preserved in exported GLB

### Issue 6: Double-Click Rename Broken

**File:** `src/components/segment/SegmentHierarchyPanel.tsx`

**Changes:**

- Debug and fix the `onDoubleClick` → `startEditing` → `commitRename` flow
- Investigate potential causes:
  - Event conflict between `onClick` (selection) and `onDoubleClick` (rename)
  - `renameInputRef` timing: `autoFocus` + `setTimeout(() => select(), 0)` race condition
  - `commitRename` → `onRenamePart` callback not firing correctly
- Ensure the inline input reliably appears, focuses, and commits on Enter/blur

### Issue 7: Cross-Tab Data Sync

**Changes:**

- Ensure the `useEffect` that publishes `segmentHierarchy` to `WorkspaceContext` watches all relevant `parts[]` mutations (rename, group, merge, smart organize)
- Other tabs reading `segmentHierarchy` will display the latest names and structure without needing their own `sceneRef`

**Not in scope:**
- No `WorkspaceContext` architecture refactor
- No merging transform history into Zundo
- No changes to export logic in non-Segment tabs

---

## Domain C: Independent Fixes

### Issue 1: Smart Organize for Multi-Part Meshes

**Goal:** Enable Smart Organize in the Segment tab when the loaded model has multiple parts, even without running segmentation.

**Changes:**

1. In Segment page: derive `hasMultipleParts` from `parts[]` — `true` when there are multiple non-group parts
2. Pass `hasMultipleParts` as a new prop to `SegmentAIPanel`
3. In `SegmentAIPanel.tsx`, change the Smart Organize button visibility condition:
   ```
   // Before:
   results.length > 0 && !isSegmenting && onSmartOrganize

   // After:
   (results.length > 0 || hasMultipleParts) && !isSegmenting && onSmartOrganize
   ```

**Not in scope:**
- No changes to Smart Organize API logic or VLM calls

### Issue 4: Transform Panel Border Color Consistency

**Goal:** Unify the TransformPanel's border/outline colors with the rest of the right-side panels.

**Changes:**

- Audit all border/outline classes in `TransformPanel.tsx`
- Replace any inconsistent or hardcoded color values with shared Tailwind theme tokens (`border-phidias-border`, `focus:border-accent-purple`)
- Ensure both the container border and input field borders match the styling of `SegmentHierarchyPanel`, `ScenePanel`, and other sibling panels

**Not in scope:**
- No new theme tokens — use existing ones

---

## Key Files

| File | Changes |
|------|---------|
| `src/components/shared/ThreeViewport.tsx` | Add `'normal'` to `RenderMode`, implement `MeshNormalMaterial` case |
| `src/components/shared/RenderModeSelector.tsx` | **New file** — shared render mode icon button group |
| `src/app/workspace/segment/page.tsx` | Add `renderMode` state, integrate `RenderModeSelector`, fix `rebuildThreeScene()`, fix `handleRenamePart()` sync, derive `hasMultipleParts` |
| `src/app/workspace/model/page.tsx` | Add `renderMode` state, integrate `RenderModeSelector` |
| `src/components/segment/SegmentAIPanel.tsx` | Accept `hasMultipleParts` prop, update Smart Organize visibility condition |
| `src/components/segment/SegmentHierarchyPanel.tsx` | Fix double-click rename event handling |
| `src/components/shared/TransformPanel.tsx` | Unify border colors with theme tokens |
| `src/components/shared/ExportDropdown.tsx` | Validate export path uses rebuilt scene correctly |
