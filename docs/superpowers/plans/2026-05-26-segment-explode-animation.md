# Segment Tab Exploded View Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Explode toggle (+ magnitude slider) to the Segment tab that radially dilates the model's top-level parts outward from center and converges them back, with smooth animation.

**Architecture:** Pure geometry/easing math lives in a unit-tested module (`src/lib/segment/explode.ts`). The Segment page (`src/app/workspace/segment/page.tsx`) drives the animation imperatively with a `requestAnimationFrame` loop over `sceneRef.current` (mirroring the existing transform code), holding explode UI state in local React state (kept out of the Zundo store so undo history stays clean). The R3F Canvas runs `frameloop="always"`, so mutating object positions each frame renders automatically — no `invalidate()` needed.

**Tech Stack:** TypeScript, React, Three.js, React Three Fiber, Zustand/Zundo, Tailwind, Vitest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-05-26-segment-explode-animation-design.md`

**Deviation from spec:** The spec mentions i18n for new strings. The codebase has **no i18n system** — neighboring toolbar buttons use hardcoded English (`🔗 Merge`, `📁 Group`, `Save`). Per "follow established patterns", this feature uses a hardcoded English label (`💥 Explode`) to match.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/segment/explode.ts` | **New.** Pure functions: `computeRadialVectors`, `explodeOffset`, `easeInOutCubic`. No scene side effects. |
| `src/lib/segment/explode.test.ts` | **New.** Vitest unit tests for the above (node env). |
| `src/app/workspace/segment/page.tsx` | **Modify.** Explode state/refs, rAF loop, baseline capture/restore, toolbar button + slider, gizmo + Save guards while exploded. |
| `e2e/developer/segment-explode.spec.ts` | **New.** Playwright e2e for UI wiring (button present, disabled without model, toggles active + slider visibility). |

---

## Task 1: Pure geometry module (`src/lib/segment/explode.ts`)

**Files:**
- Create: `src/lib/segment/explode.ts`
- Test: `src/lib/segment/explode.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/segment/explode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeRadialVectors, explodeOffset, easeInOutCubic } from './explode';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('computeRadialVectors', () => {
  it('points each part outward from the averaged center', () => {
    const m = computeRadialVectors([
      { key: 'a', centroid: v(1, 0, 0) },
      { key: 'b', centroid: v(-1, 0, 0) },
    ]);
    // center = (0,0,0); radials are the centroids themselves, opposite directions
    expect(m.get('a')!.x).toBeCloseTo(1);
    expect(m.get('b')!.x).toBeCloseTo(-1);
    expect(m.get('a')!.clone().normalize().dot(m.get('b')!.clone().normalize())).toBeCloseTo(-1);
  });

  it('gives a center-coincident part a non-zero fallback direction', () => {
    const m = computeRadialVectors([
      { key: 'a', centroid: v(1, 0, 0) },
      { key: 'b', centroid: v(-1, 0, 0) },
      { key: 'c', centroid: v(0, 0, 0) }, // == center => degenerate
    ]);
    const c = m.get('c')!;
    expect(c.length()).toBeGreaterThan(0); // moved, not stuck
    expect(c.length()).toBeCloseTo(1); // scaled to avg radial magnitude (=1 here)
  });

  it('returns an empty map for no parts', () => {
    expect(computeRadialVectors([]).size).toBe(0);
  });
});

describe('explodeOffset', () => {
  it('is zero when amount is zero', () => {
    expect(explodeOffset(v(2, 0, 0), 0, 1).length()).toBe(0);
  });
  it('is zero when progress is zero', () => {
    expect(explodeOffset(v(2, 0, 0), 1, 0).length()).toBe(0);
  });
  it('scales linearly with amount * progress', () => {
    const o = explodeOffset(v(2, 0, 0), 1, 0.5);
    expect(o.x).toBeCloseTo(1);
  });
  it('does not mutate the input vector', () => {
    const radial = v(2, 0, 0);
    explodeOffset(radial, 1, 1);
    expect(radial.x).toBe(2);
  });
});

describe('easeInOutCubic', () => {
  it('hits the expected anchor points', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0);
    expect(easeInOutCubic(1)).toBeCloseTo(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('clamps out-of-range input', () => {
    expect(easeInOutCubic(-1)).toBeCloseTo(0);
    expect(easeInOutCubic(2)).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/segment/explode.test.ts`
