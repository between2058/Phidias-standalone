# Segment Tab — Exploded View Animation — Design

**Date:** 2026-05-26
**Status:** Draft, pending user review
**Owner:** between2058

## Overview

Add an **Exploded View** toggle to the Segment tab (`/workspace/segment`). Clicking it
smoothly dilates the model's parts outward from the model center (radial explosion) and
holds them apart; clicking again smoothly converges them back to their original positions.
A slider next to the button controls the explosion magnitude in real time.

The feature mirrors how the Segment tab already manipulates the scene: imperatively, through
`sceneRef.current`, alongside the existing transform/undo logic — no changes to the shared
`ThreeViewport` component.

## Goals

- New **Explode** toggle button in the Segment tab bottom toolbar (glassmorphism style,
  consistent with Merge / Group / Save).
- Toggle behavior: click to explode-and-hold; click again to converge-and-restore.
- Radial explosion outward from the model center; displacement scales with each part's
  distance from center.
- A magnitude slider (shown only while exploded) adjusts the explosion amount live.
- Movement unit = **top-level Part** (groups/merged parts move as one rigid unit; ungrouped
  single meshes move individually).
- Smooth ease-in-out animation (~0.5–0.7s) for both explode and converge.
- Exact restoration of original transforms when convergence completes.
- i18n for all new UI strings (no hardcoded text).

## Non-Goals

- One-shot pulse or continuous breathing/oscillation modes (toggle only).
- Per-part manual override of explosion direction/distance.
- Persisting the exploded state to the backend or to the saved model.
- Explosion along a single chosen axis (radial only for this iteration).
- Editing transforms (gizmo) while in exploded state — explicitly out of scope; see
  Edge Cases.

## Confirmed Decisions

| Decision | Value | Source |
|---|---|---|
| Motion mode | Toggle exploded view (explode-and-hold; click again to converge) | Q1 → A |
| Explosion direction | Radial outward from model center | Q2 → A |
| Movement unit | Top-level Part (groups as one rigid unit) | Q3 → recommended, user deferred |
| Button placement | Segment tab bottom toolbar | Q4 → A |
| Magnitude control | Slider (live adjust), shown while exploded | Q5 → B |
| Implementation strategy | Imperative rAF loop in `segment/page.tsx` via `sceneRef` | Approach A (approved) |
| Displacement formula | `offset = radialVec × explodeAmount × explodeProgress` | Approved |

## Architecture

### Where the logic lives

All explode logic lives in `src/app/workspace/segment/page.tsx`, co-located with the existing
imperative scene code (`captureTransformSnapshot` / `applyTransformSnapshot`, which already
traverse `sceneRef.current`). State is held in React `useState` **in the page** — deliberately
NOT in `useSegmentStore`, because that store's Zundo `partialize` only snapshots `parts[]`;
keeping explode state out of it avoids polluting undo/redo history.

The pure geometry math is extracted into a standalone, testable module:
`src/lib/segment/explode.ts`.

### Data flow

```
[Explode button click]  ──► setExploded(prev => !prev)
[Slider change]         ──► setExplodeAmount(value)

useEffect([exploded]) ──► on enable: capture baselines, start rAF loop
                          on disable: animate progress→0, restore, stop loop

rAF loop (per frame):
  ease explodeProgress toward target (1 if exploded else 0)
  for each top-level part object:
     object.position = base + localOffset(part, explodeProgress, explodeAmount)
     object.updateMatrixWorld(true)
  if progress settled at 0 and not exploded: restore exact baselines, cancel rAF
```

R3F must render each frame while animating. We rely on the Canvas running
`frameloop="always"` (verify in `ThreeViewport`); if it is `"demand"`, the loop calls the
exposed `invalidate()` each frame. This is a verification step during implementation.

### State (React `useState` in `segment/page.tsx`)

| State | Type | Purpose |
|---|---|---|
| `exploded` | `boolean` | Toggle target (true = explode, false = converge) |
| `explodeAmount` | `number` | Slider gain, range `0`–`2`, default `1` |

Refs (not state, to avoid re-renders inside the loop):

| Ref | Type | Purpose |
|---|---|---|
| `explodeProgressRef` | `number` | Eased 0↔1 animation value |
| `explodeBaselinesRef` | `Map<string, THREE.Vector3>` | Captured original local positions, keyed by object name |
| `explodeVectorsRef` | `Map<string, THREE.Vector3>` | Per-object radial offset direction in parent-local space |
| `explodeRafRef` | `number \| null` | requestAnimationFrame handle |

## The Geometry Module — `src/lib/segment/explode.ts`

Pure functions, no Three.js scene side effects, fully unit-testable.

