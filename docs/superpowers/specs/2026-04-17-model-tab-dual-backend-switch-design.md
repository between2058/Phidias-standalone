# Model Tab — Dual Backend Switch (Fast / Quality)

> **Branch**: `computex-demo`
> **Date**: 2026-04-17
> **Scope**: `ModelGeneratePanel` + `src/app/workspace/model/page.tsx` + `src/lib/api/phidias.ts` + `src/lib/api/types.ts`
> **Runbook reference**: `docs/TRELLIS2_BACKEND_SWITCH.md` Scenario A

## 1. Goal

Allow the user to pick between two 3D-generation backends in Model tab, one per request, with each backend's unique parameters surfaced only when that backend is active.

Labels shown to the user:
- **Fast** → ReconViaGen (existing async / polling flow)
- **Quality** → TRELLIS.2 (existing sync / direct-result flow)

Backend state lives inside `ModelGeneratePanel` (one selection per panel, carried across input-mode switches). Default on first visit is **Quality (TRELLIS.2)**. No cross-session persistence.

## 2. Non-goals

- No TRELLIS.2 batch mode. TRELLIS.2 has no batch endpoint — batch stays ReconViaGen-only, and the switcher is hidden while `inputMode === 'batch'`.
- No change to existing async ReconViaGen infrastructure (polling, bell notifications, `JobStore`, `NavActions`). ReconViaGen flows through Model tab continue to work unchanged.
- No cross-session persistence of the backend choice. User returns to default on reload.
- No UI labels in bell cards / asset `pipelineUsed` display — those stay as technical names (`reconviagen`, `trellis`) for log/debug legibility. "Fast" / "Quality" strings only appear in the switcher.

## 3. UI design

### 3.1 Switcher placement

The switcher sits **between the panel header and the input-mode tabs**, as a full-width 2-button pill group:

```
┌──────────────────────────────────────────┐
│ Panel title                              │   ← existing header
│ Panel description                        │
├──────────────────────────────────────────┤
│  [ Fast ]  [ Quality ]                   │   ← NEW: backend switcher
│  micro-copy line                         │   ← NEW: one-line hint
├──────────────────────────────────────────┤
│  📷 Image  🔲 Multi-view  ✏️ Text  📦 Batch │   ← existing mode tabs
├──────────────────────────────────────────┤
│ ...mode-specific content...              │
│ ...Output Settings...                    │
└──────────────────────────────────────────┘
```

Visual style: reuse the existing selected-pill style (background `#0E243E`, border `1px solid #D5B451`, white text) for the active choice, and `#252542` bg with `#94a3b8` text for the inactive choice.

Micro-copy under the switcher (one short line, `text-[10px] text-[#64748b]`):
- When **Fast** is active: `"Async — results appear in notifications"`
- When **Quality** is active: `"Sync — wait here for the result"`

### 3.2 Visibility rules

The switcher + micro-copy are rendered only when **both** are true:

1. `FEATURES.TRELLIS2_BACKEND === true` — acts as a kill-switch. When `false`, the switcher disappears entirely and every flow forces ReconViaGen (current behavior).
2. `inputMode !== 'batch'` — batch mode has no TRELLIS.2 equivalent, so the switcher is hidden. The internal `backend` state is **not** modified on entering batch; it is simply ignored. Exiting batch restores whichever backend the user last picked.

### 3.3 Conditional parameter fields

Output Settings and mode-specific sections vary by backend:

| Field | Fast (ReconViaGen) | Quality (TRELLIS.2) |
|---|---|---|
| Pipeline (512 / 1024 / 1024_cascade / 1536_cascade) | Hidden | Shown |
| Seed (number + randomize toggle) | Shown | Shown |
| Texture Size (512 / 1024 / 2048) | Shown | Shown |
| Decimation | `Simplify Ratio` slider (0.0–1.0, step 0.01, default 0.95) | `Max Faces` slider (50K–2M, step 50K, default 1M) |
| Remesh toggle | Hidden | Shown |
| Advanced: SS / SLAT stage sliders | Shown | Shown |
| Multi-view only: Diffusion Mode (stochastic / multidiffusion) | Shown | Hidden |

Text-mode Qwen fields (prompt, negative, CFG, steps, Qwen seed) are backend-independent and render identically for both.

