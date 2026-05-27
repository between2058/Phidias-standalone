# CAD Library Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new top-level **CAD** tab in Phidias that browses the Articraft asset dataset via a sidecar FastAPI, with a faceted grid and a URDF detail viewer with joint controls.

**Architecture:** Sidecar topology — Articraft's FastAPI runs locally on `:8765`; Phidias proxies `/api/library/*` to `/api/*` via a single `next.config.mjs` rewrite. The Articraft URDF parser (`urdf-parser.ts`, fully framework-agnostic) is ported into Phidias verbatim; its R3F-incompatible companion `useUrdfLoader.ts` is replaced by a small R3F-idiomatic wrapper. The compiled URDF mounts inside React Three Fiber via `<primitive>`. Read-only MVP. Sub-route `/workspace/cad/[recordId]` for detail.

**Materialization cache layout (confirmed by Phase-0 spike):** `data/cache/record_materialization/<record_id>/model.urdf` — flat per record (NOT revision-scoped) and NOT split into visual/collision variants. The `/api/records/<id>/files/<path>` endpoint resolves `model.urdf` against this cache.

**Tech Stack:** Next.js 14, React 18, React Three Fiber `^8.18`, `@react-three/drei` `^9.122`, three `^0.183`, TypeScript, Tailwind v4, vitest, Playwright. **No shadcn.** Reuse Phidias CSS variables (`--bg-primary`, `--bg-card`, `--accent-purple`, etc.) and glassmorphism patterns from `AssetsPanel`.

**Branch:** `feat/cad-library-tab` (already created from `computex-demo`).

**Spec:** `docs/superpowers/specs/2026-05-21-phidias-cad-library-tab-design.md`

---

## File Structure

### Create

```
src/app/workspace/cad/page.tsx                     # list route
src/app/workspace/cad/[recordId]/page.tsx          # detail route

src/components/cad/CADLibraryPage.tsx              # container, URL state
src/components/cad/CADSourceTabs.tsx               # Dataset / Workbench / All
src/components/cad/CADFacetSidebar.tsx             # left filters
src/components/cad/CADRecordGrid.tsx               # center grid + infinite scroll
src/components/cad/CADRecordCard.tsx               # single card
src/components/cad/CADInspector.tsx                # right metadata + tabs
src/components/cad/CADDetailPage.tsx               # detail container
src/components/cad/CADViewer.tsx                   # R3F Canvas
src/components/cad/UrdfModel.tsx                   # <primitive/> wrapper
src/components/cad/CADJointControls.tsx            # sliders
src/components/cad/CADEmptyState.tsx               # sidecar-down / no-data UI

src/lib/api/library.ts                             # API client + types
src/lib/cad/filters.ts                             # URL <-> filter object
src/lib/cad/pose.ts                                # URL <-> joint pose object

src/lib/three/urdf/types.ts                        # JointSpec, LinkSpec, RobotSpec
src/lib/three/urdf/MeshResolver.ts                 # path -> URL
src/lib/three/urdf/UrdfLoader.ts                   # XML -> THREE.Group (port)
src/lib/three/urdf/UrdfRobot.ts                    # setJointAngle, dispose (port)

src/lib/api/library.test.ts
src/lib/cad/filters.test.ts
src/lib/cad/pose.test.ts
src/lib/three/urdf/MeshResolver.test.ts
src/lib/three/urdf/UrdfLoader.test.ts
src/components/cad/CADRecordCard.test.tsx
src/components/cad/CADJointControls.test.tsx
src/components/cad/__fixtures__/sample-browse-response.json
src/components/cad/__fixtures__/sample-record-summary.json
src/components/cad/__fixtures__/sample-urdf.xml

e2e/cad-library.spec.ts
```

### Modify

```
src/components/shared/LeftIconSidebar.tsx          # add CAD tab
next.config.mjs                                    # add /api/library/* rewrite
.env.example                                       # ARTICRAFT_API_URL
package.json                                       # dev:with-library script + concurrently
playwright.config.ts                               # webServer config for sidecar (optional)
```

---

## Phase 0 — Spike (Quick Verifications)

Most unknowns were resolved during planning. This phase only validates the URDF port feasibility before committing to the path.

### Task 0.1: Read Articraft URDF source files

**Files:** read-only — `/home/pegaai/code/articraft/viewer/web/src/components/viewer3d/urdf-parser.ts`, `useUrdfLoader.ts`.

- [ ] **Step 1: Read both files start-to-finish.** Note: (a) all `import` statements, (b) any reference to Articraft-specific utilities outside `viewer3d/`, (c) the public surface (exported functions/classes/types), (d) how mesh URLs are constructed (look for the string `/api/records/` or `files/`).

- [ ] **Step 2: Write findings to a scratch note in this plan file as a comment block at the bottom under "Spike Findings".** Include: portability verdict (port-as-is / refactor-mesh-resolver-only / fallback-to-urdf-loader-npm), the public API to recreate in Phidias, the exact string concatenation pattern used for mesh URLs.

- [ ] **Step 3: No commit.** Spike output stays in this plan doc.

### Task 0.2: Verify a real `record.json` from disk

**Files:** read-only — `/home/pegaai/code/articraft/data/records/<any>/record.json`.

- [ ] **Step 1: Pick one record and `cat` its `record.json`.** Confirm `schema_version`, `active_revision_id`, and that `artifacts.model_py` points into `revisions/<rev_id>/`.

- [ ] **Step 2: Confirm the materialization cache has `model.urdf`** at `/home/pegaai/code/articraft/data/cache/record_materialization/<record_id>/model.urdf` (NOTE: NOT revision-scoped; the cache is flat per record). If it does not exist for that record, pick a different record (one that has been compiled) for E2E testing later. Note the picked record id for Task 8.

**Findings already captured by spike:** Test record id = `rec_an-nvidia-gb300-nvl72-server-rack-a-tall-enclose_20260518_055942_556781_2acac014`. Only ~15 records are compiled, so most grid items will surface the "not compiled" empty state — that is acceptable for MVP.

- [ ] **Step 3: No commit.**

### Task 0.3: Verify Articraft sidecar starts and responds

**Files:** none.

- [ ] **Step 1: Start the sidecar in a separate terminal.**

```bash
cd /home/pegaai/code/articraft
uv run uvicorn viewer.api.app:app --host 127.0.0.1 --port 8765
```

- [ ] **Step 2: From another terminal, hit a known endpoint.**

```bash
curl -s 'http://127.0.0.1:8765/api/records/browse?source=dataset&limit=2' | head -c 800
```

Expected: JSON containing `"source": "dataset"`, `"records": [...]`, `"facets": {...}`.

- [ ] **Step 3: Leave the sidecar running** for the rest of the plan. No commit.

---

## Phase 1 — Plumbing

### Task 1.1: Add `ARTICRAFT_API_URL` to env example

**Files:** Modify `.env.example`.

- [ ] **Step 1: Append to `.env.example`:**

```
# Sidecar Articraft FastAPI (for the CAD library tab)
ARTICRAFT_API_URL=http://127.0.0.1:8765
```

- [ ] **Step 2: Commit.**

```bash
git add .env.example
git commit -m "feat(cad): add ARTICRAFT_API_URL env var"
```

### Task 1.2: Wire the rewrite

**Files:** Modify `next.config.mjs`.

- [ ] **Step 1: Read `next.config.mjs` and locate the existing `rewrites` array (or `async rewrites()` function).** If none, add one.

- [ ] **Step 2: Add the library rewrite.** Insert this entry (inside the `rewrites()` returned array):

```js
{
  source: '/api/library/:path*',
  destination: `${process.env.ARTICRAFT_API_URL ?? 'http://127.0.0.1:8765'}/api/:path*`,
},
```

- [ ] **Step 3: Smoke test from a browser** while `next dev` is running:

```
GET http://localhost:3000/api/library/records/browse?source=dataset&limit=2
```

Expected: same JSON as the direct curl in Task 0.3.

- [ ] **Step 4: Commit.**

```bash
git add next.config.mjs
git commit -m "feat(cad): proxy /api/library/* to the Articraft sidecar"
```

### Task 1.3: Convenience dev script

**Files:** Modify `package.json`.

- [ ] **Step 1: Add `concurrently` as a devDependency.**

```bash
pnpm add -D concurrently
```

- [ ] **Step 2: Add a script under `scripts`:**

```json
"dev:with-library": "concurrently -n phidias,sidecar -c blue,magenta \"pnpm dev\" \"cd ../../code/articraft && uv run uvicorn viewer.api.app:app --host 127.0.0.1 --port 8765\""
```

(Adjust the `cd` path if your articraft checkout lives elsewhere.)

- [ ] **Step 3: Verify it boots both processes** by running `pnpm dev:with-library` and confirming both logs appear and the proxy works. Stop with Ctrl+C.

