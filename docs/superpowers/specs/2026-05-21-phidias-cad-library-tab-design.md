# CAD Library Tab — Design

**Date:** 2026-05-21
**Status:** Draft, pending user review
**Owner:** between2058

## Overview

Add a new top-level **CAD** tab to Phidias-standalone that browses the asset dataset produced by the Articraft generation system (located at `/home/pegaai/code/articraft/`). Users see a searchable, faceted grid of records and can open a detail view that renders the articulated URDF model with interactive joint controls.

The Articraft brand is intentionally not surfaced in the UI; from the user's perspective this is a Phidias-native library of CAD-like articulated assets.

## Goals

- New sidebar tab labeled **CAD** (icon: `DraftingCompass`) at `/workspace/cad`.
- Grid view of all records on disk, with three internal tabs: **Dataset / Workbench / All**.
- Full faceted filtering: text search, category, supercategory, rating, model, author, cost range, time, sort order.
- Detail route `/workspace/cad/[recordId]` that renders the URDF with React Three Fiber and exposes per-joint sliders.
- Joint pose round-trips through the URL (`?pose=…`) so links preserve articulation state.
- All Articraft data access goes through a single rewrite in `next.config.mjs`; no Articraft code is copied into Phidias except the URDF loader.

## Non-Goals (MVP)

- Rating, promoting, or editing records from Phidias (read-only MVP; write operations are a follow-up).
- Pre-generated thumbnails — grid uses gradient + category-icon fallback. Thumbnail generation listed as a follow-up.
- Segmentation colors, surface sampling, collision visualization, render-mode toggle, split-view comparison.
- Articraft-side `staging` / `runs` / `batch` surfaces.
- Cross-machine deployment, Docker packaging, or auto-start of the sidecar.
- Internationalization (Phidias is English-only today; CAD tab matches).

## Confirmed Decisions

| Decision | Value | Source |
|---|---|---|
| Integration topology | Sidecar — run Articraft FastAPI; Phidias proxies via `next.config.mjs` rewrites | Q2 → A |
| Tab name / icon | `CAD` / `DraftingCompass` | Q5 |
| Grid scope | Three internal tabs: Dataset / Workbench / All | Q3 → C |
| Permissions | Read-only MVP; write actions are follow-up | Q4 → A (C nice-to-have) |
| Facets | Full set matching Articraft viewer | Q6 → C |
| Thumbnails | None in MVP; gradient + category-icon fallback | Q7 → D |
| Detail UX | Full URDF with joint controls (port loader, do not reduce to GLB) | Q1 → B |
| Detail routing | Sub-route `/workspace/cad/[recordId]` (sharable, browser-back friendly) | Section 2.3 → B |

## Architecture

### Topology

```
┌───────────────────────────────────────────────────────────────┐
│  Local machine                                                │
│                                                               │
│  ┌──────────────────────┐  rewrite  ┌──────────────────────┐  │
│  │ Phidias (Next.js)    │ ───────►  │ Articraft sidecar    │  │
│  │ :3000                │           │ FastAPI :8765        │  │
│  │                      │           │ (uvicorn viewer.api) │  │
│  │  /workspace/cad      │           │                      │  │
│  │  ├─ CADLibraryPage   │           │  reads ─►            │  │
│  │  ├─ CADGrid          │           │  ~/code/articraft/   │  │
│  │  ├─ CADFacetSidebar  │           │  data/records/       │  │
│  │  └─ CADViewer (URDF) │           │  data/cache/         │  │
│  └──────────────────────┘           └──────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Sidecar wiring

`next.config.mjs` gains:

```js
rewrites: () => [
  {
    source: '/api/library/:path*',
    destination: `${process.env.ARTICRAFT_API_URL ?? 'http://127.0.0.1:8765'}/api/:path*`,
  },
]
```

Phidias `.env.example`:

```
ARTICRAFT_API_URL=http://127.0.0.1:8765
```

### Dev workflow

1. `cd ~/code/articraft && uv run uvicorn viewer.api.app:app --port 8765`
2. `cd ~/phidias/Phidias-standalone && pnpm dev`

A convenience script `pnpm dev:with-library` (using `concurrently`) bundles both.

## UI Structure

### Sidebar registration

Edit `src/components/shared/LeftIconSidebar.tsx`:

```ts
import { Camera, Sparkles, Scissors, Paintbrush, Atom, DraftingCompass } from 'lucide-react';