Expected: FAIL — `Failed to resolve import "./explode"` / functions not defined.

- [ ] **Step 3: Implement the module**

Create `src/lib/segment/explode.ts`:

```ts
import * as THREE from 'three';

/** Distance below which a radial vector is treated as degenerate (part at center). */
const EPSILON = 1e-4;
/** Golden angle — deterministic fan-out for parts whose centroid sits at the center. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface PartBounds {
  /** Object name/key as it appears in the scene (meshId or merged_/group_ id). */
  key: string;
  /** World-space centroid of the part (Box3 center). */
  centroid: THREE.Vector3;
}

/**
 * Compute the radial explosion direction+magnitude for each top-level part.
 * radialVec = centroid - modelCenter, where modelCenter is the average of all
 * centroids. Parts coincident with the center get a deterministic index-based
 * fan-out direction scaled to the average radial magnitude so they still separate.
 */
export function computeRadialVectors(parts: PartBounds[]): Map<string, THREE.Vector3> {
  const result = new Map<string, THREE.Vector3>();
  if (parts.length === 0) return result;

  const center = new THREE.Vector3();
  for (const p of parts) center.add(p.centroid);
  center.divideScalar(parts.length);

  let magSum = 0;
  let magCount = 0;
  const raw = parts.map((p) => {
    const vec = p.centroid.clone().sub(center);
    const len = vec.length();
    if (len > EPSILON) {
      magSum += len;
      magCount += 1;
    }
    return { key: p.key, vec, len };
  });
  const avgMag = magCount > 0 ? magSum / magCount : 1;

  raw.forEach((r, i) => {
    if (r.len > EPSILON) {
      result.set(r.key, r.vec);
    } else {
      const a = i * GOLDEN_ANGLE;
      result.set(r.key, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(avgMag));
    }
  });
  return result;
}

/** Final per-part offset = radialVec * amount * progress. Pure; does not mutate input. */
export function explodeOffset(
  radialVec: THREE.Vector3,
  amount: number,
  progress: number,
): THREE.Vector3 {
  return radialVec.clone().multiplyScalar(amount * progress);
}

/** Ease-in-out cubic, input clamped to [0, 1]. */
export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/segment/explode.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/segment/explode.ts src/lib/segment/explode.test.ts
git commit -m "feat(segment): add pure explode geometry module with unit tests"
```

---

## Task 2: Page integration — state, refs, rAF loop, capture/restore

**Files:**
- Modify: `src/app/workspace/segment/page.tsx`

All edits below are in the `SegmentPage` component. The geometry is imported from Task 1.

- [ ] **Step 1: Add the import**

Add near the top imports of `src/app/workspace/segment/page.tsx` (alongside other `@/lib` imports):

```ts
import { computeRadialVectors, explodeOffset, easeInOutCubic } from '@/lib/segment/explode';
```

- [ ] **Step 2: Add explode state and refs**

Insert immediately after the selection-state block (right after the line
`const [transform, setTransform] = useState<TransformValues | null>(null);`, ~line 490):

