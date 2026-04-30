# Model Tab — Dual Backend Switch (Fast / Quality) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-option backend switcher (Fast = ReconViaGen, Quality = TRELLIS.2) to Model tab, with per-backend conditional parameter UI and dispatch. Default Quality. Batch stays ReconViaGen-only.

**Architecture:** Inline additions to `ModelGeneratePanel.tsx` (Approach 1 per spec §2). New `generateTrellisMulti` API client wrapper. `handleGenerate` in `page.tsx` branches on `params.backend` per input mode. Qwen text2img effect listener becomes backend-aware via job metadata.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-17-model-tab-dual-backend-switch-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/api/phidias.ts` | Modify (append) | Add `generateTrellisMulti` mirroring `generateTrellis` |
| `src/__tests__/api/phidias/trellis2.test.ts` | Create | Unit-test trellis2 proxy mapping for `generate-multi → generate-multiview` |
| `src/lib/api/types.ts` | Modify | Add `backend: 'reconviagen' \| 'trellis2'` (required) + `simplify?: number` to `GenerateModelRequest` |
| `src/components/model/ModelGeneratePanel.tsx` | Modify | Add `backend` + `simplifyRatio` state, switcher UI, conditional Pipeline / Remesh / Decimation / Diffusion Mode, include `backend` + `simplify` in emitted request |
| `src/app/workspace/model/page.tsx` | Modify | Replace image-mode `FEATURES.TRELLIS2_BACKEND` gate with `params.backend === 'trellis2'`; add multi-view Quality branch using `generateTrellisMulti`; store `backend` + param snapshot in Qwen job metadata; branch qwen-completion effect on `metadata.backend` |
| `docs/TRELLIS2_BACKEND_SWITCH.md` | Modify | Update status line to note Scenario A landed |

---

## Task 1: Add `generateTrellisMulti` API client + proxy test

**Files:**
- Modify: `src/lib/api/phidias.ts` (append new export next to existing `generateTrellis`)
- Create: `src/__tests__/api/phidias/trellis2.test.ts`

- [ ] **Step 1: Write the failing proxy test**

Create `src/__tests__/api/phidias/trellis2.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/app/api/phidias/_proxy', () => ({
  proxyRequest: vi.fn(),
}))

import { POST } from '@/app/api/phidias/trellis2/[...path]/route'
import { proxyRequest } from '@/app/api/phidias/_proxy'

const mockProxy = vi.mocked(proxyRequest)

function makeMockResponse(data: unknown, status = 200): NextResponse {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as NextResponse
}

function makeRequest(path: string, method = 'POST'): NextRequest {
  return new NextRequest(`http://localhost/api/phidias/trellis2/${path}`, { method })
}