### 3.4 Backend-state behavior across input modes

One `backend` state per panel instance. Switching input-mode tabs does **not** reset it. Example session:
1. Open Model tab → `backend = 'trellis2'` (default), `inputMode = 'image'`.
2. Switch to Multi-view → `backend` still `'trellis2'`, Multi-view panel shows Quality params (no Diffusion Mode selector).
3. Switch to Batch → switcher hidden; Generate dispatches via ReconViaGen regardless of `backend` value.
4. Switch back to Image → switcher shows `'trellis2'` active again.

## 4. State additions

### 4.1 `ModelGeneratePanel.tsx`

New local state:
```typescript
const [backend, setBackend] = useState<'reconviagen' | 'trellis2'>('trellis2');
const [simplifyRatio, setSimplifyRatio] = useState(0.95);
```
- Existing `decimationTarget` state (Max Faces) is kept and used only when `backend === 'trellis2'`.
- `simplifyRatio` is newly introduced and used only when `backend === 'reconviagen'`.

The existing `pipelineType`, `remesh` and `multiViewMode` states are kept as-is. Their UIs become conditional on `backend`.

### 4.2 `GenerateModelRequest` (`src/lib/api/types.ts`)

New required field:
```typescript
backend: 'reconviagen' | 'trellis2';
```

New optional field:
```typescript
simplify?: number;  // 0-1 ratio, only meaningful when backend === 'reconviagen'
```

`decimationTarget`, `pipelineType`, `remesh`, `multiViewMode` are already present and stay.

`handleGenerate` in `ModelGeneratePanel` passes `backend` and both decimation forms into the `common` object; the dispatcher in `page.tsx` picks which form to send upstream.

## 5. Dispatch in `src/app/workspace/model/page.tsx`

Branch `handleGenerate` on `(inputMode, params.backend)`.

| inputMode × backend | Fast (ReconViaGen) | Quality (TRELLIS.2) |
|---|---|---|
| image | `generateReconSingle(file, {...ratioParams})` → `addJob` → polling → bell card → user clicks "View 3D" later | `generateTrellis(file, {...absoluteParams})` → await response → download GLB → `addAsset` → `setActiveAssetId` inline |
| multiview | `generateReconMulti(files, {...ratioParams, multiimage_algo})` → polling | **NEW** `generateTrellisMulti(files, {...absoluteParams})` → await → inline asset ingest |
| text | Submit Qwen text2img job → effect listener picks up completion → downloads image → calls `generateReconSingle` | Same submit-Qwen path, but the effect listener dispatches `generateTrellis` instead (inline sync result) |
| batch | `generateReconBatch(files, {...ratioParams})` → polling | Unreachable (switcher hidden when `inputMode === 'batch'`) |

### 5.1 Quality (TRELLIS.2) inline flow

```
setIsGenerating(true)
try {
  result = await generateTrellis(file, {
    seed,
    pipeline_type: pipelineType,
    texture_size: textureSize,
    decimation_target: decimationTarget,
    remesh,
    ss_guidance_strength: ss.guidance_strength,
    ss_sampling_steps: ss.sampling_steps,
    slat_guidance_strength: shapSlat.guidance_strength,
    slat_sampling_steps: shapSlat.sampling_steps,
  });
  // result.glb_url is a relative path: /download/{request_id}/{filename}
  downloadUrl = buildTrellis2DownloadUrl(result);
  blob = await fetch(downloadUrl).then(r => r.blob());
  blobUrl = URL.createObjectURL(blob);
  assetId = addAsset({
    name: derivedName,
    modelUrl: blobUrl,
    type: 'textured',
    status: 'ready',
    pipelineUsed: 'trellis',
    fileSize: blob.size,
  });
  setActiveAssetId(assetId);
} catch (err) {
  // surface via existing error-handling path (toast / setError — see current handleGenerate)
} finally {
  setIsGenerating(false);
}
```

No job is pushed into `phidias-store.jobs`. No bell card appears. The progress spinner inside `ModelGeneratePanel` is the only feedback surface.

### 5.2 Fast (ReconViaGen) flow — unchanged