- [ ] **Step 4: Commit.**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(cad): add dev:with-library script that runs Next + sidecar"
```

### Task 1.4: Register the CAD tab in the sidebar

**Files:** Modify `src/components/shared/LeftIconSidebar.tsx`.

- [ ] **Step 1: Read the file** and find the `tabs` array declaration (around lines 10-29).

- [ ] **Step 2: Add `DraftingCompass` to the lucide-react import** at the top of the file (preserve other imports):

```ts
import { Camera, Sparkles, Scissors, Paintbrush, Atom, DraftingCompass } from 'lucide-react';
```

- [ ] **Step 3: Append a new tab entry** as the last element of the `tabs` array:

```ts
{ icon: <DraftingCompass size={20} />, label: 'CAD', href: '/workspace/cad' },
```

- [ ] **Step 4: Visual check.** Run `pnpm dev`, open the workspace, confirm the new icon shows below Physics with the right label on hover. It will route to a 404 until the next task.

- [ ] **Step 5: Commit.**

```bash
git add src/components/shared/LeftIconSidebar.tsx
git commit -m "feat(cad): add CAD tab to sidebar"
```

### Task 1.5: Empty CAD page that renders

**Files:** Create `src/app/workspace/cad/page.tsx`.

- [ ] **Step 1: Create the file** with this exact content:

```tsx
'use client';

import { CADLibraryPage } from '@/components/cad/CADLibraryPage';

export default function Page() {
  return <CADLibraryPage />;
}
```

- [ ] **Step 2: Create a minimal placeholder for `CADLibraryPage`** at `src/components/cad/CADLibraryPage.tsx`:

```tsx
'use client';

export function CADLibraryPage() {
  return (
    <div className="flex h-full w-full items-center justify-center text-slate-400">
      CAD library — coming online…
    </div>
  );
}
```

- [ ] **Step 3: Verify** by clicking the CAD tab in `pnpm dev`. Placeholder text shows.

- [ ] **Step 4: Commit.**

```bash
git add src/app/workspace/cad/page.tsx src/components/cad/CADLibraryPage.tsx
git commit -m "feat(cad): scaffold /workspace/cad route"
```

---

## Phase 2 — API Client + Types

### Task 2.1: Type definitions matching real schemas

**Files:** Create `src/lib/api/library.ts`. Source of truth: `/home/pegaai/code/articraft/viewer/api/schemas.py`.

- [ ] **Step 1: Create the file with the type block first** (no functions yet):

```ts
export type SourceTab = 'dataset' | 'workbench' | 'all';

export interface RecordSummary {
  record_id: string;
  title: string;
  prompt_preview: string;
  rating: number | null;
  secondary_rating: number | null;
  effective_rating: number | null;
  author: string | null;
  rated_by: string | null;
  secondary_rated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  viewer_asset_updated_at: string | null;
  sdk_package: string | null;
  provider: string | null;
  model_id: string | null;
  creator_mode: string | null;
  external_agent: string | null;
  agent_harness: string;
  has_traces: boolean;
  thinking_level: string | null;
  turn_count: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_cost_usd: number | null;
  category_slug: string | null;
  run_id: string | null;
  run_status: string | null;
  run_message: string | null;
  active_revision_id: string | null;
  origin_record_id: string | null;
  parent_record_id: string | null;
  revision_count: number;
  has_history: boolean;
  collections: string[];
  materialization_status: string | null;
  has_compile_report: boolean;
  has_provenance: boolean;
  has_cost: boolean;
}

export interface BrowseFacets {
  models: string[];
  sdk_packages: string[];
  agent_harnesses: string[];
  authors: string[];
  categories: string[];
  cost_min: number | null;
  cost_max: number | null;
}

export interface BrowseResponse {
  source: string;
  total: number;
  source_total: number;
  offset: number;
  limit: number;
  record_ids: string[];
  records: RecordSummary[];
  facets: BrowseFacets;
}

export interface BrowseFilters {
  source: SourceTab;
  q?: string;
  time?: string;
  time_from?: string;
  time_to?: string;
  model?: string;
  sdk?: string;
  agent_harness?: string[];
  author?: string[];
  category?: string[];
  cost_min?: number;
  cost_max?: number;
  rating?: string[];
  secondary_rating?: string[];
  offset?: number;
  limit?: number;
}

export class LibraryApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'LibraryApiError';
  }
}

const BASE = '/api/library';
```

- [ ] **Step 2: Commit.**

```bash
git add src/lib/api/library.ts
git commit -m "feat(cad): type stubs for library API"
```

### Task 2.2: `browseRecords` with TDD

**Files:** Create `src/lib/api/library.test.ts`, modify `src/lib/api/library.ts`.

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/api/library.test.ts
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { browseRecords } from './library';

describe('browseRecords', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes filters and parses the response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'dataset',
        total: 1,
        source_total: 1,
        offset: 0,
        limit: 60,
        record_ids: ['rec_x'],
        records: [],
        facets: {
          models: [],
          sdk_packages: [],
          agent_harnesses: [],
          authors: [],
          categories: [],
          cost_min: null,
          cost_max: null,
        },
      }),
    });

    const res = await browseRecords({ source: 'dataset', q: 'hinge', limit: 60 });
    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/library/records/browse?');
    expect(calledUrl).toContain('source=dataset');
    expect(calledUrl).toContain('q=hinge');
    expect(calledUrl).toContain('limit=60');
    expect(res.source).toBe('dataset');
  });

  it('throws LibraryApiError on non-ok responses', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    await expect(browseRecords({ source: 'dataset' })).rejects.toThrow(/boom/);
  });

  it('passes "all" through but Articraft treats it as no source filter', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'all', total: 0, source_total: 0, offset: 0, limit: 60,
        record_ids: [], records: [],
        facets: { models: [], sdk_packages: [], agent_harnesses: [], authors: [], categories: [], cost_min: null, cost_max: null },
      }),
    });
    await browseRecords({ source: 'all' });
    expect((global.fetch as any).mock.calls[0][0]).toContain('source=all');
  });
});
```

- [ ] **Step 2: Run test, expect failure.**

```bash
pnpm test -- src/lib/api/library.test.ts
```

Expected: FAIL — `browseRecords is not a function`.

- [ ] **Step 3: Implement `browseRecords`.** Append to `src/lib/api/library.ts`:

```ts
function appendParam(usp: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value)) {
    for (const v of value) usp.append(key, String(v));
  } else {
    usp.set(key, String(value));
  }
}

function serializeBrowseFilters(f: BrowseFilters): string {
  const usp = new URLSearchParams();
  appendParam(usp, 'source', f.source);
  appendParam(usp, 'q', f.q);
  appendParam(usp, 'time', f.time);
  appendParam(usp, 'time_from', f.time_from);
  appendParam(usp, 'time_to', f.time_to);
  appendParam(usp, 'model', f.model);
  appendParam(usp, 'sdk', f.sdk);
  appendParam(usp, 'agent_harness', f.agent_harness);
  appendParam(usp, 'author', f.author);
  appendParam(usp, 'category', f.category);
  appendParam(usp, 'cost_min', f.cost_min);
  appendParam(usp, 'cost_max', f.cost_max);
  appendParam(usp, 'rating', f.rating);
  appendParam(usp, 'secondary_rating', f.secondary_rating);
  appendParam(usp, 'offset', f.offset);
  appendParam(usp, 'limit', f.limit);
  return usp.toString();
}

export async function browseRecords(filters: BrowseFilters): Promise<BrowseResponse> {
  const qs = serializeBrowseFilters(filters);
  const res = await fetch(`${BASE}/records/browse?${qs}`);
  if (!res.ok) {
    throw new LibraryApiError(res.status, await res.text());
  }
  return (await res.json()) as BrowseResponse;
}
```

- [ ] **Step 4: Run test, expect pass.**

```bash
pnpm test -- src/lib/api/library.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/api/library.ts src/lib/api/library.test.ts
git commit -m "feat(cad): browseRecords client + tests"
```

### Task 2.3: Remaining endpoints

**Files:** Modify `src/lib/api/library.ts` and `src/lib/api/library.test.ts`.

- [ ] **Step 1: Add tests** in `library.test.ts`:

```ts
import {
  getSummary, getHistory, fetchText, fileUrl, getStatus,
} from './library';

describe('getSummary', () => {
  it('GETs the summary endpoint', async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ record_id: 'rec_x', title: 't', prompt_preview: 'p', agent_harness: 'articraft', has_traces: false, rating: null, secondary_rating: null, effective_rating: null, author: null, rated_by: null, secondary_rated_by: null, created_at: null, updated_at: null, viewer_asset_updated_at: null, sdk_package: null, provider: null, model_id: null, creator_mode: null, external_agent: null, thinking_level: null, turn_count: null, input_tokens: null, output_tokens: null, total_cost_usd: null, category_slug: null, run_id: null, run_status: null, run_message: null, active_revision_id: null, origin_record_id: null }),
    });
    const s = await getSummary('rec_x');
    expect((global.fetch as any).mock.calls[0][0]).toBe('/api/library/records/rec_x/summary');
    expect(s.record_id).toBe('rec_x');
  });
});

describe('fileUrl', () => {
  it('returns the proxied file URL', () => {
    expect(fileUrl('rec_x', 'model.urdf'))
      .toBe('/api/library/records/rec_x/files/model.urdf');
  });
});
```