describe('trellis2 route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST generate-multi is mapped to upstream /generate-multiview and wraps the response', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({ request_id: 'req-abc', glb_url: '/download/req-abc/model.glb' }),
    )

    const req = makeRequest('generate-multi', 'POST')
    const res = await POST(req, { params: { path: ['generate-multi'] } })
    const body = await res.json()

    expect(mockProxy).toHaveBeenCalledOnce()
    const [, url] = mockProxy.mock.calls[0]
    expect(url).toContain('/generate-multiview')
    expect(url).not.toContain('/generate-multi')

    expect(body.status).toBe('success')
    expect(body.request_id).toBe('req-abc')
    expect(body.glb_url).toBe('/download/req-abc/model.glb')
  })

  it('POST generate is mapped to upstream /generate and wraps the response', async () => {
    mockProxy.mockResolvedValue(
      makeMockResponse({ request_id: 'req-xyz', glb_url: '/download/req-xyz/model.glb' }),
    )

    const req = makeRequest('generate', 'POST')
    const res = await POST(req, { params: { path: ['generate'] } })
    const body = await res.json()

    const [, url] = mockProxy.mock.calls[0]
    expect(url).toMatch(/\/generate$/)
    expect(body.status).toBe('success')
    expect(body.request_id).toBe('req-xyz')
  })
})
```

- [ ] **Step 2: Run the test to verify it passes (proxy mapping already exists)**

Run: `pnpm vitest run src/__tests__/api/phidias/trellis2.test.ts`
Expected: PASS — the proxy already maps `generate-multi → generate-multiview` (see `src/app/api/phidias/trellis2/[...path]/route.ts` ENDPOINT_MAP). The test is pinning existing behavior so future renames don't silently break the new client wrapper.

- [ ] **Step 3: Add `generateTrellisMulti` to `src/lib/api/phidias.ts`**

Find the existing `generateTrellis` function (around line 956). Immediately below it, add:

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
  if (params.pipeline_type !== undefined)
    formData.append('pipeline_type', params.pipeline_type);
  if (params.texture_size !== undefined)
    formData.append('texture_size', String(params.texture_size));
  if (params.decimation_target !== undefined)
    formData.append('decimation_target', String(params.decimation_target));
  if (params.remesh !== undefined)
    formData.append('remesh', String(params.remesh));
  if (params.ss_guidance_strength !== undefined)
    formData.append('ss_guidance_strength', String(params.ss_guidance_strength));
  if (params.ss_sampling_steps !== undefined)
    formData.append('ss_sampling_steps', String(params.ss_sampling_steps));
  if (params.slat_guidance_strength !== undefined)
    formData.append('slat_guidance_strength', String(params.slat_guidance_strength));
  if (params.slat_sampling_steps !== undefined)
    formData.append('slat_sampling_steps', String(params.slat_sampling_steps));

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

- [ ] **Step 4: Verify type-check passes**

Run: `pnpm exec tsc --noEmit -p .`
Expected: no errors (the function uses the existing `ReconViaGenOutput`, `client`, and `getBackendApi` symbols from the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/phidias.ts src/__tests__/api/phidias/trellis2.test.ts
git commit -m "feat(api): generateTrellisMulti + trellis2 proxy mapping test"
```

---

## Task 2: Extend `GenerateModelRequest` type

**Files:**
- Modify: `src/lib/api/types.ts` (around the `GenerateModelRequest` interface, line 28–61)

**Context:** The current interface does NOT declare `pipelineType` or `remesh`, even though `ModelGeneratePanel` and `page.tsx` already reference them (via inline `as` casts in page.tsx around line 315–317). We make them first-class now so later tasks can drop the casts.

- [ ] **Step 1: Add `backend`, `simplify`, `pipelineType`, `remesh` to `GenerateModelRequest`**

Find the `GenerateModelRequest` interface (starts line 28). Edit it to the following, preserving every existing field and only adding the four new ones (changes annotated with `// ← ADD`):

```typescript
export interface GenerateModelRequest {
  // Input mode
  inputMode: 'image' | 'multiview' | 'text' | 'batch';

  // Backend selection — ReconViaGen (async polling) vs TRELLIS.2 (sync inline)
  backend: 'reconviagen' | 'trellis2';   // ← ADD (required)

  // image mode
  image?: File;

  // multiview mode
  images?: File[];
  multiViewMode?: 'stochastic' | 'multidiffusion';

  // text mode (Qwen → 3D backend)
  qwen?: QwenText2ImgParams;

  // batch mode (multiple images → ReconViaGen queue — no TRELLIS.2 batch)
  batchImages?: File[];

  // Core params (shared)
  resolution: '512' | '1024' | '1536';
  seed: number;
  randomizeSeed: boolean;
  preprocessImage: boolean;

  // GLB export params
  decimationTarget: number;                                         // TRELLIS.2: absolute face count
  simplify?: number;                                                // ← ADD — ReconViaGen: 0-1 ratio
  textureSize: number;
  pipelineType?: '512' | '1024' | '1024_cascade' | '1536_cascade';  // ← ADD — TRELLIS.2-only
  remesh?: boolean;                                                 // ← ADD — TRELLIS.2-only

  // Stage 1: Sparse Structure Generation
  ss: GenerationParams;
  // Stage 2: Shape Generation
  shapSlat: GenerationParams;
  // Stage 3: Material Generation
  texSlat: GenerationParams;
}
```