```ts
export interface PartBounds {
  /** Object name / key as it appears in the scene (meshId or merged_/group_ id). */
  key: string;
  /** World-space centroid of the part (Box3 center). */
  centroid: THREE.Vector3;
}

/**
 * Compute the radial explosion direction vector for each top-level part.
 * radialVec = centroid - modelCenter.
 * modelCenter = average of all part centroids (matches the visual center of the spread).
 * Parts whose centroid coincides with the center (|radialVec| ~ 0) get a deterministic
 * fan-out fallback direction based on their index, so they still move.
 */
export function computeRadialVectors(parts: PartBounds[]): Map<string, THREE.Vector3>;

/**
 * Final per-part offset = radialVec * amount * progress.
 * amount = slider gain, progress = 0..1 animation value.
 */
export function explodeOffset(
  radialVec: THREE.Vector3,
  amount: number,
  progress: number,
): THREE.Vector3;

/** Ease-in-out cubic for the progress ramp. */
export function easeInOutCubic(t: number): number;
```

The page layer is responsible for the Three.js glue: resolving each top-level Part to its
scene Object3D, measuring `Box3` centroids, converting the world-space `radialVec` into the
object's parent-local frame (via `parent.worldToLocal`) before applying it to
`object.position`, and capturing/restoring baselines.

### Resolving a top-level Part to its Object3D

- Top-level parts = parts in the store with no `parentId`.
- For `isGroup` / merged parts: scene object is the `THREE.Group` whose `name === part.id`
  (`group_*` / `merged_*`), per the naming used by `rebuildThreeScene`.
- For single-mesh parts: scene object is the mesh whose `name === part.meshIds[0]`.
- Resolution: look up by `name === part.id` first; fall back to `name === part.meshIds[0]`.
  Parts that resolve to no object are skipped.

## UI

In the bottom toolbar of `segment/page.tsx`, after the Save group:

- **Explode toggle button** — matches existing toolbar button conventions
  (`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors`).
  Inactive: `bg-[#252542] text-[#94a3b8]`. Active (exploded): highlighted, e.g.
  `bg-[#7c3aed] text-white`. Icon: a lucide "expand / scatter" icon
  (candidate: `Maximize2` or `Move3d` / `Boxes`; final choice during implementation).
- **Magnitude slider** — rendered only while `exploded` is true, immediately to the right of
  the button (with the existing `h-5 w-px bg-[#333355]` divider). Range 0–2, step 0.05,
  bound to `explodeAmount`. Styled to match the dark theme.
- All labels/tooltips via the i18n layer (no hardcoded strings).

## Edge Cases

- **Empty / no model loaded:** button disabled when there are no top-level parts.
- **Part centroid at model center:** deterministic index-based fan-out direction so it
  still separates.
- **Slider changed mid-converge:** offset is `radialVec × amount × progress`, so a live
  amount change scales smoothly and is damped to zero by `progress` as it converges.
- **Manual transform while exploded:** out of scope. To prevent corrupting baselines, the
  transform gizmo is suppressed while exploded (set `transformMode={null}`), and convergence
  restores the captured baselines.
- **Unmount / tab switch while exploded:** cleanup effect cancels the rAF and restores
  baselines so the saved scene is never left in an exploded state.
- **Model reload while exploded:** reset `exploded=false` and clear baselines on model change.

## Testing

### Unit tests — `src/lib/segment/explode.test.ts`
- `computeRadialVectors`: directions point outward from the averaged center; a 2-part
  symmetric setup yields opposite vectors.
- Center-coincident part gets a non-zero fallback vector.
- `explodeOffset`: `amount=0` → zero; `progress=0` → zero; linear in both `amount`
  and `progress`.
- `easeInOutCubic`: endpoints `0→0`, `1→1`, midpoint `0.5→0.5`, monotonic.

### Playwright (project convention: sidecar auto-start)
- Load `spark.glb` in the Segment tab.
- Click Explode → assert a sampled part object's world position moved outward vs. baseline.
- Move the slider up → assert displacement increased; slider to 0 → parts return to center.
- Click Explode again → assert all parts restored to baseline (within epsilon).
- Switch tabs while exploded → assert no exploded transforms persist on return.

## File Touch List

| File | Change |
|---|---|
| `src/lib/segment/explode.ts` | New — pure geometry/easing module |
| `src/lib/segment/explode.test.ts` | New — unit tests |
| `src/app/workspace/segment/page.tsx` | Add `exploded`/`explodeAmount` state + refs, rAF loop, baseline capture/restore, toolbar button + slider, gizmo suppression while exploded |
| i18n locale files | Add strings for the button label / tooltip |
| `tests/` (Playwright) | New e2e covering explode/converge/slider/restore |

## Open Questions

None blocking. Final lucide icon choice and exact slider max (2 vs higher) to be settled
during implementation; both are trivially adjustable.