const tabs: SidebarTab[] = [
  { icon: <Camera size={20} />,         label: 'Image',   href: '/workspace/image' },
  { icon: <Sparkles size={20} />,        label: 'Model',   href: '/workspace/model' },
  { icon: <Scissors size={20} />,        label: 'Segment', href: '/workspace/segment' },
  { icon: <Paintbrush size={20} />,      label: 'Texture', href: '/workspace/texture' },
  { icon: <Atom size={20} />,            label: 'Physics', href: '/workspace/physics' },
  { icon: <DraftingCompass size={20} />, label: 'CAD',     href: '/workspace/cad' },
];
```

### Page layout

```
┌────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌────────────────────────────┐ ┌────────────┐ │
│ │              │ │ [ Dataset | Workbench | All]│ │            │ │
│ │  Facet       │ ├────────────────────────────┤ │            │ │
│ │  Sidebar     │ │ search... [⌕]              │ │  Inspector │ │
│ │              │ ├────────────────────────────┤ │  (right)   │ │
│ │  Category ▾  │ │   ┌──┐ ┌──┐ ┌──┐ ┌──┐    │ │            │ │
│ │  Supercat ▾  │ │   │  │ │  │ │  │ │  │    │ │  ▸ Summary │ │
│ │  Rating ★★★  │ │   └──┘ └──┘ └──┘ └──┘    │ │  ▸ Code    │ │
│ │  Model    ▾  │ │   ┌──┐ ┌──┐ ┌──┐ ┌──┐    │ │  ▸ Prompt  │ │
│ │  Author   ▾  │ │   │  │ │  │ │  │ │  │    │ │  ▸ Joints  │ │
│ │  Cost     ▾  │ │   └──┘ └──┘ └──┘ └──┘    │ │  ▸ Report  │ │
│ │  Time     ▾  │ │   ...                      │ │            │ │
│ │  Sort:    ▾  │ │                            │ │            │ │
│ └──────────────┘ └────────────────────────────┘ └────────────┘ │
│   240px            flex-1                          340px         │
└────────────────────────────────────────────────────────────────┘
```

In the detail route `/workspace/cad/[recordId]`, the center column is replaced with the 3D viewer; the grid collapses into a thin collapsible strip or back-button.

### New components

Under `src/components/cad/`:

- `CADLibraryPage.tsx` — container, manages filter state and view mode
- `CADFacetSidebar.tsx` — left facets
- `CADRecordGrid.tsx` — center grid (no thumbnails; gradient + category icon)
- `CADRecordCard.tsx` — single card
- `CADInspector.tsx` — right metadata panel (reuses existing Tabs primitives)
- `CADViewer.tsx` — R3F canvas wrapping the URDF model
- `CADJointControls.tsx` — joint sliders

API client at `src/lib/api/library.ts`.

### Design system

- Use existing Phidias CSS variables (`--bg-primary`, `--bg-card`, `--accent-purple`, etc.).
- Card styling mirrors `AssetsPanel`'s glassmorphism + gradient fallback.
- No shadcn primitives (Phidias does not use them).

## URDF Rendering Bridge

The single largest technical lift. Articraft uses raw three.js for URDF; Phidias uses React Three Fiber + `useGLTF()` for GLB.

### Port strategy

Lift the framework-agnostic three.js URDF logic from Articraft (`viewer/web/src/lib/urdf/` or equivalent) into Phidias under `src/lib/three/urdf/`:

```
src/lib/three/urdf/
├── UrdfLoader.ts   # parse URDF XML → THREE.Group with joints
├── UrdfRobot.ts    # wraps the group, exposes setJointAngle(name, rad)
├── MeshResolver.ts # rewrites package:// / file:// / relative paths → /api/library/.../files/<path>
└── types.ts        # JointSpec, LinkSpec, etc.
```

`MeshResolver` is the only piece that needs adjustment: its base URL is `/api/library/records/<id>` (Phidias proxy) instead of Articraft's same-origin `/api/records/<id>`.

### Mounting inside R3F

```tsx
// CADViewer.tsx
'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { UrdfModel } from './UrdfModel';

export function CADViewer({ recordId, pose }: Props) {
  return (
    <Canvas camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}>
      <Environment preset="studio" />
      <OrbitControls makeDefault />
      <UrdfModel recordId={recordId} pose={pose} />
    </Canvas>
  );
}
```

```tsx
// UrdfModel.tsx
'use client';
import { useEffect, useState } from 'react';
import { UrdfLoader, UrdfRobot } from '@/lib/three/urdf';

