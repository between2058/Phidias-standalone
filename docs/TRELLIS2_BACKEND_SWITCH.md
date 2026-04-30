# Model Tab Backend Switch Runbook

> **Audience**: Future Claude Code / engineer who needs to decide the Model-tab generation backend.
>
> **Status**: Scenario A landed (2026-04-17). Both backends selectable via per-panel Fast/Quality switcher. Default: **Quality (TRELLIS.2)**. `FEATURES.TRELLIS2_BACKEND` retained as admin kill-switch. See `docs/superpowers/specs/2026-04-17-model-tab-dual-backend-switch-design.md`.

---

## 0. TL;DR

Model tab's 3D generation currently has two potential backends:

- **ReconViaGen** (ACTIVE) — polling-based job submission via `useJobManager` + `phidias-store.jobs`.
- **TRELLIS.2** (PREPARED, HIDDEN) — direct-result sync call, no polling.

Both have working client functions, proxy routes, and dispatch scaffolds. Switching is controlled by a single flag in `src/config/features.ts`:

```typescript
export const FEATURES = {
  TRELLIS2_BACKEND: false,   // ← flip this
} as const;
```

Three product decisions are supported. Each has a specific runbook below.

---

## 1. Current state (baseline before any decision)

### Flag

```typescript
// src/config/features.ts
FEATURES.TRELLIS2_BACKEND = false
```

### Behavior

- **ModelGeneratePanel**: Pipeline selector block hidden (wrapped in `{FEATURES.TRELLIS2_BACKEND && (...)}`). Other Output Settings (Seed, Texture Size, SS / SLAT sliders) remain visible because ReconViaGen consumes the same params.
- **handleGenerate** (in `src/app/workspace/model/page.tsx`): image-mode branch contains an `if (FEATURES.TRELLIS2_BACKEND) { ... return; }` scaffold that is dead code while flag is false. Control falls through to ReconViaGen polling path.
- **Other input modes** (multiview / text / batch): ReconViaGen only. TRELLIS.2 dispatch scaffold was NOT written for these modes to keep scope tight (extend when needed — see Scenario A).

### Files involved in the switch

| File | Role |
|---|---|
| `src/config/features.ts` | Single-source flag definition. |
| `src/lib/api/phidias.ts` | Contains BOTH `generateReconSingle/Multi/Batch` (active) AND `generateTrellis` (dead code until flipped). `generateTrellis` lives in the `// ── Legacy async API (Texture / Physics tabs) ──` section. |
| `src/components/model/ModelGeneratePanel.tsx` | Pipeline selector JSX gated by `FEATURES.TRELLIS2_BACKEND`. `pipelineType` state still runs regardless (harmless). |
| `src/app/workspace/model/page.tsx` | `handleGenerate` has image-mode dispatch scaffold. |
| `src/app/api/phidias/trellis2/[...path]/route.ts` | TRELLIS.2 proxy (ported in Phase 1; supports `/generate` endpoint). |
| `src/app/api/phidias/reconviagen/[...path]/route.ts` | ReconViaGen proxy. |
| `.env.example` | Has both `TRELLIS2_API_URL=` and `RECONVIAGEN_API_URL=`. |

### Cross-cutting ReconViaGen references (important for Scenario B cleanup)

ReconViaGen is NOT only used by Model tab. Other places that touch it:

| File | Why |
|---|---|
| `src/components/shared/NavActions.tsx` | Renders ReconViaGen job cards in the top-right bell area. |
| `src/hooks/useJobManager.ts` | Polls ReconViaGen jobs (also polls Qwen + P3-SAM — can't delete whole hook). |
| `src/hooks/useJobDownload.ts` | Downloads ReconViaGen result GLB on "View 3D". |
| `src/store/phidias-store.ts` | `jobs[].service === 'reconviagen'` path + `incrementConnection('reconviagen')`. |
| `src/app/workspace/segment/page.tsx` | Imports `reconviagen`-related types (not gen — just types). |
| `src/app/api/phidias/_types.ts` | Enumerates `'reconviagen'` as a service string. |
| `src/__tests__/api/phidias/reconviagen.test.ts` | API proxy unit test. |

**Rule**: Scenario B (drop ReconViaGen) requires surgical edits to these files, not bulk delete. The `useJobManager` / `useJobDownload` / `phidias-store` handle multiple services; only the ReconViaGen branch should be removed.

---

## 2. Scenario A — Keep both backends

**Goal**: User can pick ReconViaGen or TRELLIS.2 at generation time (A/B comparison, resource fallback, etc.).

**Estimated effort**: 30-60 min.

### Steps

#### 2A.1 — Flip the flag

```typescript
// src/config/features.ts
FEATURES.TRELLIS2_BACKEND: true
```

#### 2A.2 — Verify Pipeline selector appears

Visit `/workspace/model`. The "Pipeline" button group (512 / 1024 / 1024_cascade / 1536_cascade) should now be visible under Output Settings.

#### 2A.3 — Add a backend toggle to ModelGeneratePanel

The current single flag routes ALL single-image gen to TRELLIS.2 when true. For a dual-backend UX, add a state:

```typescript
// In ModelGeneratePanel.tsx top of component:
const [backend, setBackend] = useState<'reconviagen' | 'trellis2'>('reconviagen');
```

Add a selector in the UI (position example: above input-mode pills):

```tsx
<div className="flex gap-1 mb-2">
  <button
    onClick={() => setBackend('reconviagen')}
    className={cn(
      'flex-1 py-1.5 rounded-lg text-xs',
      backend === 'reconviagen' ? 'bg-[#0E243E] border border-[#D5B451] text-white' : 'bg-[#252542] text-[#94a3b8]',
    )}
  >
    ReconViaGen
  </button>
  <button
    onClick={() => setBackend('trellis2')}
    className={cn(
      'flex-1 py-1.5 rounded-lg text-xs',
      backend === 'trellis2' ? 'bg-[#0E243E] border border-[#D5B451] text-white' : 'bg-[#252542] text-[#94a3b8]',
    )}
  >
    TRELLIS.2
  </button>
</div>
```

Include `backend` in the `common` object literal (around line 277) so it propagates:

```typescript
const common = {
  resolution,
  pipelineType,
  backend,  // ← add
  // ...
};
```

Also gate the Pipeline Type block on `backend === 'trellis2'` inside the panel instead of `FEATURES.TRELLIS2_BACKEND` (since flag is now always true at this point; user's pick controls visibility):

```tsx
{backend === 'trellis2' && (
  /* Pipeline Type block */
)}
```

#### 2A.4 — Wire the toggle through to page.tsx

Add `backend?: 'reconviagen' | 'trellis2'` to `GenerateModelRequest` in `src/lib/api/types.ts`.

In `handleGenerate`, change the scaffold condition from `FEATURES.TRELLIS2_BACKEND` to `params.backend === 'trellis2'`:

```typescript
if (params.backend === 'trellis2' && params.inputMode === 'image') {
  // existing TRELLIS.2 scaffold body
}
```

#### 2A.5 — Extend to other modes (optional but recommended)

The current scaffold only handles `inputMode === 'image'`. For a complete dual-backend experience, extend the `if (params.backend === 'trellis2')` block to handle `multiview` / `text` / `batch`. Reference old repo (`/Users/between2058/Documents/code/phidias-standalone/src/app/workspace/model/page.tsx` lines 232-330) for the multiview/batch TRELLIS.2 flow.

If you decide these modes stay ReconViaGen-only for now, add a guard that forces `backend = 'reconviagen'` when user picks non-image mode.

#### 2A.6 — Verify

1. `pnpm build` green
2. `/workspace/model` shows backend toggle
3. Toggle to ReconViaGen → single-image gen submits job (NavActions shows job card)
4. Toggle to TRELLIS.2 → single-image gen downloads GLB inline (no job card, asset appears with `pipelineUsed: 'trellis'`)

---

## 3. Scenario B — Switch to TRELLIS.2 only (drop ReconViaGen)

**Goal**: Product decided TRELLIS.2 is the sole Model-tab backend. Remove ReconViaGen dispatch from Model tab and its associated infra where safe.

**Estimated effort**: 60-120 min (be careful — ReconViaGen refs are spread across polling infra).

### Steps

#### 3B.1 — Flip the flag

```typescript
FEATURES.TRELLIS2_BACKEND: true
```

#### 3B.2 — Remove ReconViaGen dispatch from handleGenerate

In `src/app/workspace/model/page.tsx`, `handleGenerate`:
- Delete the `const result: JobSubmitResponse = await generateReconSingle(...)` block (image mode, after the scaffold).
- Delete the `multiview` and `batch` mode ReconViaGen blocks.
- The TRELLIS.2 scaffold becomes the main path. Remove the `if (FEATURES.TRELLIS2_BACKEND)` wrap (unconditional now); you can delete the flag entirely if this is the final state.

You will need to port multiview/text/batch TRELLIS.2 flows (see old repo model/page.tsx lines 232-330).

#### 3B.3 — Remove the flag gate in ModelGeneratePanel

Remove `{FEATURES.TRELLIS2_BACKEND && (...)}` wrap around Pipeline Type block. Pipeline always shows.

#### 3B.4 — Cross-cutting cleanup (careful — do NOT delete shared code)

In the following files, remove ONLY the `reconviagen` branch. The files themselves stay because other services (qwen, p3sam) use them:

- `src/hooks/useJobManager.ts` — delete `case 'reconviagen':` in the poll-endpoint switch
- `src/hooks/useJobDownload.ts` — delete reconviagen download branch
- `src/store/phidias-store.ts` — if there's a `reconviagen`-specific connection slot handling, simplify. Keep the generic job store.
- `src/components/shared/NavActions.tsx` — remove reconviagen-specific job card rendering (large file; use grep to find sites)
- `src/app/api/phidias/_types.ts` — remove `'reconviagen'` from service enum
- `src/app/api/phidias/reconviagen/` — delete entire proxy folder
- `src/lib/api/phidias.ts` — delete `generateReconSingle`, `generateReconMulti`, `generateReconBatch`
- `.env.example` — delete `RECONVIAGEN_API_URL=`
- `src/__tests__/api/phidias/reconviagen.test.ts` — delete test file

#### 3B.5 — Run the grep safety net

```bash
grep -rn "reconviagen\|ReconViaGen\|generateRecon" src --include="*.ts" --include="*.tsx"
```

Should return only remaining harmless references (types or comments). If anything active remains, address it.

#### 3B.6 — Verify

1. `pnpm build` green
2. `/workspace/model` single-image gen works end-to-end against TRELLIS.2 backend
3. NavActions bell no longer shows reconviagen job cards (but still shows qwen/p3sam jobs correctly)
4. Other tabs (Segment etc.) unaffected

---

## 4. Scenario C — Drop TRELLIS.2 prep (keep ReconViaGen only)

**Goal**: Product decided TRELLIS.2 is not going forward. Remove the prep work cleanly.

**Estimated effort**: 15-30 min. Smallest scope — just undo the prep.

### Steps

#### 4C.1 — Delete the feature flag file

```bash
rm src/config/features.ts
```

#### 4C.2 — Remove flag gate in ModelGeneratePanel

Unwrap and delete the Pipeline Type `{FEATURES.TRELLIS2_BACKEND && (...)}` block entirely (the Pipeline selector leaves the UI).

Also delete the `pipelineType` state + `PIPELINE_OPTIONS` constant that are no longer referenced:

```bash
grep -n "pipelineType\|PIPELINE_OPTIONS" src/components/model/ModelGeneratePanel.tsx
```

#### 4C.3 — Remove TRELLIS.2 dispatch scaffold in page.tsx

Delete the entire `if (FEATURES.TRELLIS2_BACKEND) { ... return; }` block in `handleGenerate` image-mode branch.

Also remove `generateTrellis` from the `@/lib/api/phidias` import block + remove `FEATURES` import + remove `addAsset` / `setActiveAssetId` from useWorkspace destructure if not used elsewhere in the file (grep to confirm).

#### 4C.4 — Delete generateTrellis function

In `src/lib/api/phidias.ts`, delete the `export async function generateTrellis(...)` block (50 lines). It was added in commit `2d7c272`.

You can leave `textureTrellis` (Texture tab uses it) and the `trellis2` proxy route alone — they're still needed by Texture tab.

#### 4C.5 — Delete this document

```bash
rm docs/TRELLIS2_BACKEND_SWITCH.md
```

Or keep it as history. If kept, update the status line at top to note "TRELLIS.2 path removed in commit X per product decision".

#### 4C.6 — Verify

1. `grep -rn "TRELLIS2_BACKEND\|generateTrellis\|FEATURES\." src` — should return zero matches (or only Texture's `textureTrellis` which is a different symbol).
2. `pnpm build` green.
3. `/workspace/model` single-image gen works (ReconViaGen path unchanged).

---

## 5. Decision matrix quick reference

| I want... | Do scenario | Effort | Cost of being wrong |
|---|---|---|---|
| User-facing toggle between backends | A | Medium | If traffic shifts to one, dead UI remains |
| TRELLIS.2 is the future | B | High | Hard to revert — remove then re-add |
| ReconViaGen wins, delete prep | C | Low | Easy to re-add from git history |
| Do nothing yet (observe) | — (stay on baseline) | None | Dead code accumulates, UI noise on Pipeline flag inspection |

---

## 6. Historical context

- **Phase 1 (2026-04-15)** — ported `textureTrellis` + `/phidias/trellis2/*` proxy from old repo for Texture tab.
- **Phase 2 (2026-04-15)** — not TRELLIS.2-related; Physics tab port.
- **Phase 3 (2026-04-15)** — ported `ModelGeneratePanel.tsx` verbatim from old repo. This brought in the Pipeline Type UI + `pipelineType` state that has no effect on the active ReconViaGen backend. Inherited the dead UI that later triggered user's "前端 output settings 多了 pipeline" observation.
- **Phase 4 TRELLIS.2 switch prep (2026-04-16, commit `2d7c272`)** — this runbook's implementation: flag system, generateTrellis port, UI gate, dispatch scaffold.

## 7. Relevant commits

Use `git log --oneline --all --grep='trellis'` to find prep history. Key commits as of runbook authoring:

- `2d7c272 feat(phase4): prep TRELLIS.2 backend switch for Model tab (hidden by flag)` — this prep
- Phase 1 commit that added trellis2 proxy + `textureTrellis` (see `docs/superpowers/specs/2026-04-15-phidias-migration-phase1-texture-design.md`)