Stays as today. The existing ReconViaGen branch in `handleGenerate` is kept verbatim for image/multiview/batch. Only the condition that guards it changes from "always" (current baseline) to `backend === 'reconviagen'`.

### 5.3 Text mode — backend-aware auto-dispatch

Text mode cannot recurse inline because Qwen is itself an async job. Current flow (in `page.tsx`):
1. `handleGenerate` submits the Qwen text2img job (via existing Qwen path).
2. A `useEffect` watches `jobs[]`, picks up completed Qwen `text2img` jobs it hasn't seen yet, downloads the image, and calls `generateReconSingle` with hardcoded defaults (`seed: 0`, `texture_size: 2048`).

Changes to make the auto-dispatch backend-aware:

1. When `handleGenerate` submits the Qwen job, attach **the full 3D-gen param snapshot** to `addJob({ metadata })`:
   ```typescript
   metadata: {
     prompt,
     backend: params.backend,
     // 3D-gen params captured at submit time so user can't race their own switch:
     pipelineType: params.pipelineType,
     seed: params.seed,
     randomizeSeed: params.randomizeSeed,
     textureSize: params.textureSize,
     decimationTarget: params.decimationTarget,
     simplify: params.simplify,
     remesh: params.remesh,
     ss: params.ss,
     shapSlat: params.shapSlat,
   }
   ```
2. The auto-dispatch effect reads `job.metadata.backend` and branches:
   - `'reconviagen'` → `generateReconSingle(file, { seed, simplify, texture_size, ss_*, slat_* })` → existing `addJob` polling path.
   - `'trellis2'` → `generateTrellis(file, { seed, pipeline_type, texture_size, decimation_target, remesh, ss_*, slat_* })` → inline asset ingest (same as the image-mode Quality branch in §5.1).
3. Replace the hardcoded `seed: 0, texture_size: 2048` with values from metadata so the user-selected params actually apply.

This preserves the submission-time choice if the user flips the switcher while Qwen is running.

### 5.4 Param mapping

For `simplify`/`decimation_target`: **send only the one that matches the backend**. Do not attempt cross-conversion. ReconViaGen receives `simplify` (0–1). TRELLIS.2 receives `decimation_target` (absolute count).

## 6. API client additions (`src/lib/api/phidias.ts`)

Add `generateTrellisMulti` mirroring `generateTrellis`:

```typescript
export async function generateTrellisMulti(
  files: File[] | Blob[],
  params: {
    seed?: number;
    pipeline_type?: '512' | '1024' | '1024_cascade' | '1536_cascade';
    texture_size?: number;
    decimation_target?: number;
    remesh?: boolean;
    ss_guidance_strength?: number;
    ss_sampling_steps?: number;
    slat_guidance_strength?: number;
    slat_sampling_steps?: number;
  } = {},
): Promise<ReconViaGenOutput> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (params.seed !== undefined) formData.append('seed', String(params.seed));
  if (params.pipeline_type !== undefined) formData.append('pipeline_type', params.pipeline_type);
  if (params.texture_size !== undefined) formData.append('texture_size', String(params.texture_size));
  if (params.decimation_target !== undefined) formData.append('decimation_target', String(params.decimation_target));
  if (params.remesh !== undefined) formData.append('remesh', String(params.remesh));
  if (params.ss_guidance_strength !== undefined) formData.append('ss_guidance_strength', String(params.ss_guidance_strength));
  if (params.ss_sampling_steps !== undefined) formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined) formData.append('slat_guidance_strength', String(params.slat_guidance_strength));
  if (params.slat_sampling_steps !== undefined) formData.append('slat_sampling_steps', String(params.slat_sampling_steps));

  const { data } = await client.post<ReconViaGenOutput>(
    `${getBackendApi()}/phidias/trellis2/generate-multi`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}
```

Posts to the existing proxy route `/phidias/trellis2/generate-multi`, which maps to upstream `/generate-multiview`. Response shape matches `generateTrellis` (returns `{ status, request_id, glb_url, ... }`).

## 7. Feature flag — `FEATURES.TRELLIS2_BACKEND`

Retained as an admin kill-switch (per user decision). Behavior:

- `true` (default going forward): switcher is rendered, both backends selectable, default `'trellis2'`.
- `false`: switcher is hidden, backend state is irrelevant, all dispatch goes to ReconViaGen (matches current behavior when flag is off).

