# Viewer, Export & UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 issues across render modes, data flow/export, and UI consistency in the Phidias 3D editor.

**Architecture:** Three independent domains — (A) Render Mode System: extend RenderMode type + build shared selector component, (B) Data Flow & Export: fix the React-to-Three.js sync pipeline so exports reflect user modifications, (C) Independent fixes for Smart Organize detection and TransformPanel styling.

**Tech Stack:** Next.js 14, React Three Fiber, Three.js, Zustand, Tailwind CSS, Lucide React

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/shared/ThreeViewport.tsx` | Modify | Add `'normal'` render mode with `MeshNormalMaterial` |
| `src/components/shared/RenderModeSelector.tsx` | **Create** | Shared icon-button toolbar for switching render modes |
| `src/app/workspace/segment/page.tsx` | Modify | Integrate RenderModeSelector, fix `rebuildThreeScene`, fix `handleRenamePart` Three.js sync, derive `hasMultipleParts` |
| `src/app/workspace/model/page.tsx` | Modify | Integrate RenderModeSelector, make `renderMode` mutable |
| `src/components/segment/SegmentAIPanel.tsx` | Modify | Accept `hasMultipleParts` prop, update Smart Organize visibility |
| `src/components/segment/SegmentHierarchyPanel.tsx` | Modify | Fix double-click rename event handling |
| `src/components/shared/TransformPanel.tsx` | Modify | Audit and unify border colors with theme tokens |
| `src/components/shared/ExportDropdown.tsx` | Verify | Confirm export path works after `rebuildThreeScene` fix |

---

## Task 1: Add `'normal'` to RenderMode and implement MeshNormalMaterial

**Files:**
- Modify: `src/components/shared/ThreeViewport.tsx:50` (type), `src/components/shared/ThreeViewport.tsx:318-351` (switch)

- [ ] **Step 1: Extend the RenderMode type**

In `src/components/shared/ThreeViewport.tsx`, line 50, change:

```typescript
export type RenderMode = 'solid' | 'wireframe' | 'textured' | 'matcap';
```

to:

```typescript
export type RenderMode = 'solid' | 'wireframe' | 'textured' | 'matcap' | 'normal';
```

- [ ] **Step 2: Add the `'normal'` case in the render mode switch**

In `src/components/shared/ThreeViewport.tsx`, find the render mode switch statement (around line 318). Add a new case **before** the `'textured'` default case. Insert after the `case 'matcap':` block (around line 330):

```typescript
case 'normal': {
  child.material = new THREE.MeshNormalMaterial();
  break;
}
```

The full switch should now read:

```typescript
switch (renderMode) {
  case 'wireframe': {
    child.material = new THREE.MeshBasicMaterial({ color: '#4a90d9', wireframe: true });
    break;
  }
  case 'solid': {
    child.material = new THREE.MeshStandardMaterial({
      color: isHighlighted(child) ? '#6366f1' : '#8899bb',
      roughness: 0.7,
      metalness: 0.1,
      emissive: isHighlighted(child) ? new THREE.Color('#6366f1') : new THREE.Color(0),
      emissiveIntensity: isHighlighted(child) ? 0.35 : 0,
    });
    break;
  }
  case 'matcap': {
    child.material = new THREE.MeshMatcapMaterial({ color: '#cccccc' });
    break;
  }
  case 'normal': {
    child.material = new THREE.MeshNormalMaterial();
    break;
  }
  case 'textured':
  default: {
    // ... existing textured code ...
  }
}
```

- [ ] **Step 3: Verify**

Run `npm run build` to check for type errors. Then run `npm run dev`, load a model, and confirm:
- The existing modes (solid, wireframe, textured, matcap) still work as before
- Changing the renderMode prop to `'normal'` via React DevTools shows the RGB normal colors (blue=facing camera, pink/green=sides)

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ThreeViewport.tsx
git commit -m "feat(viewer): add normal render mode with MeshNormalMaterial"
```

---

## Task 2: Create RenderModeSelector component

**Files:**
- Create: `src/components/shared/RenderModeSelector.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/shared/RenderModeSelector.tsx`:

```tsx
'use client';

import { cn } from '@/lib/utils';
import type { RenderMode } from '@/components/shared/ThreeViewport';
import { Box, Grid3x3, Eye, Layers, Hexagon } from 'lucide-react';

/** Icon and tooltip for each render mode */
const MODE_META: Record<RenderMode, { icon: React.ElementType; label: string }> = {
  textured: { icon: Eye, label: 'Textured' },
  solid: { icon: Box, label: 'Solid' },
  wireframe: { icon: Grid3x3, label: 'Wireframe' },
  normal: { icon: Hexagon, label: 'Normal' },
  matcap: { icon: Layers, label: 'Matcap' },
};

interface RenderModeSelectorProps {
  availableModes: RenderMode[];
  current: RenderMode;
  onChange: (mode: RenderMode) => void;
  className?: string;
}

export default function RenderModeSelector({
  availableModes,
  current,
  onChange,
  className,
}: RenderModeSelectorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg p-0.5',
        className,
      )}
      style={{ background: 'rgba(20, 20, 40, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      {availableModes.map((mode) => {
        const { icon: Icon, label } = MODE_META[mode];
        const isActive = mode === current;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            title={label}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md transition-colors',
              isActive
                ? 'bg-accent-purple text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run `npm run build`. Expected: no errors. The component is not yet used anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/RenderModeSelector.tsx
git commit -m "feat(viewer): add shared RenderModeSelector component"
```

---

## Task 3: Integrate RenderModeSelector into Segment page

**Files:**
- Modify: `src/app/workspace/segment/page.tsx`

The Segment page currently uses `colorViewMode` / `onColorViewModeChange` (original vs colored) but has **no** `renderMode` state. We need to add `renderMode` state and pass it to `ThreeViewport`, and render the `RenderModeSelector` in the viewport area.

- [ ] **Step 1: Add renderMode state and import**

At the top of `src/app/workspace/segment/page.tsx`, add the import (near the other component imports):

```typescript
import RenderModeSelector from '@/components/shared/RenderModeSelector';
import type { RenderMode } from '@/components/shared/ThreeViewport';
```

Inside the component function, near the `viewMode` state (around line 416), add:

```typescript
const [renderMode, setRenderMode] = useState<RenderMode>('textured');
```

- [ ] **Step 2: Pass renderMode to ThreeViewport**

In the `<ThreeViewport>` JSX (around line 1293), add the `renderMode` prop:

```typescript
<ThreeViewport
  modelUrl={activeModelUrl ?? ''}
  showGrid={false}
  renderMode={renderMode}
  // ... rest of existing props unchanged
/>
```

- [ ] **Step 3: Render RenderModeSelector in the viewport area**

Find the viewport container div that wraps `<ThreeViewport>`. Add the `RenderModeSelector` positioned absolutely in the top-left corner of the viewport. Look for the div that contains ThreeViewport (it should have `relative` positioning or be a flex container). Add just before or after the existing `ThreeViewport`:

```tsx
<RenderModeSelector
  availableModes={['textured', 'solid', 'wireframe', 'normal']}
  current={renderMode}
  onChange={setRenderMode}
  className="absolute top-3 left-3 z-10"
/>
```

Make sure the parent container has `className="relative"` so the absolute positioning works.

- [ ] **Step 4: Verify**

Run `npm run dev`. Navigate to the Segment tab:
- Confirm the render mode selector appears in the top-left of the viewport
- Click each mode button: textured, solid, wireframe, normal
- Verify the 3D model updates to the correct rendering style
- Verify that color view mode (original/colored toggle) still works independently
- Verify segment colors still appear correctly in textured mode