```tsx
  // ── Exploded view state ───────────────────────────────────────────────────
  // UI state lives here (NOT in useSegmentStore) so it never enters Zundo undo
  // history, which only snapshots `parts`. Animation is driven imperatively
  // over sceneRef via requestAnimationFrame; the R3F Canvas runs frameloop="always".
  const EXPLODE_ANIM_MS = 600;
  const [exploded, setExploded] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState(1); // slider gain, 0..2

  // Refs read inside the rAF loop (avoid stale closures / re-renders).
  const explodedRef = useRef(false);
  const explodeAmountRef = useRef(1);
  const explodeProgressRef = useRef(0); // current eased value, 0..1
  const explodeRafRef = useRef<number | null>(null);
  const transitionStartProgressRef = useRef(0);
  const transitionTargetRef = useRef(0);
  const transitionStartTimeRef = useRef(0);
  // Per-object animation targets, resolved at explode-enable time.
  const explodeTargetsRef = useRef<
    { obj: THREE.Object3D; base: THREE.Vector3; worldVec: THREE.Vector3 }[]
  >([]);

  useEffect(() => {
    explodeAmountRef.current = explodeAmount;
  }, [explodeAmount]);
```

- [ ] **Step 3: Add the resolve/apply/restore/build helpers**

Insert after the `applyTransformSnapshot` definition (after its closing `}, [lastClickedMeshId]);`, ~line 580):

```tsx
  // ── Explode helpers ───────────────────────────────────────────────────────

  /** Resolve top-level parts to their scene Object3D + world centroid, then
   *  compute radial vectors and capture baseline local positions. */
  const buildExplodeTargets = useCallback(() => {
    const root = sceneRef.current;
    if (!root) {
      explodeTargetsRef.current = [];
      return;
    }
    root.updateMatrixWorld(true);

    const byName = new Map<string, THREE.Object3D>();
    root.traverse((o) => {
      if (o.name) byName.set(o.name, o);
    });

    const topParts = useSegmentStore.getState().parts.filter((p) => !p.parentId);
    const resolved: { key: string; obj: THREE.Object3D; centroid: THREE.Vector3 }[] = [];
    for (const part of topParts) {
      // merged_/group_ parts are THREE.Groups named === part.id; single parts are meshes.
      let obj = byName.get(part.id) ?? null;
      if (!obj) {
        const mid = part.meshIds[0];
        obj = mid ? (meshRegistryRef.current.get(mid)?.obj ?? null) : null;
      }
      if (!obj) continue;
      const centroid = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      resolved.push({ key: obj.name || obj.uuid, obj, centroid });
    }

    const radial = computeRadialVectors(resolved.map((r) => ({ key: r.key, centroid: r.centroid })));
    explodeTargetsRef.current = resolved.map((r) => ({
      obj: r.obj,
      base: r.obj.position.clone(),
      worldVec: radial.get(r.key) ?? new THREE.Vector3(),
    }));
  }, []);

  /** Apply offsets for a given eased progress + slider amount. Converts the
   *  world-space radial offset into each object's parent-local frame. */
  const applyExplode = useCallback((progress: number, amount: number) => {
    for (const t of explodeTargetsRef.current) {
      const parent = t.obj.parent;
      if (!parent) continue;
      const worldOffset = explodeOffset(t.worldVec, amount, progress);
      const worldBase = parent.localToWorld(t.base.clone());
      const localTarget = parent.worldToLocal(worldBase.add(worldOffset));
      t.obj.position.copy(localTarget);
      t.obj.updateMatrixWorld(true);
    }
  }, []);

  /** Snap every target back to its captured baseline (exact restore). */
  const restoreExplode = useCallback(() => {
    for (const t of explodeTargetsRef.current) {
      t.obj.position.copy(t.base);
      t.obj.updateMatrixWorld(true);
    }
  }, []);

  /** rAF frame: ease progress toward target; restore + stop when fully converged. */
  const explodeTick = useCallback(() => {
    const now = performance.now();
    const u = Math.min(1, (now - transitionStartTimeRef.current) / EXPLODE_ANIM_MS);
    const eased = easeInOutCubic(u);
    const start = transitionStartProgressRef.current;
    const target = transitionTargetRef.current;
    const progress = start + (target - start) * eased;
    explodeProgressRef.current = progress;

    applyExplode(progress, explodeAmountRef.current);

    if (u >= 1 && target === 0) {
      restoreExplode();
      explodeProgressRef.current = 0;
      explodeRafRef.current = null;
      return; // converged — stop the loop
    }
    explodeRafRef.current = requestAnimationFrame(explodeTick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyExplode, restoreExplode]);
```