- [ ] **Step 2: Remove now-unnecessary type assertions in `page.tsx`**

Find the inline `as` cast in `src/app/workspace/model/page.tsx` around line 315–317:

```typescript
const pipelineType = (params as GenerateModelRequest & {
  pipelineType?: '512' | '1024' | '1024_cascade' | '1536_cascade';
}).pipelineType;
```

Replace it with the plain access:

```typescript
const pipelineType = params.pipelineType;
```

Later tasks (5/6/8) will also reference `params.pipelineType`, `params.remesh`, `params.simplify` directly without casts.

- [ ] **Step 3: Verify type-check**

Run: `pnpm exec tsc --noEmit -p .`

Expected: type errors surface at `src/components/model/ModelGeneratePanel.tsx` inside its local `handleGenerate` where the `common` object is built — TS now complains that `backend` is missing when the object is passed to `onGenerate`. This is expected; Task 3 fixes it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/types.ts src/app/workspace/model/page.tsx
git commit -m "feat(types): first-class backend, simplify, pipelineType, remesh on GenerateModelRequest"
```

---

## Task 3: Add backend state + switcher UI in `ModelGeneratePanel.tsx`

**Files:**
- Modify: `src/components/model/ModelGeneratePanel.tsx`

- [ ] **Step 1: Add backend + simplify state**

Find the "TRELLIS.2 output params" state block (around line 252). Add the two new states above the existing block:

```typescript
// ── Backend selection ──────────────────────────────────────────────────
const [backend, setBackend] = useState<'reconviagen' | 'trellis2'>('trellis2');