export function UrdfModel({ recordId, pose }: Props) {
  const [robot, setRobot] = useState<UrdfRobot | null>(null);

  useEffect(() => {
    let cancelled = false;
    new UrdfLoader({ baseUrl: `/api/library/records/${recordId}` })
      .load('files/revisions/rev_000001/model_visual.urdf')
      .then((r) => { if (!cancelled) setRobot(r); });
    return () => { cancelled = true; robot?.dispose(); };
  }, [recordId]);

  useEffect(() => {
    if (!robot || !pose) return;
    for (const [name, angle] of Object.entries(pose)) {
      robot.setJointAngle(name, angle);
    }
  }, [robot, pose]);

  return robot ? <primitive object={robot.root} /> : null;
}
```

This is the standard "raw three.js object mounted into R3F via `<primitive/>`" pattern.

### Which URDF to load

Each record exposes two URDFs via the Articraft cache:

- `revisions/rev_000001/model_visual.urdf` — visual-only, no collision, **faster**
- `revisions/rev_000001/model.urdf` — full with collision, slower

MVP defaults to `model_visual.urdf`. A collision toggle is a follow-up.

Articraft's `files` endpoint already handles the "source not yet compiled → fall back to materialization cache" logic, so Phidias does not have to replicate it.

### Joint controls

```tsx
// CADJointControls.tsx — one tab inside the Inspector
<div>
  {joints.map((j) => (
    <div key={j.name}>
      <label>{j.name}</label>
      <input
        type="range"
        min={j.lower}
        max={j.upper}
        step={(j.upper - j.lower) / 200}
        value={pose[j.name] ?? 0}
        onChange={(e) => setPose({ ...pose, [j.name]: +e.target.value })}
      />
      <span>{(pose[j.name] ?? 0).toFixed(2)}</span>
    </div>
  ))}