`ModelGeneratePanel` gates the switcher render on this flag. `page.tsx` `handleGenerate` also defensively forces `backend = 'reconviagen'` when the flag is off, regardless of what was sent in `params.backend`.

## 8. Error handling

- TRELLIS.2 path: same 5-minute HTTP timeout as the existing `generateTrellis`. On error, catch in `handleGenerate`, surface via the same channel used today for ReconViaGen errors, clear `isGenerating`. No asset is added on failure.
- ReconViaGen path: unchanged. Errors flow through the existing job-error handling in `useJobManager` / `NavActions`.

## 9. Verification checklist

1. `pnpm lint` and `pnpm build` green.
2. `/workspace/model` — Image mode shows `[Fast] [Quality]` switcher with `Quality` active by default; Pipeline / Remesh / Max Faces visible; `Simplify Ratio` hidden.
3. Toggle to `Fast` → Pipeline / Remesh hidden; Max Faces replaced by `Simplify Ratio`; Diffusion Mode appears in multi-view.
4. Switch input mode: backend choice persists across Image ↔ Multi-view ↔ Text.
5. Switch to Batch: switcher disappears, Generate dispatches ReconViaGen regardless of previously selected backend.
6. Generate in `Fast` mode: bell card appears, no inline asset, unchanged from today.
7. Generate in `Quality` mode: spinner shows in-panel, no bell card, asset appears in AssetsPanel on success, `pipelineUsed === 'trellis'`, `activeAssetId` is the new asset.
8. Set `FEATURES.TRELLIS2_BACKEND = false` and reload: switcher gone, all generates go ReconViaGen.
9. Multi-view Quality: `generateTrellisMulti` called with `files` FormData, upstream `/generate-multiview` returns GLB, asset ingested.
10. Text Quality: submit text prompt → Qwen job card appears in bell → on Qwen completion, effect auto-dispatches `generateTrellis` → asset lands inline in AssetsPanel with `pipelineUsed === 'trellis'`, no second bell card for the 3D step. Text Fast keeps today's behavior (second ReconViaGen bell card after Qwen finishes).
11. Text mode: flipping the switcher between submit and Qwen completion does **not** change the backend used for the 3D step — the submission-time choice is honored via job metadata.

## 10. Files touched

| File | Change |
|---|---|
| `src/components/model/ModelGeneratePanel.tsx` | Add `backend` + `simplifyRatio` state, switcher UI, conditional rendering of Pipeline / Remesh / Decimation / Diffusion Mode |
| `src/app/workspace/model/page.tsx` | Replace image-mode `if (FEATURES.TRELLIS2_BACKEND)` scaffold with `if (params.backend === 'trellis2')`; extend same branch to multiview + text; keep batch on ReconViaGen |
| `src/lib/api/phidias.ts` | Add `generateTrellisMulti` |
| `src/lib/api/types.ts` | Add `backend` (required) + `simplify?` (optional) to `GenerateModelRequest` |
| `docs/TRELLIS2_BACKEND_SWITCH.md` | Update status line to reflect Scenario A landed (link this design doc) |

No other files (NavActions, useJobManager, useJobDownload, phidias-store, segment page, etc.) are touched.

## 11. Open questions resolved during brainstorming

| Question | Decision |
|---|---|
| Scope — which modes get the switcher? | All four input modes conceptually; `batch` hides the switcher since TRELLIS.2 has no batch endpoint |
| Default backend on first visit | Quality (TRELLIS.2) |
| Decimation UX — shared vs split | Split: `Max Faces` for Quality, `Simplify Ratio` for Fast |
| Switcher placement | Between panel header and input-mode tabs |
| Cross-mode persistence of backend | Yes, persist across input-mode switches within one panel instance |
| Cross-session persistence | No |
| Switcher labels | `Fast` (ReconViaGen) / `Quality` (TRELLIS.2) — only in the switcher, not in bell cards / asset pipelineUsed |
| Micro-copy under switcher | Yes, one short line describing async vs sync |
| `FEATURES.TRELLIS2_BACKEND` disposition | Keep as admin kill-switch |
| UI structure approach | Inline in `ModelGeneratePanel` (Approach 1), no sub-component split |