// ── Decimation — form depends on backend ────────────────────────────────
// TRELLIS.2 uses absolute decimationTarget (already below); ReconViaGen uses ratio simplify
const [simplifyRatio, setSimplifyRatio] = useState(0.95);
```

Keep existing `decimationTarget` state (it's now specifically the TRELLIS.2-branch value).

- [ ] **Step 2: Render the switcher + micro-copy between header and mode tabs**

Locate the `{/* Mode tabs */}` section (around line 404). INSERT the following block **above** it and below the `{/* Header */}` block:

```tsx
{/* Backend switcher — hidden in batch mode (no TRELLIS.2 batch endpoint)
    and hidden entirely when the admin kill-switch FEATURES.TRELLIS2_BACKEND is off */}
{FEATURES.TRELLIS2_BACKEND && inputMode !== 'batch' && (
  <div className="px-4 pt-3 pb-2 border-b border-[#333355] space-y-1">
    <div className="flex gap-1.5">
      {(['reconviagen', 'trellis2'] as const).map((b) => {
        const label = b === 'reconviagen' ? 'Fast' : 'Quality';
        const active = backend === b;
        return (
          <button
            key={b}
            onClick={() => setBackend(b)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs transition-colors',
              active ? 'text-white' : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a] hover:text-white',
            )}
            style={active ? { background: '#0E243E', border: '1px solid #D5B451' } : {}}
          >
            {label}
          </button>
        );
      })}
    </div>
    <p className="text-[10px] text-[#64748b]">
      {backend === 'reconviagen'
        ? 'Async — results appear in notifications'
        : 'Sync — wait here for the result'}
    </p>
  </div>
)}
```

- [ ] **Step 3: Pass `backend` + `simplify` in the emitted request**

Find the `handleGenerate` helper inside `ModelGeneratePanel` (around line 274). Update the `common` object to include the new fields:

```typescript
const common = {
  backend,                 // ← add
  resolution,
  pipelineType,
  seed: randomizeSeed ? 0 : seed,
  randomizeSeed,
  preprocessImage,
  decimationTarget,
  simplify: simplifyRatio, // ← add
  remesh,
  textureSize,
  ss,
  shapSlat,
  texSlat: {
    guidance_strength: 1.0,
    sampling_steps: 12,
  } as GenerationParams,
};
```

- [ ] **Step 4: Verify type-check passes**

Run: `pnpm exec tsc --noEmit -p .`
Expected: no errors — Task 2 added `backend` to the type, and Step 3 supplies it.

- [ ] **Step 5: Commit**

```bash
git add src/components/model/ModelGeneratePanel.tsx
git commit -m "feat(model-panel): backend state + Fast/Quality switcher"
```

---

## Task 4: Conditional parameter rendering per backend

**Files:**
- Modify: `src/components/model/ModelGeneratePanel.tsx`

- [ ] **Step 1: Gate Pipeline Type block on `backend === 'trellis2'`**

Find the Pipeline Type block (around line 604–632, wrapped in `{FEATURES.TRELLIS2_BACKEND && (...)}`) . Replace the guard with `backend === 'trellis2'`:

```tsx
{/* Pipeline Type — TRELLIS.2-only */}
{backend === 'trellis2' && (
  <div>
    <p className="text-xs text-[#e2e8f0] mb-1">Pipeline</p>
    <div className="flex gap-1">
      {PIPELINE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setPipelineType(opt.value)}
          className={cn(
            'flex-1 flex flex-col items-center py-1.5 rounded-lg text-[10px] transition-colors',
            pipelineType === opt.value
              ? 'text-white'
              : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
          )}
          style={
            pipelineType === opt.value
              ? { background: '#0E243E', border: '1px solid #D5B451' }
              : {}
          }
        >
          <span className="font-mono font-bold">{opt.label}</span>
          <span className="text-[8px] opacity-60">{opt.desc}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Swap Decimation UI by backend**

Find the Decimation block labeled `{/* Decimation Target */}` (around line 688). Replace the whole `<div>` block with:

```tsx
{/* Decimation — different control per backend */}
{backend === 'trellis2' ? (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-[#e2e8f0]">Max Faces</span>
      <span className="text-[10px] text-[#94a3b8] font-mono">
        {(decimationTarget / 1000).toFixed(0)}K
      </span>
    </div>
    <input
      type="range"
      min={50000}
      max={2000000}
      step={50000}
      value={decimationTarget}
      onChange={(e) => setDecimationTarget(parseInt(e.target.value))}
      className="w-full h-1 rounded-full appearance-none bg-[#333355] accent-[#D5B451]"
    />
  </div>
) : (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-[#e2e8f0]">Simplify Ratio</span>
      <span className="text-[10px] text-[#94a3b8] font-mono">
        {simplifyRatio.toFixed(2)}
      </span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={simplifyRatio}
      onChange={(e) => setSimplifyRatio(parseFloat(e.target.value))}
      className="w-full h-1 rounded-full appearance-none bg-[#333355] accent-[#D5B451]"
    />
  </div>
)}
```

- [ ] **Step 3: Gate the Remesh toggle on `backend === 'trellis2'`**

Find the Remesh toggle block (around line 708). Wrap it:

```tsx
{backend === 'trellis2' && (
  <div className="flex items-center justify-between">
    <span className="text-xs text-[#e2e8f0]">Remesh</span>
    <Toggle label="" checked={remesh} onChange={setRemesh} />
  </div>
)}
```

- [ ] **Step 4: Gate Diffusion Mode (multi-view only) on `backend === 'reconviagen'`**

Find the multi-view Diffusion Mode block (around line 450–459, inside `inputMode === 'multiview'`). Wrap the `<div>` that contains `<PillGroup ... options={['stochastic', 'multidiffusion']}>` with a backend guard:

```tsx
{backend === 'reconviagen' && (
  <div>
    <p className="text-xs text-[#94a3b8] mb-1">Diffusion Mode</p>
    <PillGroup
      options={['stochastic', 'multidiffusion']}
      value={multiViewMode}
      onChange={(v) =>
        setMultiViewMode(v as 'stochastic' | 'multidiffusion')
      }
    />
  </div>
)}
```

- [ ] **Step 5: Verify lint + type-check**

Run: `pnpm lint && pnpm exec tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/model/ModelGeneratePanel.tsx
git commit -m "feat(model-panel): per-backend conditional fields"
```

---

## Task 5: Image-mode Quality branch in `handleGenerate`

**Files:**
- Modify: `src/app/workspace/model/page.tsx`

- [ ] **Step 1: Replace the `FEATURES.TRELLIS2_BACKEND` guard with `params.backend === 'trellis2'` and wire params**

Find the image-mode branch in `handleGenerate` (around line 306). Locate the `if (FEATURES.TRELLIS2_BACKEND) { ... return; }` scaffold (around line 314–343). Replace the whole block with the following, preserving the existing placeholder-asset pattern and enriching the `generateTrellis` call with all user-set params:

```typescript
if (params.backend === 'trellis2') {
  const pipelineType = params.pipelineType;
  const assetId = addAsset({
    name: file.name.replace(/\.[^.]+$/, '') || 'Generated Model',
    modelUrl: '',
    type: 'textured',
    status: 'generating',
    pipelineUsed: 'trellis',
  });
  setActiveAssetId(assetId);
  try {
    const result = await generateTrellis(file, {
      ...advancedParams,
      pipeline_type: pipelineType,
      decimation_target: params.decimationTarget,
      remesh: params.remesh,
    });
    const fileName = result.glb_url?.split('/').pop() || 'model.glb';
    const blob = await downloadPhidiasImage(result.request_id, fileName, 'trellis2');
    const localUrl = URL.createObjectURL(blob);
    updateAsset(assetId, {
      modelUrl: localUrl,
      status: 'ready',
      fileSize: blob.size,
    });
  } catch (err) {
    console.error('TRELLIS.2 single generation failed:', err);
    updateAsset(assetId, { status: 'failed', errorMessage: String(err) });
  } finally {
    setIsGenerating(false);
    setProgress(null);
  }
  return;
}
```

Notes:
- `params.backend` comes from `GenerateModelRequest` (Task 2 added it).
- `params.remesh` and `params.decimationTarget` are already on the type; Task 3 made sure the panel populates them.
- The `advancedParams` local already has seed/texture/ss/slat; keep the spread.
- The `FEATURES.TRELLIS2_BACKEND` import stays (still used as kill-switch in the panel). Do NOT delete it from the imports.

- [ ] **Step 2: Defensive flag check — force ReconViaGen when flag is off**

Immediately BEFORE the image-mode branch (or at the top of `handleGenerate`), add a defensive coercion so that if the flag is off but somehow `backend === 'trellis2'` arrives, we fall back to `reconviagen`:

Add **at the top of `handleGenerate`, after `setIsGenerating(true)` / `setProgress(...)`**:

```typescript
// Kill-switch: ignore the panel's backend choice when the flag is off.
if (!FEATURES.TRELLIS2_BACKEND) {
  params = { ...params, backend: 'reconviagen' };
}
```

(Mutating a readonly param reference via reassignment is fine here — the local `params` is a function parameter. If TS complains, destructure into a `let`.)

- [ ] **Step 3: Verify type-check + lint**

Run: `pnpm lint && pnpm exec tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/model/page.tsx
git commit -m "feat(model): image-mode dispatch branches on params.backend"
```

---

## Task 6: Multi-view Quality branch in `handleGenerate`

**Files:**
- Modify: `src/app/workspace/model/page.tsx`

- [ ] **Step 1: Import `generateTrellisMulti`**

At the top of `page.tsx` where `generateTrellis` is already imported from `@/lib/api/phidias`, add `generateTrellisMulti` to the same import group. Example:

```typescript
import {
  // ...existing...
  generateTrellis,
  generateTrellisMulti,   // ← add
} from '@/lib/api/phidias';
```

- [ ] **Step 2: Add a Quality branch inside the `multiview` block**

Find the `else if (params.inputMode === 'multiview')` block (around line 370). INSIDE that block, BEFORE the existing `generateReconMulti(...)` call, add:

```typescript
if (params.backend === 'trellis2') {
  const files = params.images!;
  const firstFile = files[0];
  const assetId = addAsset({
    name: (firstFile?.name.replace(/\.[^.]+$/, '') || 'Multi-view Model'),
    modelUrl: '',
    type: 'textured',
    status: 'generating',
    pipelineUsed: 'trellis',
  });
  setActiveAssetId(assetId);
  try {
    const result = await generateTrellisMulti(files, {
      ...advancedParams,
      pipeline_type: params.pipelineType,
      decimation_target: params.decimationTarget,
      remesh: params.remesh,
    });
    const fileName = result.glb_url?.split('/').pop() || 'model.glb';
    const blob = await downloadPhidiasImage(result.request_id, fileName, 'trellis2');
    const localUrl = URL.createObjectURL(blob);
    updateAsset(assetId, {
      modelUrl: localUrl,
      status: 'ready',
      fileSize: blob.size,
    });
  } catch (err) {
    console.error('TRELLIS.2 multi-view generation failed:', err);
    updateAsset(assetId, { status: 'failed', errorMessage: String(err) });
  } finally {
    setIsGenerating(false);
    setProgress(null);
  }
  return;
}
```

- [ ] **Step 3: Verify type-check**

Run: `pnpm exec tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/model/page.tsx
git commit -m "feat(model): multi-view dispatch gains TRELLIS.2 branch"
```

---

## Task 7: Text mode — store backend + param snapshot in Qwen job metadata

**Files:**
- Modify: `src/app/workspace/model/page.tsx` (the text-mode branch in `handleGenerate`, around line 398–424)

- [ ] **Step 1: Enrich the Qwen `addJob({ metadata })` call with the 3D-gen param snapshot**

Find the `else if (params.inputMode === 'text')` branch. Update the `addJob({ metadata: {...} })` call to include the full 3D-gen params captured at submit time:

```typescript
addJob({
  jobId: qwenResult.job_id,
  service: 'qwen',
  status: qwenResult.status,
  type: 'text2img',
  queuePosition: qwenResult.queue_position,
  metadata: {
    prompt: qwen.prompt,
    // 3D-gen params snapshot — read by the auto-dispatch effect on Qwen completion
    backend: params.backend,
    pipelineType: params.pipelineType,
    seed: params.seed,
    randomizeSeed: params.randomizeSeed,
    textureSize: params.textureSize,
    decimationTarget: params.decimationTarget,
    simplify: params.simplify,
    remesh: params.remesh,
    ssGuidance: params.ss.guidance_strength,
    ssSteps: params.ss.sampling_steps,
    slatGuidance: params.shapSlat.guidance_strength,
    slatSteps: params.shapSlat.sampling_steps,
  },
});
```

Note: `metadata` is declared as `Record<string, unknown>` in the job store (check `src/store/phidias-store.ts` if you need to confirm). Adding arbitrary keys is OK.

- [ ] **Step 2: Verify type-check**

Run: `pnpm exec tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/workspace/model/page.tsx
git commit -m "feat(model): capture 3D-gen params in Qwen job metadata"
```

---

## Task 8: Text mode — qwen-completion effect branches on backend

**Files:**
- Modify: `src/app/workspace/model/page.tsx` (the text2img completion `useEffect`, around line 118–212)

- [ ] **Step 1: Read backend + params from metadata, branch dispatch**

Find the `useEffect` that listens for completed Qwen text2img jobs (around line 118). Inside the `(async () => { ... })()` IIFE (around line 152), after the image file is downloaded (around line 166, just after `const file = new File([blob], fileName, ...)`), REPLACE the hardcoded reconviagen call (lines 177–200) with a backend-aware dispatch:

```typescript
// Read submission-time 3D-gen params from the Qwen job's metadata
const meta = (job.metadata ?? {}) as Record<string, unknown>;
const backend = (meta.backend as 'reconviagen' | 'trellis2' | undefined) ?? 'reconviagen';

const sharedAdvanced = {
  seed: (meta.randomizeSeed as boolean) ? 0 : ((meta.seed as number) ?? 0),
  texture_size: (meta.textureSize as number) ?? 2048,
  ss_guidance_strength: meta.ssGuidance as number | undefined,
  ss_sampling_steps: meta.ssSteps as number | undefined,
  slat_guidance_strength: meta.slatGuidance as number | undefined,
  slat_sampling_steps: meta.slatSteps as number | undefined,
};

if (backend === 'trellis2') {
  // Convert image to data URL for the placeholder asset thumbnail
  const imageDataUrlForThumb = imageDataUrl;  // already computed above
  const assetId = addAsset({
    name: (job.metadata?.prompt as string) || 'Generated Model',
    modelUrl: '',
    type: 'textured',
    status: 'generating',
    pipelineUsed: 'trellis',
    thumbnail: imageDataUrlForThumb,
  });
  setActiveAssetId(assetId);
  try {
    const result = await generateTrellis(file, {
      ...sharedAdvanced,
      pipeline_type: meta.pipelineType as
        | '512' | '1024' | '1024_cascade' | '1536_cascade' | undefined,
      decimation_target: meta.decimationTarget as number | undefined,
      remesh: meta.remesh as boolean | undefined,
    });
    const glbFileName = result.glb_url?.split('/').pop() || 'model.glb';
    const glbBlob = await downloadPhidiasImage(result.request_id, glbFileName, 'trellis2');
    const localUrl = URL.createObjectURL(glbBlob);
    updateAsset(assetId, {
      modelUrl: localUrl,
      status: 'ready',
      fileSize: glbBlob.size,
    });
  } catch (err) {
    console.error('[ModelPage] TRELLIS.2 auto-dispatch failed:', err);
    updateAsset(assetId, { status: 'failed', errorMessage: String(err) });
  }
} else {
  // Fast (ReconViaGen) — existing async-job path
  const reconResult: JobSubmitResponse = await generateReconSingle(file, {
    ...sharedAdvanced,
    simplify: meta.simplify as number | undefined,
  });

  addJob({
    jobId: reconResult.job_id,
    service: 'reconviagen',
    status: reconResult.status,
    type: 'generate-single',
    queuePosition: reconResult.queue_position,
    metadata: {
      name: (job.metadata?.prompt as string) || 'Generated Model',
      fileName,
      sourceJobId: job.jobId,
      prompt: job.metadata?.prompt as string | undefined,
      referenceImageDataUrl: imageDataUrl,
    },
  });

  incrementConnection('reconviagen');
}
```

- [ ] **Step 2: Update the effect's dependency array**

The existing dependency array (around line 212) is `[jobs, apiBaseUrl, addJob, incrementConnection]`. Add `addAsset`, `setActiveAssetId`, `updateAsset` so the closure references are fresh:

```typescript
}, [jobs, apiBaseUrl, addJob, incrementConnection, addAsset, setActiveAssetId, updateAsset]);
```

- [ ] **Step 3: Verify type-check + lint**

Run: `pnpm lint && pnpm exec tsc --noEmit -p .`
Expected: no errors. If `generateTrellis`, `addAsset`, `setActiveAssetId`, `updateAsset` are missing from imports or `useWorkspace` destructure in this file, add them (grep the file; they may already be in scope from the image-mode branch).

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/model/page.tsx
git commit -m "feat(model): text-mode auto-dispatch branches on metadata.backend"
```

---

## Task 9: Update TRELLIS2_BACKEND_SWITCH runbook status line

**Files:**
- Modify: `docs/TRELLIS2_BACKEND_SWITCH.md`

- [ ] **Step 1: Update the status line at the top**

Replace the existing `> **Status**: Preparation commit 2d7c272 shipped. Default state: **ReconViaGen active, TRELLIS.2 prepared but hidden**.` with:

```markdown
> **Status**: Scenario A landed (2026-04-17). Both backends selectable via per-panel Fast/Quality switcher. Default: **Quality (TRELLIS.2)**. `FEATURES.TRELLIS2_BACKEND` retained as admin kill-switch. See `docs/superpowers/specs/2026-04-17-model-tab-dual-backend-switch-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TRELLIS2_BACKEND_SWITCH.md
git commit -m "docs(runbook): mark TRELLIS2 switch Scenario A as landed"
```

---

## Task 10: End-to-end verification

**Files:** none (this is manual browser verification)

- [ ] **Step 1: Build + lint clean**

Run:
```bash
pnpm lint
pnpm exec tsc --noEmit -p .
pnpm vitest run src/__tests__/api/phidias/trellis2.test.ts
pnpm build
```
Expected: all green.

- [ ] **Step 2: Start dev server**

Run: `pnpm dev`

- [ ] **Step 3: Walk the verification checklist from spec §9**

Open `http://localhost:3000/workspace/model` and confirm each of the following. Tick each box:

- [ ] Image mode shows `[Fast] [Quality]` switcher with **Quality active by default**; Pipeline, Remesh, Max Faces visible; Simplify Ratio hidden.
- [ ] Toggle to **Fast** → Pipeline and Remesh disappear; Max Faces replaced by Simplify Ratio (0–1 range).
- [ ] Switch input mode Image → Multi-view → Text: the backend choice persists across modes.
- [ ] Multi-view mode: `Diffusion Mode` pill group is visible ONLY when Fast is selected; hidden when Quality is selected.
- [ ] Batch mode: the backend switcher + micro-copy are **completely absent**.
- [ ] Generate a single image in **Fast**: the bell icon top-right lights up, no inline asset created, unchanged from previous behavior.
- [ ] Generate a single image in **Quality**: a placeholder "generating" asset appears in AssetsPanel immediately, the 3D viewport shows the new active asset, the spinner in the panel shows progress; on completion the asset's `status` flips to `ready` and the GLB loads into viewport.
- [ ] Multi-view **Quality**: `generateTrellisMulti` is called (confirm via Network tab: POST to `/api/phidias/trellis2/generate-multi`), placeholder asset ingests on completion.
- [ ] Text **Fast**: submit prompt → Qwen bell card → on Qwen completion, a second ReconViaGen bell card appears (existing behavior).
- [ ] Text **Quality**: submit prompt → Qwen bell card only; on Qwen completion, the TRELLIS.2 asset appears inline in AssetsPanel without a second bell card. `pipelineUsed === 'trellis'` (inspect the asset in DevTools if needed).
- [ ] Text mode race: in Quality, submit; while Qwen is still running, toggle switcher to Fast. Verify the 3D dispatch still uses Quality (TRELLIS.2) because metadata was captured at submit time.
- [ ] Temporarily set `FEATURES.TRELLIS2_BACKEND = false` in `src/config/features.ts`, reload. Confirm: switcher is gone; every input mode generates via ReconViaGen. Revert the flag before committing anything else.

- [ ] **Step 4: If everything passes, no commit needed** — this task is verification-only. If any manual step fails, return to Phase 1 of superpowers:systematic-debugging and investigate rather than adding quick patches.

---

## Self-Review Notes

- Spec §3.3 parameter table is covered by Tasks 3 + 4.
- Spec §5 dispatch table: image mode = Task 5, multi-view = Task 6, text mode = Tasks 7 + 8, batch unchanged (no task needed).
- Spec §6 API addition = Task 1.
- Spec §9 verification checklist = Task 10.
- Spec §7 (`FEATURES.TRELLIS2_BACKEND` as kill-switch): defensive coercion in Task 5 Step 2 + UI gating in Task 3 Step 2.
- No placeholders. Every code block is concrete enough to paste.
- Commits are tight (one per task) and reversible.