- [ ] **Step 4: Add the effects that start/stop the animation**

Insert after the helpers from Step 3:

```tsx
  // Start an explode/converge transition whenever `exploded` flips.
  useEffect(() => {
    explodedRef.current = exploded;
    if (exploded) {
      buildExplodeTargets(); // capture baselines + radial vectors on enable
    }
    transitionStartProgressRef.current = explodeProgressRef.current;
    transitionTargetRef.current = exploded ? 1 : 0;
    transitionStartTimeRef.current = performance.now();
    if (explodeRafRef.current == null) {
      explodeRafRef.current = requestAnimationFrame(explodeTick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded]);

  // Reset explode when the model changes so a new model never starts exploded.
  useEffect(() => {
    setExploded(false);
    explodedRef.current = false;
    explodeProgressRef.current = 0;
    explodeTargetsRef.current = [];
    if (explodeRafRef.current != null) {
      cancelAnimationFrame(explodeRafRef.current);
      explodeRafRef.current = null;
    }
  }, [activeModelUrl]);

  // On unmount, cancel the loop and restore baselines so the saved scene is
  // never left in an exploded state.
  useEffect(() => {
    return () => {
      if (explodeRafRef.current != null) cancelAnimationFrame(explodeRafRef.current);
      restoreExplode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 5: Suppress the transform gizmo while exploded**

Find the `ThreeViewport` prop (~line 1808):

```tsx
            transformMode={isOrganizing ? null : (lastClickedMeshId ? 'translate' : null)}
```

Replace with:

```tsx
            transformMode={(isOrganizing || exploded) ? null : (lastClickedMeshId ? 'translate' : null)}
```

- [ ] **Step 6: Verify it compiles and lints**

Run: `npm run lint`
Expected: no new errors in `src/app/workspace/segment/page.tsx` or `src/lib/segment/explode.ts`.

Run: `npx tsc --noEmit`
Expected: no new type errors. (If `tsc` surfaces pre-existing unrelated errors, confirm none are in the files touched by this task.)

- [ ] **Step 7: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "feat(segment): wire exploded-view rAF animation over scene refs"
```

---

## Task 3: Toolbar UI — Explode button + magnitude slider

**Files:**
- Modify: `src/app/workspace/segment/page.tsx`

- [ ] **Step 1: Add a derived top-level part count**

Insert near the other derived values (after `const selectedPartId = ...`, ~line 496):

```tsx
  const topLevelPartCount = parts.filter((p) => !p.parentId).length;
```

- [ ] **Step 2: Add the Explode button + slider to the bottom toolbar**

In the bottom toolbar, find the end of the Group button (the `</button>` at ~line 1910,
immediately before the `<div className="h-5 w-px bg-[#333355]" />` divider). Insert this
block right after that Group `</button>`:

```tsx
          <div className="h-5 w-px bg-[#333355]" />
          <button
            data-testid="explode-toggle"
            onClick={() => setExploded((v) => !v)}
            disabled={topLevelPartCount === 0}
            title="Exploded view (dilate parts outward / converge back)"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              topLevelPartCount === 0
                ? 'bg-[#252542] text-[#64748b] cursor-not-allowed'
                : exploded
                  ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]'
                  : 'bg-[#252542] text-[#94a3b8] hover:text-white'
            )}
          >
            💥 Explode
          </button>
          {exploded && (
            <input
              data-testid="explode-amount"
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={explodeAmount}
              onChange={(e) => setExplodeAmount(parseFloat(e.target.value))}
              title={`Explosion amount: ${explodeAmount.toFixed(2)}`}
              className="w-24 accent-[#7c3aed] cursor-pointer"
            />
          )}
```

- [ ] **Step 3: Guard Save while exploded**

Prevent persisting exploded positions. Find the Save button (~line 1926) and update its
`disabled` and `className` to include `exploded`:

```tsx
          <button
            onClick={handleSave}
            disabled={isSaving || !activeAssetId || exploded}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
              isSaving || !activeAssetId || exploded
                ? 'bg-[#16a34a]/50 text-[#1a1a2e]/60 cursor-not-allowed'
                : 'bg-[#22c55e] text-[#1a1a2e] hover:bg-[#16a34a]'
            )}
          >
```

(Leave the button's inner content — the spinner / `'Save'` — unchanged.)

- [ ] **Step 4: Verify lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "feat(segment): add Explode toggle + magnitude slider to toolbar"
```

---

## Task 4: E2e wiring test + manual behavioral verification

**Files:**
- Create: `e2e/developer/segment-explode.spec.ts`

Note on scope: Three.js object positions are not in the DOM, so an e2e cannot reliably
assert numeric displacement. Geometry correctness is covered by Task 1's unit tests. This
e2e verifies the UI is wired into the toolbar and respects the no-model guard.

- [ ] **Step 1: Write the e2e test**

Create `e2e/developer/segment-explode.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Segment exploded view', () => {
  test('Explode toggle is present and disabled with no model loaded', async ({ page }) => {
    await page.goto('/workspace/segment');

    const explodeBtn = page.getByTestId('explode-toggle');
    await expect(explodeBtn).toBeVisible({ timeout: 15_000 });

    // With no model loaded there are no top-level parts → button is disabled,
    // and the magnitude slider is not rendered.
    await expect(explodeBtn).toBeDisabled();
    await expect(page.getByTestId('explode-amount')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test --project=developer e2e/developer/segment-explode.spec.ts`
Expected: PASS — button visible and disabled, slider absent.

- [ ] **Step 3: Commit**

```bash
git add e2e/developer/segment-explode.spec.ts
git commit -m "test(segment): e2e for explode toggle wiring"
```

- [ ] **Step 4: Manual behavioral verification (not automated)**

Use the `verify` (or `run`) skill to confirm the animation visually:
1. `npm run dev`, open `/workspace/segment`.
2. Load `assets/spark_rename.glb` (5 named panels — clear exploded view) or `assets/spark.glb`.
3. Click **💥 Explode** → parts dilate outward from center and hold. Button highlights; slider appears.
4. Drag the slider → explosion magnitude changes live (0 = together, 2 = far apart).
5. Click **💥 Explode** again → parts smoothly converge back to exactly their original positions.
6. Confirm: Save is disabled while exploded; the transform gizmo does not appear while exploded.
7. Switch to another tab and back → model is not left exploded.

---

## Task 5: Production build check

**Files:** none (verification only).

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build succeeds (recent commits fixed Next 14 production-build issues; this change
must not regress them).

- [ ] **Step 2: Run the full unit suite once**

Run: `npm test`
Expected: PASS, including the new `src/lib/segment/explode.test.ts`.

---

## Self-Review Notes

- **Spec coverage:** Toggle behavior (Tasks 2/3), radial-from-center (Task 1 `computeRadialVectors`), top-level Part unit (Task 2 `buildExplodeTargets` filters `!p.parentId`), bottom-toolbar button (Task 3), live magnitude slider (Tasks 2/3), ease-in-out (~600ms) animation (Task 2 `explodeTick`), exact restore (Task 2 `restoreExplode`), edge cases — no model (Task 3 disabled guard), center-coincident fallback (Task 1), mid-converge slider (formula in Task 1/2), gizmo suppression + unmount/model-change restore + Save guard (Tasks 2/3). i18n requirement intentionally not implemented — see Deviation note (no i18n system exists).
- **Type consistency:** `PartBounds`, `computeRadialVectors`, `explodeOffset`, `easeInOutCubic` used identically across Tasks 1–2; `explodeTargetsRef` element shape `{ obj, base, worldVec }` consistent across build/apply/restore.
- **No placeholders:** all steps contain runnable code/commands.