- [ ] **Step 2: Run, expect fail.** `pnpm test -- src/lib/api/library.test.ts`

- [ ] **Step 3: Implement.** Append to `src/lib/api/library.ts`:

```ts
export async function getSummary(recordId: string): Promise<RecordSummary> {
  const res = await fetch(`${BASE}/records/${recordId}/summary`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.json();
}

export async function getHistory(recordId: string): Promise<unknown> {
  const res = await fetch(`${BASE}/records/${recordId}/history`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.json();
}

export async function fetchText(recordId: string, path: string): Promise<string> {
  const res = await fetch(`${BASE}/records/${recordId}/text/${path}`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.text();
}

export function fileUrl(recordId: string, path: string): string {
  return `${BASE}/records/${recordId}/files/${path}`;
}

// Sidecar liveness — uses /api/bootstrap which returns the viewer bootstrap blob.
// (The sidecar does not expose /api/status; /health exists but lives outside the
// /api/* prefix and therefore is not reachable through our /api/library/* rewrite.)
export async function getStatus(): Promise<unknown> {
  const res = await fetch(`${BASE}/bootstrap`);
  if (!res.ok) throw new LibraryApiError(res.status, await res.text());
  return res.json();
}
```

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add src/lib/api/library.ts src/lib/api/library.test.ts
git commit -m "feat(cad): summary, history, text, fileUrl, status clients"
```

### Task 2.4: Contract test with live sidecar fixture

**Files:** Create `src/components/cad/__fixtures__/sample-browse-response.json` and `sample-record-summary.json`.

- [ ] **Step 1: With sidecar running, capture two fixtures.** Run from `Phidias-standalone/`:

```bash
mkdir -p src/components/cad/__fixtures__
curl -s 'http://127.0.0.1:8765/api/records/browse?source=dataset&limit=2' \
  > src/components/cad/__fixtures__/sample-browse-response.json

# pick the first record id from the file above
RID=$(jq -r '.records[0].record_id' src/components/cad/__fixtures__/sample-browse-response.json)
curl -s "http://127.0.0.1:8765/api/records/${RID}/summary" \
  > src/components/cad/__fixtures__/sample-record-summary.json
```

- [ ] **Step 2: Add a contract test** in `library.test.ts`:

```ts
import sampleBrowse from '../../components/cad/__fixtures__/sample-browse-response.json';
import sampleSummary from '../../components/cad/__fixtures__/sample-record-summary.json';

describe('schema contract', () => {
  it('BrowseResponse fixture matches the TS type at runtime shape', () => {
    const r = sampleBrowse as BrowseResponse;
    expect(typeof r.source).toBe('string');
    expect(typeof r.total).toBe('number');
    expect(Array.isArray(r.records)).toBe(true);
    expect(typeof r.facets).toBe('object');
    expect(Array.isArray(r.facets.categories)).toBe(true);
  });

  it('RecordSummary fixture has the required fields', () => {
    const s = sampleSummary as RecordSummary;
    expect(typeof s.record_id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.prompt_preview).toBe('string');
    expect(typeof s.agent_harness).toBe('string');
    expect(typeof s.has_traces).toBe('boolean');
  });
});
```

- [ ] **Step 3: Run tests, expect pass.**

- [ ] **Step 4: Commit.**

```bash
git add src/components/cad/__fixtures__ src/lib/api/library.test.ts
git commit -m "test(cad): contract test against live sidecar fixtures"
```

---

## Phase 3 — Grid + Facets

### Task 3.1: URL <-> filters serializer

**Files:** Create `src/lib/cad/filters.ts` and `src/lib/cad/filters.test.ts`.

- [ ] **Step 1: Write failing test.**

```ts
// src/lib/cad/filters.test.ts
import { describe, it, expect } from 'vitest';
import { filtersToSearchParams, searchParamsToFilters } from './filters';
import type { BrowseFilters } from '@/lib/api/library';

describe('filters URL helpers', () => {
  it('round-trips', () => {
    const f: BrowseFilters = {
      source: 'dataset',
      q: 'hinge',
      category: ['fridge', 'oven'],
      rating: ['5'],
      limit: 60,
    };
    const params = filtersToSearchParams(f);
    expect(params.toString()).toContain('source=dataset');
    expect(params.toString()).toContain('q=hinge');
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(f);
  });

  it('defaults to source=dataset when missing', () => {
    const restored = searchParamsToFilters(new URLSearchParams(''));
    expect(restored.source).toBe('dataset');
  });
});
```

- [ ] **Step 2: Run, expect fail.** `pnpm test -- src/lib/cad/filters.test.ts`

- [ ] **Step 3: Implement.**

```ts
// src/lib/cad/filters.ts
import type { BrowseFilters, SourceTab } from '@/lib/api/library';

const ARRAY_KEYS = ['category', 'author', 'agent_harness', 'rating', 'secondary_rating'] as const;
const NUMBER_KEYS = ['cost_min', 'cost_max', 'offset', 'limit'] as const;

export function filtersToSearchParams(f: BrowseFilters): URLSearchParams {
  const usp = new URLSearchParams();
  usp.set('source', f.source);
  if (f.q) usp.set('q', f.q);
  if (f.time) usp.set('time', f.time);
  if (f.time_from) usp.set('time_from', f.time_from);
  if (f.time_to) usp.set('time_to', f.time_to);
  if (f.model) usp.set('model', f.model);
  if (f.sdk) usp.set('sdk', f.sdk);
  for (const key of ARRAY_KEYS) {
    const v = f[key];
    if (Array.isArray(v)) for (const item of v) usp.append(key, item);
  }
  for (const key of NUMBER_KEYS) {
    const v = f[key];
    if (v !== undefined) usp.set(key, String(v));
  }
  return usp;
}