- [ ] **Step 5: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "feat(segment): integrate RenderModeSelector into Segment viewport"
```

---

## Task 4: Integrate RenderModeSelector into Model page

**Files:**
- Modify: `src/app/workspace/model/page.tsx:95` (renderMode state), viewport JSX

- [ ] **Step 1: Make renderMode state mutable and add import**

In `src/app/workspace/model/page.tsx`, add the import:

```typescript
import RenderModeSelector from '@/components/shared/RenderModeSelector';
```

Find line 95:

```typescript
const [renderMode] = useState<RenderMode>('textured');
```

Change to:

```typescript
const [renderMode, setRenderMode] = useState<RenderMode>('textured');
```

- [ ] **Step 2: Render RenderModeSelector in the viewport area**

Find the viewport container that wraps `<ThreeViewport>` (around line 423). Add the selector positioned in the top-left, similar to the Segment page:

```tsx
<RenderModeSelector
  availableModes={['textured', 'solid', 'wireframe', 'normal']}
  current={renderMode}
  onChange={setRenderMode}
  className="absolute top-3 left-3 z-10"
/>
```

Ensure the parent container has `relative` positioning.

- [ ] **Step 3: Verify**

Run `npm run dev`. Navigate to the Model tab:
- Confirm the render mode selector appears
- Click each mode and verify the model renders correctly
- Verify existing functionality (transform controls, scene graph, etc.) still works

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/model/page.tsx
git commit -m "feat(model): integrate RenderModeSelector into Model viewport"
```

---

## Task 5: Fix `rebuildThreeScene` to use `part.name` for Three.js group names

**Files:**
- Modify: `src/app/workspace/segment/page.tsx:711-780` (rebuildThreeScene)

This is the core fix for issue #5. Currently `rebuildThreeScene` sets `threeGroup.name = part.id` (e.g., `group_170654200`). We change it to use `part.name` and store `part.id` in `userData.partId`.

- [ ] **Step 1: Fix group creation in rebuildThreeScene — group parts**

In `src/app/workspace/segment/page.tsx`, find the `rebuildThreeScene` function (around line 711). Locate the first `threeGroup.name = part.id;` line (around line 745, inside the `if (part.isGroup && part.childIds)` block). Change:

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = part.id;
```

to:

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = part.name;
threeGroup.userData.partId = part.id;
```

- [ ] **Step 2: Fix group creation in rebuildThreeScene — merged parts**

In the same function, find the second `threeGroup.name = part.id;` line (around line 757, inside the `else if (part.meshIds.length > 1)` block). Apply the same change:

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = part.id;
```

to:

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = part.name;
threeGroup.userData.partId = part.id;
```

- [ ] **Step 3: Sync single-mesh part names**

Still inside `rebuildThreeScene`, after the group creation blocks (after the `targetParts.forEach` that creates groups, before the visibility restoration step), add a pass to sync single-mesh part names:

```typescript
// Sync mesh names for single-mesh parts
targetParts.forEach((part) => {
  if (!part.isGroup && part.meshIds.length === 1) {
    const entry = registry.get(part.meshIds[0]);
    if (entry?.obj) {
      entry.obj.name = part.name;
      entry.obj.userData.partId = part.id;
    }
  }
});
```

- [ ] **Step 4: Update group identification in cleanup step**

In the same function, the cleanup step (around line 721) removes groups by checking `child.name.startsWith('merged_') || child.name.startsWith('group_')`. After our changes, groups will be named with user-given names. We need to identify groups by `userData.partId` instead:

Change:

```typescript
if (
  child instanceof THREE.Group &&
  (child.name.startsWith('merged_') || child.name.startsWith('group_'))
) {
  toRemove.push(child);
}
```

to:

```typescript
if (
  child instanceof THREE.Group &&
  (child.userData.partId || child.name.startsWith('merged_') || child.name.startsWith('group_'))
) {
  toRemove.push(child);
}
```

This ensures backward compatibility with any existing groups that have synthetic names AND forward compatibility with the new `userData.partId` approach.

- [ ] **Step 5: Apply the same fix to `handleMerge`**

Find `handleMerge` (around line 893). Locate the Three.js group creation block (around line 908):

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = mergedId;
```

Change to:

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = first.name;
threeGroup.userData.partId = mergedId;
```

- [ ] **Step 6: Apply the same fix to `handleGroup`**