</div>
```

`pose` is encoded into the URL (`?pose=base64encoded`), preserving articulation state on share/refresh — mirrors Articraft's own viewer behavior.

## Data Flow

### Articraft FastAPI → Phidias frontend mapping

All requests go through the `/api/library/*` rewrite.

| Frontend (Phidias) | Rewrite target (Articraft FastAPI) | Purpose |
|---|---|---|
| `GET /api/library/records/browse?…` | `GET /api/records/browse` | Grid data source; returns list + facets + total |
| `GET /api/library/records/search?q=` | `GET /api/records/search` | Top-of-grid text search |
| `GET /api/library/records/{id}/summary` | `GET /api/records/{id}/summary` | Inspector metadata |
| `GET /api/library/records/{id}/files/{path}` | `GET /api/records/{id}/files/{path}` | URDF + mesh + image binaries |
| `GET /api/library/records/{id}/text/{path}` | `GET /api/records/{id}/text/{path}` | `model.py`, `prompt.txt` previews |
| `GET /api/library/records/{id}/history` | `GET /api/records/{id}/history` | Revision lineage |
| `GET /api/library/status` | `GET /api/status` | Sidecar liveness probe |

Unused for read-only MVP: `PUT /rating`, `POST /promote`, staging endpoints, runs.

### TypeScript client

`src/lib/api/library.ts` wraps each endpoint and returns typed responses. Types are hand-written to mirror Articraft's `viewer/api/schemas.py`. Schema drift is caught by the contract test (see Testing).

```ts
const BASE = '/api/library';

export type LibraryTab = 'dataset' | 'workbench' | 'all';

export type BrowseFilters = {
  q?: string;
  category?: string[];
  supercategory?: string[];
  rating?: number[];
  model?: string[];
  author?: string[];
  costMin?: number;
  costMax?: number;
  source?: LibraryTab;
  sort?: 'newest' | 'oldest' | 'rating' | 'cost';
  offset?: number;
  limit?: number;
};

export type RecordSummary = {
  record_id: string;
  title: string;
  prompt_preview: string;
  category_slug: string | null;
  rating: number | null;
  provider: string;
  model_id: string;
  created_at: string;
  cost_usd: number | null;
  author: string | null;
};

export type BrowseResponse = {
  results: RecordSummary[];
  total: number;
  offset: number;
  limit: number;
  facets: {
    categories: Array<{ slug: string; count: number; title: string }>;
    supercategories: Array<{ key: string; count: number }>;
    models: Array<{ id: string; count: number }>;
    authors: Array<{ name: string; count: number }>;
    ratings: Record<string, number>;
    cost_range: { min: number; max: number };
  };
};
```

### Internal tab → API mapping

| Tab | Filter sent |
|---|---|
| Dataset | `source=dataset` |
| Workbench | `source=workbench` |
| All | no `source` param |

If Articraft's `browse` lacks a `source` parameter (Unknown #1), MVP falls back to client-side filtering or a small Articraft patch.

### Failure handling

| Scenario | Behavior |
|---|---|
| Sidecar unreachable | Center empty state: "Library service not running. Start it with: `uvicorn viewer.api.app:app --port 8765`" + Retry button |
| `browse` returns 5xx | Error banner over grid + Retry; existing filter state preserved |
| `files/{urdf}` returns 404 | Viewer surface shows "Model not compiled yet. Run `uv run articraft compile data/records/<id>` and refresh." |
| URDF parse failure | Viewer shows error overlay; inspector metadata still visible |

### State management

- **URL is the source of truth.** `/workspace/cad?tab=dataset&q=hinge&category=fridge&page=2` reproduces full filter state on refresh / share.
- **Detail page** `/workspace/cad/[recordId]?pose=<encoded>&inspector=joints`.
- **Existing `WorkspaceContext` is not extended** — the CAD tab keeps its own local state to avoid polluting Image/Model/etc. data flow.

### Performance

- Grid default `limit=60`, infinite scroll appends pages.
- Facets refresh on every browse response.
- `UrdfRobot.dispose()` runs in `useEffect` cleanup on record change / unmount.

## Testing

| Layer | Scope | Tool |
|---|---|---|
| Unit | URDF pure functions (`parseUrdfXml`, `MeshResolver.resolve`), `serializeFilters`, `parsePoseQueryString` | vitest |
| Component | `CADRecordCard`, `CADFacetSidebar` (mock API), `CADJointControls` (mock joints) | vitest + Testing Library |
| API contract | Fixture-based test: capture real `record.json` + `browse` response, assert TS types and runtime parsing agree | vitest |
| E2E (one happy path) | Start sidecar → open `/workspace/cad` → see ≥1 card → click → URDF renders → drag a joint slider → mesh transforms | playwright |

E2E fixture starts `uv run uvicorn viewer.api.app:app --port 8765` before the suite and tears it down after. The fixture must verify the sidecar responds before the test body runs.

## Known Unknowns (Spike in Phase 0)

| # | Question | Why uncertain | Resolution |
|---|---|---|---|
| 1 | Does `browse` accept a `source` parameter (`dataset` / `workbench` / `all`)? | Exploration agent didn't explicitly enumerate that filter | Read `viewer/api/records.py` browse handler |
| 2 | How tightly coupled is Articraft's URDF loader to its own utilities and three.js version? | Has not been read line-by-line; coupling is the porting risk | Read `viewer/web/src/lib/urdf/` and trace import graph |
| 3 | Are Phidias's R3F / three.js versions compatible with the version Articraft's URDF code expects? | Articraft pins `three ^0.183.2`; Phidias's version unverified | Diff `package.json` in both repos |
| 4 | How does Phidias gracefully handle a future bump in `record.json` `schema_version`? | Current is 3; future bumps will land asymmetrically | MVP only reads known fields; unknown fields are ignored, not thrown |
| 5 | Do all records have a compiled `model_visual.urdf`? | Uncompiled workbench records may not | Viewer surfaces a "not compiled" empty state (see Data Flow → Failure handling) |

## Risks

- **High — URDF loader portability.** If Phase-0 spike shows the Articraft loader is too entangled, fallback is to use the `urdf-loader` npm package and write a thin `MeshResolver` shim. The plan will branch here.
- **Medium — Facet sidebar rebuild.** Articraft has equivalent UI but in a different style system; we must rebuild against Phidias's CSS variables rather than port wholesale.
- **Low — Tab registration and grid scaffolding.** Both are well-trodden Next.js / Phidias patterns.

## Open Questions for User Review

- Is putting the spec in Phidias's `docs/superpowers/specs/` rather than Articraft's documentation tree the right home? (Implementation is ~99% Phidias-side; only the URDF source files are read from Articraft.)
- Should `pnpm dev:with-library` (concurrently runs both processes) ship in MVP, or is the manual two-terminal flow fine?

## Next Step

After user approves this spec, invoke `writing-plans` to produce a phased implementation plan starting with the Phase-0 spike for the five unknowns above.