export function searchParamsToFilters(usp: URLSearchParams): BrowseFilters {
  const source = (usp.get('source') as SourceTab) ?? 'dataset';
  const f: BrowseFilters = { source };
  const q = usp.get('q'); if (q) f.q = q;
  const time = usp.get('time'); if (time) f.time = time;
  const tf = usp.get('time_from'); if (tf) f.time_from = tf;
  const tt = usp.get('time_to'); if (tt) f.time_to = tt;
  const model = usp.get('model'); if (model) f.model = model;
  const sdk = usp.get('sdk'); if (sdk) f.sdk = sdk;
  for (const key of ARRAY_KEYS) {
    const arr = usp.getAll(key);
    if (arr.length) (f as any)[key] = arr;
  }
  for (const key of NUMBER_KEYS) {
    const v = usp.get(key);
    if (v !== null) (f as any)[key] = Number(v);
  }
  return f;
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add src/lib/cad/filters.ts src/lib/cad/filters.test.ts
git commit -m "feat(cad): URL <-> filters helpers"
```

### Task 3.2: `CADRecordCard`

**Files:** Create `src/components/cad/CADRecordCard.tsx`, `CADRecordCard.test.tsx`.

- [ ] **Step 1: Write failing test.**

```tsx
// src/components/cad/CADRecordCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CADRecordCard } from './CADRecordCard';
import type { RecordSummary } from '@/lib/api/library';

const sample: RecordSummary = {
  record_id: 'rec_x',
  title: 'A red coffee mug',
  prompt_preview: 'a red coffee mug with a handle',
  rating: 4,
  secondary_rating: null,
  effective_rating: 4,
  author: 'alice',
  rated_by: null,
  secondary_rated_by: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: null,
  viewer_asset_updated_at: null,
  sdk_package: 'sdk',
  provider: 'openai',
  model_id: 'gpt-5.5',
  creator_mode: null,
  external_agent: null,
  agent_harness: 'articraft',
  has_traces: false,
  thinking_level: 'high',
  turn_count: 10,
  input_tokens: 100,
  output_tokens: 50,
  total_cost_usd: 0.05,
  category_slug: 'mugs',
  run_id: null, run_status: null, run_message: null,
  active_revision_id: 'rev_000001',
  origin_record_id: null,
};

describe('CADRecordCard', () => {
  it('shows title, rating, category', () => {
    render(<CADRecordCard record={sample} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('A red coffee mug')).toBeInTheDocument();
    expect(screen.getByText('mugs')).toBeInTheDocument();
    expect(screen.getByLabelText(/rating/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect fail.** `pnpm test -- src/components/cad/CADRecordCard.test.tsx`

- [ ] **Step 3: Implement.**

```tsx
// src/components/cad/CADRecordCard.tsx
'use client';

import { Star } from 'lucide-react';
import { clsx } from 'clsx';
import type { RecordSummary } from '@/lib/api/library';

interface Props {
  record: RecordSummary;
  selected: boolean;
  onSelect: (recordId: string) => void;
}

const GRADIENTS = [
  'from-purple-900/40 to-blue-900/40',
  'from-blue-900/40 to-cyan-900/40',
  'from-amber-900/40 to-orange-900/40',
  'from-emerald-900/40 to-teal-900/40',
];

function hashGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export function CADRecordCard({ record, selected, onSelect }: Props) {
  const gradient = hashGradient(record.category_slug ?? record.record_id);
  return (
    <button
      type="button"
      onClick={() => onSelect(record.record_id)}
      className={clsx(
        'group relative aspect-square w-full overflow-hidden rounded-[10px]',
        'border border-white/10 bg-gradient-to-br backdrop-blur-sm',
        'transition hover:border-white/30',
        gradient,
        selected && 'ring-2 ring-[var(--accent-purple)]',
      )}
    >
      <div className="absolute inset-0 flex items-end p-3">
        <div className="w-full">
          <div className="line-clamp-2 text-left text-sm font-medium text-white">
            {record.title}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
            {record.category_slug && <span>{record.category_slug}</span>}
            {record.effective_rating !== null && (
              <span aria-label={`rating ${record.effective_rating}`} className="flex items-center gap-0.5">
                <Star size={11} className="fill-amber-400 stroke-amber-400" />
                {record.effective_rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add src/components/cad/CADRecordCard.tsx src/components/cad/CADRecordCard.test.tsx
git commit -m "feat(cad): record card component"
```

### Task 3.3: `CADRecordGrid` with infinite scroll

**Files:** Create `src/components/cad/CADRecordGrid.tsx`.

- [ ] **Step 1: Create the component.**

```tsx
// src/components/cad/CADRecordGrid.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browseRecords, type BrowseFilters, type BrowseResponse, type RecordSummary } from '@/lib/api/library';
import { CADRecordCard } from './CADRecordCard';

interface Props {
  filters: BrowseFilters;
  onFacetsUpdate: (facets: BrowseResponse['facets'], total: number) => void;
  onSelect: (recordId: string) => void;
  selectedId: string | null;
}

const PAGE = 60;

export function CADRecordGrid({ filters, onFacetsUpdate, onSelect, selectedId }: Props) {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestKey = JSON.stringify(filters);

  // reset on filter change
  useEffect(() => {
    setRecords([]);
    setOffset(0);
    setTotal(0);
  }, [requestKey]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    if (records.length > 0 && records.length >= total) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await browseRecords({ ...filters, offset, limit: PAGE });
      setRecords((prev) => (offset === 0 ? res.records : [...prev, ...res.records]));
      setTotal(res.total);
      setOffset(offset + res.records.length);
      onFacetsUpdate(res.facets, res.total);
    } catch (e: any) {
      setErr(e.message ?? 'failed');
    } finally {
      setLoading(false);
    }
  }, [filters, offset, loading, records.length, total, onFacetsUpdate]);

  useEffect(() => {
    if (records.length === 0 && !loading) loadMore();
  }, [requestKey, records.length, loading, loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (err) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        <div>
          <p>{err}</p>
          <button className="mt-2 underline" onClick={() => { setOffset(0); setRecords([]); }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!loading && records.length === 0) {
    return <div className="flex h-full items-center justify-center text-slate-500">No records match</div>;
  }

  return (
    <div className="overflow-auto px-4 py-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {records.map((r) => (
          <CADRecordCard key={r.record_id} record={r} selected={selectedId === r.record_id} onSelect={onSelect} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-8" />
      {loading && <div className="py-4 text-center text-slate-500">Loading…</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit.** No standalone unit test (covered by integration via CADLibraryPage smoke test).

```bash
git add src/components/cad/CADRecordGrid.tsx
git commit -m "feat(cad): record grid with infinite scroll"
```

### Task 3.4: Source tabs (Dataset / Workbench / All)

**Files:** Create `src/components/cad/CADSourceTabs.tsx`.

- [ ] **Step 1: Implement.**

```tsx
// src/components/cad/CADSourceTabs.tsx
'use client';

import { clsx } from 'clsx';
import type { SourceTab } from '@/lib/api/library';

const TABS: { value: SourceTab; label: string }[] = [
  { value: 'dataset', label: 'Dataset' },
  { value: 'workbench', label: 'Workbench' },
  { value: 'all', label: 'All' },
];

export function CADSourceTabs({ value, onChange }: { value: SourceTab; onChange: (v: SourceTab) => void }) {
  return (
    <div className="flex gap-1 border-b border-white/10 px-4 py-2">
      {TABS.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm transition',
            value === t.value
              ? 'bg-[var(--accent-purple)]/20 text-white'
              : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/cad/CADSourceTabs.tsx
git commit -m "feat(cad): source tabs (dataset/workbench/all)"
```

### Task 3.5: `CADFacetSidebar`

**Files:** Create `src/components/cad/CADFacetSidebar.tsx`.

- [ ] **Step 1: Implement.** This is the longest component; keep markup simple.

```tsx
// src/components/cad/CADFacetSidebar.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { BrowseFacets, BrowseFilters } from '@/lib/api/library';

interface Props {
  filters: BrowseFilters;
  facets: BrowseFacets | null;
  onChange: (next: BrowseFilters) => void;
}

function toggleArray(arr: string[] | undefined, value: string): string[] {
  const s = new Set(arr ?? []);
  if (s.has(value)) s.delete(value); else s.add(value);
  return Array.from(s);
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 py-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-3 py-1 space-y-1">{children}</div>}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 hover:text-white">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3 w-3 accent-[var(--accent-purple)]" />
      <span className="truncate">{label}</span>
    </label>
  );
}

export function CADFacetSidebar({ filters, facets, onChange }: Props) {
  return (
    <aside className="h-full w-60 overflow-y-auto border-r border-white/5 bg-[var(--bg-card)]/60 backdrop-blur-sm">
      <div className="px-3 py-3">
        <input
          type="text"
          placeholder="Search…"
          value={filters.q ?? ''}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      <Section title="Category">
        {(facets?.categories ?? []).slice(0, 30).map((c) => (
          <Check
            key={c}
            label={c}
            checked={(filters.category ?? []).includes(c)}
            onChange={() => onChange({ ...filters, category: toggleArray(filters.category, c) })}
          />
        ))}
      </Section>

      <Section title="Rating">
        {[5, 4, 3, 2, 1].map((n) => (
          <Check
            key={n}
            label={'★'.repeat(n) + '☆'.repeat(5 - n)}
            checked={(filters.rating ?? []).includes(String(n))}
            onChange={() => onChange({ ...filters, rating: toggleArray(filters.rating, String(n)) })}
          />
        ))}
      </Section>

      <Section title="Model" defaultOpen={false}>
        {(facets?.models ?? []).map((m) => (
          <Check
            key={m}
            label={m}
            checked={filters.model === m}
            onChange={() => onChange({ ...filters, model: filters.model === m ? undefined : m })}
          />
        ))}
      </Section>

      <Section title="Author" defaultOpen={false}>
        {(facets?.authors ?? []).map((a) => (
          <Check
            key={a}
            label={a}
            checked={(filters.author ?? []).includes(a)}
            onChange={() => onChange({ ...filters, author: toggleArray(filters.author, a) })}
          />
        ))}
      </Section>

      <Section title="Cost (USD)" defaultOpen={false}>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="number"
            placeholder="min"
            step="0.01"
            value={filters.cost_min ?? ''}
            onChange={(e) => onChange({ ...filters, cost_min: e.target.value ? Number(e.target.value) : undefined })}
            className="w-16 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-white"
          />
          <span>—</span>
          <input
            type="number"
            placeholder="max"
            step="0.01"
            value={filters.cost_max ?? ''}
            onChange={(e) => onChange({ ...filters, cost_max: e.target.value ? Number(e.target.value) : undefined })}
            className="w-16 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-white"
          />
        </div>
      </Section>

      <Section title="Time" defaultOpen={false}>
        <select
          value={filters.time ?? ''}
          onChange={(e) => onChange({ ...filters, time: e.target.value || undefined })}
          className="w-full rounded border border-white/10 bg-black/30 px-1 py-0.5 text-sm text-white"
        >
          <option value="">Any</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </Section>

      <Section title="SDK" defaultOpen={false}>
        {(facets?.sdk_packages ?? []).map((s) => (
          <Check
            key={s}
            label={s}
            checked={filters.sdk === s}
            onChange={() => onChange({ ...filters, sdk: filters.sdk === s ? undefined : s })}
          />
        ))}
      </Section>
    </aside>
  );
}
```

- [ ] **Step 2: Visual smoke check** (filters need wire-up in next task; render with empty `facets` first).

- [ ] **Step 3: Commit.**

```bash
git add src/components/cad/CADFacetSidebar.tsx
git commit -m "feat(cad): facet sidebar"
```

### Task 3.6: Compose `CADLibraryPage` with URL state

**Files:** Modify `src/components/cad/CADLibraryPage.tsx`.

- [ ] **Step 1: Replace placeholder.**

```tsx
// src/components/cad/CADLibraryPage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CADSourceTabs } from './CADSourceTabs';
import { CADFacetSidebar } from './CADFacetSidebar';
import { CADRecordGrid } from './CADRecordGrid';
import { filtersToSearchParams, searchParamsToFilters } from '@/lib/cad/filters';
import type { BrowseFacets, BrowseFilters, SourceTab } from '@/lib/api/library';

export function CADLibraryPage() {
  const router = useRouter();
  const usp = useSearchParams();
  const filters = useMemo<BrowseFilters>(() => searchParamsToFilters(usp), [usp]);
  const [facets, setFacets] = useState<BrowseFacets | null>(null);

  const setFilters = (next: BrowseFilters) => {
    const params = filtersToSearchParams(next);
    router.replace(`/workspace/cad?${params.toString()}`);
  };

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <CADFacetSidebar filters={filters} facets={facets} onChange={setFilters} />
      <div className="flex flex-1 flex-col">
        <CADSourceTabs value={filters.source} onChange={(v: SourceTab) => setFilters({ ...filters, source: v })} />
        <div className="flex-1 overflow-hidden">
          <CADRecordGrid
            filters={filters}
            onFacetsUpdate={(f) => setFacets(f)}
            onSelect={(id) => router.push(`/workspace/cad/${id}`)}
            selectedId={null}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser.** Open `/workspace/cad`. Confirm: tab switch reloads grid, search input updates URL, facet checkboxes survive page reload.

- [ ] **Step 3: Commit.**

```bash
git add src/components/cad/CADLibraryPage.tsx
git commit -m "feat(cad): compose library page with URL state"
```

---

## Phase 4 — Detail Route + Inspector

### Task 4.1: Detail route shell

**Files:** Create `src/app/workspace/cad/[recordId]/page.tsx` and `src/components/cad/CADDetailPage.tsx`.

- [ ] **Step 1: Route file.**

```tsx
// src/app/workspace/cad/[recordId]/page.tsx
'use client';

import { use } from 'react';
import { CADDetailPage } from '@/components/cad/CADDetailPage';

export default function Page({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = use(params);
  return <CADDetailPage recordId={recordId} />;
}
```

- [ ] **Step 2: Placeholder detail page.**

```tsx
// src/components/cad/CADDetailPage.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSummary(recordId).then(setSummary).catch((e) => setErr(e.message));
  }, [recordId]);

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          <Link href="/workspace/cad" className="text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm text-white">{summary?.title ?? recordId}</span>
        </header>
        <div className="flex flex-1 items-center justify-center text-slate-500">
          {err ?? '3D viewer mounts here (Phase 5)'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify.** Click a card → URL navigates → header shows title.

- [ ] **Step 4: Commit.**

```bash
git add src/app/workspace/cad/[recordId]/page.tsx src/components/cad/CADDetailPage.tsx
git commit -m "feat(cad): detail route shell"
```

### Task 4.2: Inspector — Summary tab

**Files:** Create `src/components/cad/CADInspector.tsx`. Modify `CADDetailPage.tsx`.

- [ ] **Step 1: Component.**

```tsx
// src/components/cad/CADInspector.tsx
'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { fetchText, type RecordSummary } from '@/lib/api/library';

type Tab = 'summary' | 'code' | 'prompt' | 'joints';

const TABS: { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'code', label: 'Code' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'joints', label: 'Joints' },
];

export function CADInspector({
  recordId,
  summary,
  jointsSlot,
}: { recordId: string; summary: RecordSummary | null; jointsSlot: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>('summary');
  return (
    <aside className="flex h-full w-[340px] flex-col border-l border-white/5 bg-[var(--bg-card)]/60 backdrop-blur-sm">
      <div className="flex border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx(
              'flex-1 py-2 text-xs uppercase tracking-wide',
              tab === t.value ? 'text-white' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">
        {tab === 'summary' && summary && <SummaryTab summary={summary} />}
        {tab === 'code' && <TextTab recordId={recordId} path={`revisions/${summary?.active_revision_id ?? 'rev_000001'}/model.py`} />}
        {tab === 'prompt' && <TextTab recordId={recordId} path={`revisions/${summary?.active_revision_id ?? 'rev_000001'}/prompt.txt`} />}
        {tab === 'joints' && jointsSlot}
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1">
      <span className="text-slate-500">{k}</span>
      <span className="text-right text-slate-200">{v}</span>
    </div>
  );
}

function SummaryTab({ summary }: { summary: RecordSummary }) {
  return (
    <div className="space-y-1">
      <Row k="ID" v={<code className="text-xs">{summary.record_id}</code>} />
      <Row k="Title" v={summary.title} />
      <Row k="Category" v={summary.category_slug ?? '—'} />
      <Row k="Rating" v={summary.effective_rating?.toFixed(1) ?? '—'} />
      <Row k="Author" v={summary.author ?? '—'} />
      <Row k="Provider" v={summary.provider ?? '—'} />
      <Row k="Model" v={summary.model_id ?? '—'} />
      <Row k="Cost (USD)" v={summary.total_cost_usd?.toFixed(4) ?? '—'} />
      <Row k="Created" v={summary.created_at ?? '—'} />
    </div>
  );
}

function TextTab({ recordId, path }: { recordId: string; path: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setText(null); setErr(null);
    fetchText(recordId, path).then(setText).catch((e) => setErr(e.message));
  }, [recordId, path]);
  if (err) return <div className="text-red-400">{err}</div>;
  if (text === null) return <div className="text-slate-500">Loading…</div>;
  return <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{text}</pre>;
}
```

- [ ] **Step 2: Wire into `CADDetailPage`.** Replace its body:

```tsx
// src/components/cad/CADDetailPage.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';
import { CADInspector } from './CADInspector';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSummary(recordId).then(setSummary).catch((e) => setErr(e.message));
  }, [recordId]);

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          <Link href="/workspace/cad" className="text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm text-white">{summary?.title ?? recordId}</span>
        </header>
        <div className="flex flex-1 items-center justify-center text-slate-500">
          {err ?? '3D viewer mounts here (Phase 5)'}
        </div>
      </div>
      <CADInspector recordId={recordId} summary={summary} jointsSlot={<div className="text-slate-500">Joints arrive in Phase 6.</div>} />
    </div>
  );
}
```

- [ ] **Step 3: Verify** that summary fields render and Code / Prompt tabs load text.

- [ ] **Step 4: Commit.**

```bash
git add src/components/cad/CADInspector.tsx src/components/cad/CADDetailPage.tsx
git commit -m "feat(cad): inspector with summary/code/prompt tabs"
```

---

## Phase 5 — URDF Rendering

This is the riskiest phase. Branch decision based on Task 0.1 findings:

- **Port branch** (default): copy Articraft `urdf-parser.ts` + relevant slices of `useUrdfLoader.ts` and rewrite mesh URL resolution.
- **Fallback branch** (only if Task 0.1 declared the port too entangled): `pnpm add urdf-loader` and write a thin shim that accepts a mesh URL resolver callback.

Follow the **Port branch** unless Task 0.1 said otherwise.

### Task 5.1: URDF types

**Files:** Create `src/lib/three/urdf/types.ts`.

- [ ] **Step 1: Implement.**

```ts
// src/lib/three/urdf/types.ts
import * as THREE from 'three';

export type JointType = 'fixed' | 'revolute' | 'prismatic' | 'continuous' | 'planar' | 'floating';

export interface JointSpec {
  name: string;
  type: JointType;
  parent: string;
  child: string;
  axis: THREE.Vector3;
  lower: number;
  upper: number;
  origin: THREE.Matrix4;
}

export interface LinkSpec {
  name: string;
  mesh?: { url: string; scale: THREE.Vector3; color?: THREE.Color };
}

export interface RobotSpec {
  name: string;
  links: LinkSpec[];
  joints: JointSpec[];
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/lib/three/urdf/types.ts
git commit -m "feat(cad): urdf type stubs"
```

### Task 5.2: `MeshResolver` with TDD

**Files:** Create `src/lib/three/urdf/MeshResolver.ts`, `MeshResolver.test.ts`.

- [ ] **Step 1: Write failing test.**

```ts
// src/lib/three/urdf/MeshResolver.test.ts
import { describe, it, expect } from 'vitest';
import { MeshResolver } from './MeshResolver';

describe('MeshResolver', () => {
  const r = new MeshResolver({ baseUrl: '/api/library/records/rec_x' });

  it('resolves package:// to proxied files endpoint', () => {
    expect(r.resolve('package://meshes/foo.stl'))
      .toBe('/api/library/records/rec_x/files/meshes/foo.stl');
  });

  it('resolves file:// stripping the scheme', () => {
    expect(r.resolve('file:///abs/meshes/foo.stl'))
      .toBe('/api/library/records/rec_x/files/abs/meshes/foo.stl');
  });

  it('resolves relative paths against the URDF directory', () => {
    expect(r.resolve('assets/foo.glb', 'model.urdf'))
      .toBe('/api/library/records/rec_x/files/assets/foo.glb');
  });
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement.**

```ts
// src/lib/three/urdf/MeshResolver.ts
export interface MeshResolverOptions {
  baseUrl: string;
}

export class MeshResolver {
  constructor(private opts: MeshResolverOptions) {}

  resolve(meshPath: string, urdfPath?: string): string {
    const base = this.opts.baseUrl.replace(/\/$/, '');
    const filesBase = `${base}/files`;

    if (meshPath.startsWith('package://')) {
      return `${filesBase}/${meshPath.slice('package://'.length)}`;
    }
    if (meshPath.startsWith('file://')) {
      const stripped = meshPath.slice('file://'.length).replace(/^\/+/, '');
      return `${filesBase}/${stripped}`;
    }
    if (meshPath.startsWith('http://') || meshPath.startsWith('https://')) {
      return meshPath;
    }
    if (urdfPath) {
      const dir = urdfPath.substring(0, urdfPath.lastIndexOf('/'));
      return `${filesBase}/${dir}/${meshPath}`;
    }
    return `${filesBase}/${meshPath}`;
  }
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add src/lib/three/urdf/MeshResolver.ts src/lib/three/urdf/MeshResolver.test.ts
git commit -m "feat(cad): mesh path resolver"
```

### Task 5.3: Port `UrdfLoader` from Articraft

**Files:** Create `src/lib/three/urdf/UrdfLoader.ts` and `UrdfLoader.test.ts`. Source: `/home/pegaai/code/articraft/viewer/web/src/components/viewer3d/urdf-parser.ts`.

- [ ] **Step 1: Read the Articraft source file fully.** Identify the exported parser function (likely named `parseUrdf` or similar). Map its dependencies — list them at the top of `UrdfLoader.ts` as a comment.

- [ ] **Step 2: Copy the file content into `src/lib/three/urdf/UrdfLoader.ts`,** then surgically modify:
  - All mesh URL construction must go through `MeshResolver.resolve()` (inject a resolver via the loader constructor).
  - Remove any imports that point outside `viewer3d/`. If a util is small, inline it. If large, ask in PR review whether it merits its own file.
  - Adapt loader I/O: replace Articraft's direct `fetch` with one that uses the injected `baseUrl` from `MeshResolver`.

- [ ] **Step 3: Public surface to expose** (drives the test in step 4):

```ts
export interface UrdfLoaderOptions {
  baseUrl: string;        // e.g. /api/library/records/<id>
}

export class UrdfLoader {
  constructor(opts: UrdfLoaderOptions);
  // Loads the URDF, fetches all referenced meshes, returns a UrdfRobot.
  load(urdfPath: string): Promise<UrdfRobot>;
}
```

(`UrdfRobot` lives in Task 5.4.)

- [ ] **Step 4: Write a minimal test using a fixture URDF.** Create `src/components/cad/__fixtures__/sample-urdf.xml` (write a 2-link, 1-revolute-joint URDF by hand — see snippet below). Stub `fetch` to return it.

```xml
<!-- src/components/cad/__fixtures__/sample-urdf.xml -->
<robot name="test">
  <link name="base"/>
  <link name="arm"/>
  <joint name="hinge" type="revolute">
    <parent link="base"/>
    <child link="arm"/>
    <origin xyz="0 0 0.5" rpy="0 0 0"/>
    <axis xyz="0 0 1"/>
    <limit lower="-1.57" upper="1.57" effort="0" velocity="0"/>
  </joint>
</robot>
```

```ts
// src/lib/three/urdf/UrdfLoader.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UrdfLoader } from './UrdfLoader';
import sampleUrdf from '../../components/cad/__fixtures__/sample-urdf.xml?raw';

describe('UrdfLoader', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.urdf')) {
        return Promise.resolve({ ok: true, text: async () => sampleUrdf } as Response);
      }
      return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response);
    });
  });

  it('parses a minimal URDF into a robot with one joint', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    expect(robot.joints).toHaveLength(1);
    expect(robot.joints[0].name).toBe('hinge');
    expect(robot.joints[0].type).toBe('revolute');
  });
});
```

If `?raw` import doesn't work in vitest, the fixture can be loaded via `fs.readFileSync` in the test setup instead.

- [ ] **Step 5: Run the test until it passes.** This may require multiple iterations of fixing the port.

- [ ] **Step 6: Commit each iteration that gets meaningfully closer.** When passing, final commit:

```bash
git add src/lib/three/urdf/UrdfLoader.ts src/lib/three/urdf/UrdfLoader.test.ts src/components/cad/__fixtures__/sample-urdf.xml
git commit -m "feat(cad): port Articraft URDF parser into Phidias"
```

### Task 5.4: `UrdfRobot` kinematics wrapper

**Files:** Create `src/lib/three/urdf/UrdfRobot.ts`. Source: `/home/pegaai/code/articraft/viewer/web/src/components/viewer3d/useUrdfLoader.ts` (kinematics bits only).

- [ ] **Step 1: Read the Articraft hook source.** Identify which functions handle joint angles and Object3D updates. Strip out the React-specific code; keep only the framework-agnostic class/utilities.

- [ ] **Step 2: Implement `UrdfRobot`** with public surface:

```ts
// src/lib/three/urdf/UrdfRobot.ts
import * as THREE from 'three';
import type { JointSpec, LinkSpec, RobotSpec } from './types';

export class UrdfRobot {
  public readonly root: THREE.Group;
  public readonly joints: JointSpec[];
  public readonly links: LinkSpec[];

  private jointObjects: Map<string, THREE.Object3D> = new Map();

  constructor(spec: RobotSpec, root: THREE.Group, jointObjects: Map<string, THREE.Object3D>) {
    this.root = root;
    this.joints = spec.joints;
    this.links = spec.links;
    this.jointObjects = jointObjects;
  }

  setJointAngle(name: string, value: number): void {
    const joint = this.joints.find((j) => j.name === name);
    const obj = this.jointObjects.get(name);
    if (!joint || !obj) return;
    if (joint.type === 'revolute' || joint.type === 'continuous') {
      // reset to joint origin then apply axis-angle rotation
      obj.matrix.copy(joint.origin);
      obj.matrix.multiply(new THREE.Matrix4().makeRotationAxis(joint.axis, value));
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    } else if (joint.type === 'prismatic') {
      obj.matrix.copy(joint.origin);
      const t = new THREE.Vector3().copy(joint.axis).multiplyScalar(value);
      obj.matrix.multiply(new THREE.Matrix4().makeTranslation(t.x, t.y, t.z));
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    }
    obj.updateMatrixWorld(true);
  }

  dispose(): void {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const m = child.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      }
    });
  }
}
```

(`UrdfLoader.load()` must construct and return one of these — go back and complete that wiring if not already done.)

- [ ] **Step 3: Add a test** that exercises `setJointAngle` against the fixture URDF. Extend `UrdfLoader.test.ts`:

```ts
it('setJointAngle rotates the child link', async () => {
  const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
  const robot = await loader.load('revisions/rev_000001/model_visual.urdf');
  robot.setJointAngle('hinge', Math.PI / 4);
  // After rotation, the child object's quaternion should not be identity
  const obj = robot.root.getObjectByName('arm');
  expect(obj).toBeDefined();
  expect(obj!.quaternion.equals(new (await import('three')).Quaternion())).toBe(false);
});
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add src/lib/three/urdf/UrdfRobot.ts src/lib/three/urdf/UrdfLoader.test.ts
git commit -m "feat(cad): UrdfRobot with setJointAngle and dispose"
```

### Task 5.5: `UrdfModel` R3F wrapper

**Files:** Create `src/components/cad/UrdfModel.tsx`.

- [ ] **Step 1: Implement.**

```tsx
// src/components/cad/UrdfModel.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { UrdfLoader } from '@/lib/three/urdf/UrdfLoader';
import { UrdfRobot } from '@/lib/three/urdf/UrdfRobot';
import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  recordId: string;
  urdfPath: string;
  pose: Record<string, number>;
  onJointsReady?: (joints: JointSpec[]) => void;
  onError?: (msg: string) => void;
}

export function UrdfModel({ recordId, urdfPath, pose, onJointsReady, onError }: Props) {
  const [robot, setRobot] = useState<UrdfRobot | null>(null);
  const robotRef = useRef<UrdfRobot | null>(null);

  useEffect(() => {
    let cancelled = false;
    new UrdfLoader({ baseUrl: `/api/library/records/${recordId}` })
      .load(urdfPath)
      .then((r) => {
        if (cancelled) { r.dispose(); return; }
        setRobot(r);
        robotRef.current = r;
        onJointsReady?.(r.joints);
      })
      .catch((e) => onError?.(e.message ?? String(e)));
    return () => {
      cancelled = true;
      robotRef.current?.dispose();
      robotRef.current = null;
    };
  }, [recordId, urdfPath]);

  useEffect(() => {
    if (!robot) return;
    for (const [name, angle] of Object.entries(pose)) {
      robot.setJointAngle(name, angle);
    }
  }, [robot, pose]);

  return robot ? <primitive object={robot.root} /> : null;
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/cad/UrdfModel.tsx
git commit -m "feat(cad): UrdfModel R3F primitive wrapper"
```

### Task 5.6: `CADViewer` Canvas

**Files:** Create `src/components/cad/CADViewer.tsx`. Modify `CADDetailPage.tsx`.

- [ ] **Step 1: Viewer.**

```tsx
// src/components/cad/CADViewer.tsx
'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { UrdfModel } from './UrdfModel';
import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  recordId: string;
  urdfPath: string;
  pose: Record<string, number>;
  onJointsReady: (joints: JointSpec[]) => void;
}

export function CADViewer({ recordId, urdfPath, pose, onJointsReady }: Props) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [1.5, 1.2, 1.5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="studio" />
        <OrbitControls makeDefault />
        <UrdfModel
          recordId={recordId}
          urdfPath={urdfPath}
          pose={pose}
          onJointsReady={onJointsReady}
          onError={setErr}
        />
      </Canvas>
      {err && (
        <div className="absolute inset-x-3 top-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `CADDetailPage`.** Replace the placeholder body.

```tsx
// src/components/cad/CADDetailPage.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';
import { CADInspector } from './CADInspector';
import { CADViewer } from './CADViewer';
import type { JointSpec } from '@/lib/three/urdf/types';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [joints, setJoints] = useState<JointSpec[]>([]);

  useEffect(() => {
    getSummary(recordId).then(setSummary).catch(() => {});
  }, [recordId]);

  // Materialization cache is flat per record; the URDF is always 'model.urdf'.
  const urdfPath = 'model.urdf';

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          <Link href="/workspace/cad" className="text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm text-white">{summary?.title ?? recordId}</span>
        </header>
        <CADViewer recordId={recordId} urdfPath={urdfPath} pose={{}} onJointsReady={setJoints} />
      </div>
      <CADInspector
        recordId={recordId}
        summary={summary}
        jointsSlot={<div className="text-slate-500">Joints arrive in Phase 6 ({joints.length} found).</div>}
      />
    </div>
  );
}
```

- [ ] **Step 3: Visual check.** Open a real record's detail page; URDF should render. If it errors with 404 for a mesh file, debug `MeshResolver` against the actual mesh path used in that URDF.

- [ ] **Step 4: Commit.**

```bash
git add src/components/cad/CADViewer.tsx src/components/cad/CADDetailPage.tsx
git commit -m "feat(cad): mount URDF in R3F canvas on detail page"
```

---

## Phase 6 — Joint Controls

### Task 6.1: Pose URL helpers

**Files:** Create `src/lib/cad/pose.ts` and `pose.test.ts`.

- [ ] **Step 1: Test.**

```ts
// src/lib/cad/pose.test.ts
import { describe, it, expect } from 'vitest';
import { encodePose, decodePose } from './pose';

describe('pose URL helpers', () => {
  it('round-trips', () => {
    const pose = { hinge: 0.5, slider: -0.25 };
    expect(decodePose(encodePose(pose))).toEqual(pose);
  });
  it('decodes empty', () => {
    expect(decodePose('')).toEqual({});
    expect(decodePose(undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Implement.**

```ts
// src/lib/cad/pose.ts
export function encodePose(pose: Record<string, number>): string {
  if (Object.keys(pose).length === 0) return '';
  return btoa(JSON.stringify(pose));
}

export function decodePose(encoded: string | null | undefined): Record<string, number> {
  if (!encoded) return {};
  try {
    return JSON.parse(atob(encoded)) as Record<string, number>;
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Run, expect pass.**

- [ ] **Step 4: Commit.**

```bash
git add src/lib/cad/pose.ts src/lib/cad/pose.test.ts
git commit -m "feat(cad): pose URL encode/decode"
```

### Task 6.2: `CADJointControls`

**Files:** Create `src/components/cad/CADJointControls.tsx` and `CADJointControls.test.tsx`.

- [ ] **Step 1: Test.**

```tsx
// src/components/cad/CADJointControls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CADJointControls } from './CADJointControls';
import type { JointSpec } from '@/lib/three/urdf/types';
import * as THREE from 'three';

const joints: JointSpec[] = [
  {
    name: 'hinge',
    type: 'revolute',
    parent: 'base',
    child: 'arm',
    axis: new THREE.Vector3(0, 0, 1),
    lower: -Math.PI / 2,
    upper: Math.PI / 2,
    origin: new THREE.Matrix4(),
  },
];

describe('CADJointControls', () => {
  it('renders a slider per joint and emits onChange', () => {
    const onChange = vi.fn();
    render(<CADJointControls joints={joints} pose={{}} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: /hinge/i });
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith({ hinge: 0.5 });
  });
});
```

- [ ] **Step 2: Implement.**

```tsx
// src/components/cad/CADJointControls.tsx
'use client';

import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  joints: JointSpec[];
  pose: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

export function CADJointControls({ joints, pose, onChange }: Props) {
  const movable = joints.filter((j) => j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous');
  if (movable.length === 0) return <div className="text-slate-500">No movable joints.</div>;
  return (
    <div className="space-y-3">
      {movable.map((j) => {
        const value = pose[j.name] ?? 0;
        const span = j.upper - j.lower;
        const step = span > 0 ? span / 200 : 0.01;
        return (
          <div key={j.name}>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">{j.name}</span>
              <span>{value.toFixed(2)}</span>
            </div>
            <input
              type="range"
              role="slider"
              aria-label={j.name}
              min={j.lower}
              max={j.upper}
              step={step}
              value={value}
              onChange={(e) => onChange({ ...pose, [j.name]: Number(e.target.value) })}
              className="w-full accent-[var(--accent-purple)]"
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run test, expect pass.**

- [ ] **Step 4: Commit.**

```bash
git add src/components/cad/CADJointControls.tsx src/components/cad/CADJointControls.test.tsx
git commit -m "feat(cad): joint slider component"
```

### Task 6.3: Wire pose state into detail page

**Files:** Modify `src/components/cad/CADDetailPage.tsx`.

- [ ] **Step 1: Replace body** to keep `pose` in URL.

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSummary, type RecordSummary } from '@/lib/api/library';
import { CADInspector } from './CADInspector';
import { CADViewer } from './CADViewer';
import { CADJointControls } from './CADJointControls';
import { decodePose, encodePose } from '@/lib/cad/pose';
import type { JointSpec } from '@/lib/three/urdf/types';

export function CADDetailPage({ recordId }: { recordId: string }) {
  const router = useRouter();
  const usp = useSearchParams();
  const pose = decodePose(usp.get('pose'));
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [joints, setJoints] = useState<JointSpec[]>([]);

  useEffect(() => {
    getSummary(recordId).then(setSummary).catch(() => {});
  }, [recordId]);

  const setPose = (next: Record<string, number>) => {
    const encoded = encodePose(next);
    const params = new URLSearchParams(usp.toString());
    if (encoded) params.set('pose', encoded);
    else params.delete('pose');
    router.replace(`/workspace/cad/${recordId}?${params.toString()}`);
  };

  const urdfPath = 'model.urdf';

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          <Link href="/workspace/cad" className="text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm text-white">{summary?.title ?? recordId}</span>
        </header>
        <CADViewer recordId={recordId} urdfPath={urdfPath} pose={pose} onJointsReady={setJoints} />
      </div>
      <CADInspector
        recordId={recordId}
        summary={summary}
        jointsSlot={<CADJointControls joints={joints} pose={pose} onChange={setPose} />}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify** that dragging a slider rotates the model and updates the URL. Refresh keeps the pose.

- [ ] **Step 3: Commit.**

```bash
git add src/components/cad/CADDetailPage.tsx
git commit -m "feat(cad): pose state in URL with live joint controls"
```

---

## Phase 7 — Failure Handling

### Task 7.1: Sidecar liveness banner

**Files:** Create `src/components/cad/CADEmptyState.tsx`. Modify `CADLibraryPage.tsx`.

- [ ] **Step 1: Implement empty state.**

```tsx
// src/components/cad/CADEmptyState.tsx
'use client';

export function CADEmptyState({ title, hint, retry }: { title: string; hint?: string; retry?: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)] text-center">
      <div className="max-w-md space-y-2 rounded-md border border-white/10 bg-[var(--bg-card)]/60 px-6 py-5 backdrop-blur-sm">
        <p className="text-white">{title}</p>
        {hint && <p className="text-sm text-slate-400">{hint}</p>}
        {retry && (
          <button onClick={retry} className="rounded-md bg-[var(--accent-purple)]/20 px-3 py-1 text-sm text-white hover:bg-[var(--accent-purple)]/30">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Probe sidecar on mount.** In `CADLibraryPage.tsx`, before returning the layout, gate on a status check:

```tsx
import { getStatus } from '@/lib/api/library';
import { CADEmptyState } from './CADEmptyState';

// inside CADLibraryPage:
const [serviceUp, setServiceUp] = useState<boolean | null>(null);
const probe = () => getStatus().then(() => setServiceUp(true)).catch(() => setServiceUp(false));
useEffect(() => { probe(); }, []);
if (serviceUp === null) return <CADEmptyState title="Connecting…" />;
if (serviceUp === false) {
  return (
    <CADEmptyState
      title="Library service unavailable"
      hint="Start it with: uvicorn viewer.api.app:app --host 127.0.0.1 --port 8765"
      retry={() => { setServiceUp(null); probe(); }}
    />
  );
}
```

- [ ] **Step 3: Test by stopping the sidecar** in its terminal and reloading the page — the empty state must appear.

- [ ] **Step 4: Commit.**

```bash
git add src/components/cad/CADEmptyState.tsx src/components/cad/CADLibraryPage.tsx
git commit -m "feat(cad): sidecar liveness probe with retry"
```

### Task 7.2: Lint, format, typecheck pass

**Files:** none (verification only).

- [ ] **Step 1: Run all the things.**

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
```

Expected: all green. Fix anything red.

- [ ] **Step 2: Commit any fixes** with a `chore(cad): lint/typecheck cleanup` message.

---

## Phase 8 — E2E Happy Path

### Task 8.1: Playwright spec

**Files:** Create `e2e/cad-library.spec.ts`.

- [ ] **Step 1: Use the test record id** captured by Task 0.2: `rec_an-nvidia-gb300-nvl72-server-rack-a-tall-enclose_20260518_055942_556781_2acac014`.

- [ ] **Step 2: Write the spec.**

```ts
// e2e/cad-library.spec.ts
import { test, expect } from '@playwright/test';

const TEST_RECORD_ID = 'rec_an-nvidia-gb300-nvl72-server-rack-a-tall-enclose_20260518_055942_556781_2acac014';

test.describe('CAD library', () => {
  test('grid loads, detail opens, joint slider moves model', async ({ page }) => {
    await page.goto('/workspace/cad');

    // CAD tab is in the sidebar
    await expect(page.getByRole('link', { name: 'CAD' })).toBeVisible();

    // Grid loads at least one card
    await expect(page.locator('button[class*="aspect-square"]').first()).toBeVisible({ timeout: 15_000 });

    // Open a known record directly
    await page.goto(`/workspace/cad/${TEST_RECORD_ID}`);

    // Canvas mounts
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

    // Click the Joints tab
    await page.getByRole('button', { name: /^Joints$/ }).click();

    // At least one slider exists
    const slider = page.getByRole('slider').first();
    await expect(slider).toBeVisible({ timeout: 10_000 });

    // Drag the slider; URL gains a pose param
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = '0.3';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page).toHaveURL(/pose=/);
  });
});
```

- [ ] **Step 3: Ensure the sidecar is running** before invoking playwright. Run:

```bash
pnpm e2e -- e2e/cad-library.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add e2e/cad-library.spec.ts
git commit -m "test(cad): happy-path E2E"
```

### Task 8.2: Optional Playwright fixture for auto-starting the sidecar

**Files:** Modify `playwright.config.ts`.

- [ ] **Step 1: Inspect existing `webServer` config.** If only Next.js is started, add a second entry for the sidecar:

```ts
webServer: [
  { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
  {
    command: 'cd ../../code/articraft && uv run uvicorn viewer.api.app:app --host 127.0.0.1 --port 8765',
    url: 'http://127.0.0.1:8765/api/status',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
],
```

(Adjust the relative path to match your articraft checkout location.)

- [ ] **Step 2: Re-run E2E without manually starting the sidecar.** It should now auto-launch.

- [ ] **Step 3: Commit.**

```bash
git add playwright.config.ts
git commit -m "test(cad): auto-start sidecar in Playwright"
```

---

## Final Verification Checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm test` all unit + component + contract tests pass
- [ ] `pnpm e2e -- e2e/cad-library.spec.ts` passes
- [ ] Sidebar has the CAD icon at the bottom
- [ ] `/workspace/cad` lists records; source tabs work; facets refine results; URL state survives refresh; share-link reproduces filters
- [ ] Clicking a card navigates to `/workspace/cad/[recordId]`; back arrow returns
- [ ] Detail page renders the URDF; joint sliders rotate the model; pose persists across refresh
- [ ] Stopping the sidecar shows the empty state with a working Retry
- [ ] No mention of "Articraft" in any UI string

---

## Out of Scope (Follow-up plans)

- Rating / promote / collection edits (write surface)
- Thumbnail pre-generation pipeline
- Segmentation colors, surface sampling, render-mode toggle, split-view
- Cross-machine deployment, Docker, auto-start sidecar in production builds
- i18n

---

## Spike Findings

<!--
Task 0.1 findings (read-only spike, 2026-05-21)

VERDICT: refactor-mesh-resolver-only

The urdf-parser.ts is entirely standalone — no imports outside `three` itself. It
can be copied into Phidias with zero changes except stripping the
`rewriteAbsoluteMeshFilenames` helper (Phidias assets will never use package://
paths). useUrdfLoader.ts has five local sibling dependencies that ARE
Articraft-specific and must be replaced or re-implemented:

  import { buildRobotSceneGraph, collisionColorForIndex }   from './scene-graph-builder';
  import { computeFit, preserveViewAcrossModelSwitch, updateCameraClipping } from './camera-utils';
  import { positionGroundHelpers }                          from './lighting';
  import { loadGeometryObject }                             from './geometry-loader';
  import { depthBiasForOrdinal, resolveVisualMaterialSpec } from './materials';

geometry-loader.ts (which owns actual mesh fetching) is also self-contained —
its only external deps are `three/addons/loaders/GLTFLoader.js` and
`three/addons/loaders/OBJLoader.js` (both already in Phidias via drei/three).
It can be ported as-is. The other siblings (scene-graph-builder, camera-utils,
lighting, materials) encapsulate Articraft-specific scene management and will
need re-implementation or a simplified Phidias-flavoured substitute.

MESH URL PATTERN (exact):
The URDF is fetched from:
  `${baseFileUrl}/model.urdf`        -- via new URL(..., window.location.origin)

where baseFileUrl is constructed in ViewerShell.tsx as:
  `/api/records/${selection.recordId}/files`

Individual mesh files are resolved in geometry-loader.ts as:
  url = baseUrl.endsWith('/') ? `${baseUrl}${filename}` : `${baseUrl}/${filename}`

So a complete mesh URL looks like:
  /api/records/<recordId>/files/<mesh-filename-from-urdf>   (e.g. .glb or .obj)

An optional cache-buster `?rev=<assetRevisionKey>` is appended when a revision
key is present; `no-store` cache policy is used when one is supplied.

In Phidias the `baseFileUrl` equivalent will need to point at whatever URL
prefix serves the URDF bundle (e.g. a Phidias asset CDN path or local API
route). The downstream resolution logic in geometry-loader is fully reusable
without changes once the base URL is supplied.

PUBLIC API TO RECREATE IN Phidias (src/lib/three/urdf/):

From urdf-parser.ts — all exports are portable:
  parseUrdf(urdfXml: string): UrdfSpec
  rewriteAbsoluteMeshFilenames(spec: UrdfSpec): UrdfSpec   -- optional; skip if no package:// paths
  findRootLink(spec: UrdfSpec): string | null
  rpyToMatrix4(rpy: [number,number,number]): THREE.Matrix4
  originToMatrix4(origin?): THREE.Matrix4
  parseVec3(str): [number,number,number]
  parseVec4(str): [number,number,number,number]
  buildUrdfVisualKey(linkName, visualIndex): string
  describeLinkVisuals(link: UrdfLink): UrdfVisualDescriptor[]

Key types: UrdfSpec, UrdfLink, UrdfJoint, UrdfVisual, UrdfVisualGeometry,
  UrdfVisualDescriptor, CollisionGeometryState, UrdfLoaderState

From geometry-loader.ts — portable, just swap the base URL:
  loadGeometryObject(geometry, baseUrl, options): Promise<THREE.Group>
  buildPrimitiveMesh(geometry, materialSpec, options): THREE.Mesh | null
  addEdgeLines(mesh: THREE.Object3D): void

From useUrdfLoader.ts — the hook itself is too Articraft-coupled to port as-is
(uses OrbitControls directly, manages scene.add/remove, drives camera fitting,
grid/axis helpers). Recommend writing a leaner Phidias version that:
  1. Takes a baseFileUrl (or assetId) and returns { urdfSpec, loading, error }.
  2. Uses R3F's useThree() rather than raw THREE.Scene + OrbitControls refs.
  3. Delegates mesh loading to the ported loadGeometryObject.
  4. Leaves camera/controls management to Phidias's existing CameraControls setup.

DEPENDENCIES OUTSIDE viewer3d/ (would NOT be carried into Phidias):
  - None from urdf-parser.ts (pure three + DOM).
  - geometry-loader.ts depends only on three/addons GLTFLoader + OBJLoader.
  - useUrdfLoader.ts depends on OrbitControls from three/addons (Phidias uses
    @react-three/drei CameraControls, so this wiring must change).

THREE.JS VERSION NOTE:
Both repos pin `three ^0.183.0`. No version-lock concern for the port.

MODULE INIT SIDE EFFECTS:
geometry-loader.ts initialises a module-level Map cache:
  const geometryTemplateCache = new Map<string, Promise<THREE.Object3D>>();
This is benign but means the cache lives for the lifetime of the module. In
Next.js (HMR in dev) this will reset on hot reload, which is fine.

SUMMARY ACTION FOR PHASE 5:
- Copy urdf-parser.ts wholesale (optionally drop rewriteAbsoluteMeshFilenames).
- Copy geometry-loader.ts wholesale; supply Phidias base URL instead of /api/records/.
- Write a new useUrdfLoader hook (or RSC data-fetcher) for Phidias that calls
  parseUrdf + loadGeometryObject with R3F-idiomatic patterns.
- Do NOT attempt to port scene-graph-builder, camera-utils, lighting, or
  materials verbatim — reimplement lightweight Phidias-specific versions.
-->