Find `handleGroup` (around line 918). Locate the Three.js group creation block (around line 940):

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = groupId;
```

Change to:

```typescript
const threeGroup = new THREE.Group();
threeGroup.name = `Group (${selected.length})`;
threeGroup.userData.partId = groupId;
```

- [ ] **Step 7: Verify**

Run `npm run dev`. In the Segment tab:
1. Load a model and run segmentation
2. Merge two parts → check that the Three.js group name is the first part's name (not `merged_*`)
3. Create a group → check the group name is `Group (N)` (not `group_*`)
4. Rename a part via smart organize → export as GLB → reimport the GLB and verify the exported node names match the user-defined names

- [ ] **Step 8: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "fix(segment): use part.name for Three.js group names instead of synthetic IDs"
```

---

## Task 6: Fix `handleRenamePart` to sync Three.js object names

**Files:**
- Modify: `src/app/workspace/segment/page.tsx:976-978` (handleRenamePart)

Currently `handleRenamePart` only updates `parts[].name` in Zustand. We need to also update the Three.js object's `.name`.

- [ ] **Step 1: Add Three.js sync to handleRenamePart**

Find `handleRenamePart` (around line 976):

```typescript
const handleRenamePart = useCallback((id: string, name: string) => {
  setParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
}, [setParts]);
```

Replace with:

```typescript
const handleRenamePart = useCallback((id: string, name: string) => {
  setParts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));

  // Sync to Three.js scene: find the object by partId and update its name
  const scene = sceneRef.current;
  if (scene) {
    scene.traverse((child) => {
      if (child.userData.partId === id) {
        child.name = name;
      }
    });
  }
}, [setParts]);
```

- [ ] **Step 2: Verify**

Run `npm run dev`. In the Segment tab:
1. Load a model and run segmentation
2. Rename a part (via smart organize or the double-click rename once that's fixed)
3. Export as GLB
4. Reimport the GLB and check that the exported node has the new name

- [ ] **Step 3: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "fix(segment): sync part rename to Three.js scene object names"
```

---

## Task 7: Fix double-click rename in SegmentHierarchyPanel

**Files:**
- Modify: `src/components/segment/SegmentHierarchyPanel.tsx`

The double-click rename code looks structurally correct. The most likely issue is an event timing/propagation problem. The `onClick` fires on first click (selecting the part), then `onDoubleClick` fires — but by then the component may re-render due to selection state change, causing the `onDoubleClick` handler to be lost or the DOM element to be replaced.

- [ ] **Step 1: Investigate by reading the current code**

Read `src/components/segment/SegmentHierarchyPanel.tsx` fully. Focus on:
- Lines 99-106: onClick/onDoubleClick on part rows
- Lines 164-171: onClick/onDoubleClick on group rows
- Lines 44-49: startEditing
- Lines 122-132: inline input rendering

- [ ] **Step 2: Add a debounced click handler to prevent selection from interfering with double-click**

The issue is likely that `onClick` triggers a state change (selection), which causes a re-render between the first and second click. The `e.detail === 2` guard prevents the selection, but the first click (detail=1) still fires `handleRowClick`, which calls `onSelectPart`. This triggers a re-render that can cause the onDoubleClick to be lost.

Fix: Delay the onClick handler slightly so it doesn't fire if a double-click follows. Replace the onClick/onDoubleClick pattern in the **part row** (around lines 99-106):

First, add a ref for the click timer at the component level (near the other refs, around line 42):

```typescript
const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Then, update the part row handlers (around lines 99-106). Replace:

```typescript
onClick={(e) => {
  if (e.detail === 2) return;
  handleRowClick(e, part.id);
}}
onDoubleClick={(e) => {
  e.stopPropagation();
  startEditing(part.id, part.name);
}}
```

with:

```typescript
onClick={(e) => {
  if (e.detail === 2) return;
  if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  clickTimerRef.current = setTimeout(() => {
    handleRowClick(e, part.id);
    clickTimerRef.current = null;
  }, 200);
}}
onDoubleClick={(e) => {
  e.stopPropagation();
  if (clickTimerRef.current) {
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  }
  startEditing(part.id, part.name);
}}
```

- [ ] **Step 3: Apply the same fix to group rows**

Find the group row handlers (around lines 164-171). Apply the identical pattern:

Replace:

```typescript
onClick={(e) => {
  if (e.detail === 2) return;
  handleRowClick(e, group.id);
}}
onDoubleClick={(e) => {
  e.stopPropagation();
  startEditing(group.id, group.name);
}}
```

with:

```typescript
onClick={(e) => {
  if (e.detail === 2) return;
  if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  clickTimerRef.current = setTimeout(() => {
    handleRowClick(e, group.id);
    clickTimerRef.current = null;
  }, 200);
}}
onDoubleClick={(e) => {
  e.stopPropagation();
  if (clickTimerRef.current) {
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  }
  startEditing(group.id, group.name);
}}
```

- [ ] **Step 4: Clean up timer on unmount**

Add a cleanup effect at the component level (near the other useEffects):

```typescript
useEffect(() => {
  return () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  };
}, []);
```

- [ ] **Step 5: Verify**

Run `npm run dev`. In the Segment tab:
1. Load a model and run segmentation
2. Double-click a part name in the hierarchy panel
3. Confirm the inline input appears and is focused
4. Type a new name, press Enter — confirm the name updates
5. Double-click another part, press Escape — confirm editing cancels
6. Single-click a part — confirm selection still works (with ~200ms delay)
7. Repeat steps 2-6 for a group row

- [ ] **Step 6: Commit**

```bash
git add src/components/segment/SegmentHierarchyPanel.tsx
git commit -m "fix(segment): fix double-click rename with debounced click handler"
```

---

## Task 8: Enable Smart Organize for multi-part meshes

**Files:**
- Modify: `src/app/workspace/segment/page.tsx` (derive hasMultipleParts)
- Modify: `src/components/segment/SegmentAIPanel.tsx:126-137` (props), `src/components/segment/SegmentAIPanel.tsx:405` (condition)

- [ ] **Step 1: Derive `hasMultipleParts` in segment page**

In `src/app/workspace/segment/page.tsx`, find the area where `modelLoaded` is derived (around line 1264):

```typescript
const modelLoaded = parts.length > 0;
```

Add below it:

```typescript
const hasMultipleParts = useMemo(
  () => parts.filter((p) => !p.isGroup).length > 1,
  [parts],
);
```

- [ ] **Step 2: Pass `hasMultipleParts` to SegmentAIPanel**

Find where `<SegmentAIPanel>` is rendered (around line 1276). Add the new prop:

```tsx
<SegmentAIPanel
  isEnabled={modelLoaded}
  isSegmenting={isSegmenting}
  progress={segmentProgress}
  error={segmentError}
  results={aiResults}
  onStart={handleStartSegmentation}
  onCancel={handleCancelSegmentation}
  onSmartOrganize={handleSmartOrganize}
  isOrganizing={isOrganizing}
  hasMultipleParts={hasMultipleParts}
/>
```

- [ ] **Step 3: Update SegmentAIPanel props interface**

In `src/components/segment/SegmentAIPanel.tsx`, find the props interface (around line 126). Add the new prop:

```typescript
interface SegmentAIPanelProps {
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

Add `hasMultipleParts` to the destructured props in the component function signature as well.

- [ ] **Step 4: Update Smart Organize button visibility condition**

In `src/components/segment/SegmentAIPanel.tsx`, find line 405:

```typescript
{results.length > 0 && !isSegmenting && onSmartOrganize && (
```

Change to:

```typescript
{(results.length > 0 || hasMultipleParts) && !isSegmenting && onSmartOrganize && (
```

- [ ] **Step 5: Verify**

Run `npm run dev`. Test scenarios:
1. Upload a multi-part GLB (with multiple meshes) to the Segment tab — Smart Organize button should appear without running segmentation
2. Upload a single-mesh model — Smart Organize should NOT appear until segmentation completes
3. Run segmentation on a single-mesh model — Smart Organize should appear after results
4. Click Smart Organize on the multi-part model — should work correctly

- [ ] **Step 6: Commit**

```bash
git add src/app/workspace/segment/page.tsx src/components/segment/SegmentAIPanel.tsx
git commit -m "feat(segment): enable Smart Organize for multi-part meshes without segmentation"
```

---

## Task 9: Unify TransformPanel border colors

**Files:**
- Modify: `src/components/shared/TransformPanel.tsx`

- [ ] **Step 1: Read and audit TransformPanel**

Read `src/components/shared/TransformPanel.tsx` fully. Identify all border/outline classes and compare with the sibling panels (`SegmentHierarchyPanel.tsx`, `ScenePanel.tsx`).

Look for:
- Any hardcoded hex color values in border/outline styles (e.g., `border-white`, `border-[#xxx]`)
- Any `style={{ borderColor: ... }}` inline styles
- Any inconsistency with `border-phidias-border` and `focus:border-accent-purple` tokens

- [ ] **Step 2: Fix any inconsistent border styles**

Replace any hardcoded or inconsistent border values with the standard theme tokens:
- Default border: `border-phidias-border`
- Focus border: `focus:border-accent-purple`
- Section separators: `border-b border-phidias-border`

The specific fixes depend on what the audit reveals. The current code already uses `border-phidias-border` (lines 43, 80, 97) and `focus:border-accent-purple` (line 44). If the user sees a "white" border, there may be an inline style override or a parent container adding a border that we need to trace. Check `ScenePanel.tsx` line 63 where it wraps TransformPanel with `style={{ borderColor: '#1e1e36' }}`.

If the ScenePanel wrapper border looks too light, change:

```typescript
style={{ borderColor: '#1e1e36' }}
```

to use the standard theme token by replacing the inline style with a className:

```typescript
className="border-t border-phidias-border flex-shrink-0"
```

Remove the `style={{ borderColor: '#1e1e36' }}`.

- [ ] **Step 3: Verify**

Run `npm run dev`. Navigate to the Segment tab:
- Load a model, select a part
- Check the Transforms panel border matches the visual style of the hierarchy panel above it
- Compare with other panels in the right sidebar

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/TransformPanel.tsx src/components/shared/ScenePanel.tsx
git commit -m "fix(ui): unify TransformPanel border colors with theme tokens"
```

---

## Task 10: Validate export reflects modifications end-to-end

**Files:**
- Verify: `src/components/shared/ExportDropdown.tsx` (no changes expected, but validate)

This is a verification task after Tasks 5 and 6 are complete.

- [ ] **Step 1: End-to-end test in Segment tab**

Run `npm run dev`. In the Segment tab:

1. Load a model and run segmentation
2. Perform modifications:
   - Rename parts (double-click rename)
   - Merge two parts
   - Create a group
   - Run Smart Organize
3. Export as GLB from the Segment tab
4. Reimport the exported GLB (upload it as a new asset)
5. Check the scene graph panel — verify the exported GLB preserves:
   - User-defined part names (not `merged_*` / `group_*` IDs)
   - Group hierarchy structure
   - All parts present (nothing missing)

- [ ] **Step 2: Test export formats**

Repeat the export with:
- OBJ format — verify parts are present
- USDZ format — verify parts are present

- [ ] **Step 3: Test cross-tab data sync**

1. In the Segment tab, make modifications (rename, group)
2. Switch to the Model tab
3. Check the Scene Graph panel in the right sidebar — it should show the latest names and structure from the segment hierarchy

- [ ] **Step 4: Document any remaining issues**

If any export issues persist, they should be documented and addressed. The `ExportDropdown.tsx` export flow should already work correctly once the Three.js scene has the right names and structure from Tasks 5-6.

---

## Dependency Order

```
Task 1 (normal mode) ─── no deps
Task 2 (selector component) ─── no deps
Task 3 (segment integration) ─── depends on Task 1, 2
Task 4 (model integration) ─── depends on Task 1, 2
Task 5 (rebuildThreeScene fix) ─── no deps
Task 6 (handleRenamePart sync) ─── depends on Task 5
Task 7 (double-click rename) ─── no deps
Task 8 (Smart Organize multi-part) ─── no deps
Task 9 (TransformPanel borders) ─── no deps
Task 10 (E2E validation) ─── depends on Task 5, 6, 7
```

Independent tasks (1+2, 5, 7, 8, 9) can be done in parallel. Task 10 is a final verification after all others complete.
