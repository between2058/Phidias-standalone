# Physics Tab Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate articulation-mvp into Phidias as a fully functional Physics workspace tab with joint visualization, interactive anchor editing, motion preview, and USD export with materials.

**Architecture:** Rewrite-style integration. New `physics-store.ts` (Zustand + Zundo) manages all state. UI panels rewritten from existing `_physics` scaffolding. Backend is an independent Python microservice (`articulation-service`) accessed via the standard proxy pattern. Joint visualization and motion preview are R3F sub-components inside ThreeViewport.

**Tech Stack:** Next.js 14, React 18, Zustand + Zundo, React Three Fiber, Three.js, Tailwind CSS, FastAPI (backend), trimesh + pxr/USD Core (backend).

**Spec:** `docs/superpowers/specs/2026-04-09-physics-tab-integration-design.md`

---

## File Map

### New Files (Frontend — phidias-standalone)

| File | Responsibility |
|------|----------------|
| `src/store/physics-store.ts` | Zustand + Zundo store for parts, joints, materials, UI selection |
| `src/app/workspace/physics/page.tsx` | Physics workspace page with bottom editor panel layout |
| `src/components/physics/PhysicsEditorPanel.tsx` | Bottom panel container with Parts/Materials/Joints tabs + Export |
| `src/components/physics/PhysicsMotionPreview.tsx` | Joint motion preview slider (rendered in bottom panel) |
| `src/components/physics/PhysicsExportButtons.tsx` | USDA/USDZ export buttons with pre-export validation |
| `src/components/physics/JointVisualizer.tsx` | R3F component: anchor spheres, axis arrows, parent-child lines |
| `src/components/physics/AnchorGizmo.tsx` | R3F component: draggable TransformControls for selected joint anchor |
| `src/components/physics/MotionPreviewController.tsx` | R3F component: useFrame-based child mesh transform for joint preview |
| `src/app/api/phidias/articulation/[...path]/route.ts` | Next.js proxy route to articulation-service |

### Modified Files (Frontend — phidias-standalone)

| File | Change |
|------|--------|
| `src/components/shared/LeftIconSidebar.tsx:14-34` | Add Physics tab entry |
| `src/lib/api/types.ts:149-167` | Add/update physics-related type definitions |
| `src/lib/api/phidias.ts` | Add articulation API client functions |
| `src/lib/workspace-context.tsx:55-78` | Add `pendingPhysicsData` field for Segment→Physics handoff |
| `src/app/workspace/segment/page.tsx:1370-1478` | Add "Physics →" button in toolbar |
| `src/components/shared/ExportDropdown.tsx:272-322` | Add USDA/USDZ options when Physics tab active |
| `src/components/physics/PhysicsPartsPanel.tsx` | Full rewrite with segment import + GLB upload |
| `src/components/physics/PhysicsMaterialsPanel.tsx` | Rewrite with preset library + click-to-apply |
| `src/components/physics/PhysicsJointsPanel.tsx` | Rewrite with anchor inputs + bidirectional gizmo sync |
| `.env.local` | Add `ARTICULATION_API_URL` |

### Deleted Files

| File | Reason |
|------|--------|
| `src/app/workspace/_physics/page.tsx` | Replaced by `src/app/workspace/physics/page.tsx` |
| `src/components/physics/PhysicsPropertiesPanel.tsx` | Merged into PhysicsPartsPanel (properties are per-part, not a separate panel) |

### New Files (Backend — separate repo)

| File | Responsibility |
|------|----------------|
| `articulation-service/articulation_api.py` | FastAPI entry point with all endpoints |
| `articulation-service/services/glb_parser.py` | GLB parsing with material extraction |
| `articulation-service/services/usd_builder.py` | USD stage creation with UsdPreviewSurface materials |
| `articulation-service/services/physics_injector.py` | PhysX schema injection |
| `articulation-service/models/schemas.py` | Pydantic models |
| `articulation-service/Dockerfile` | CPU-only Python image |
| `articulation-service/docker-compose.yml` | Standalone run config |
| `articulation-service/requirements.txt` | Dependencies |

---

## Task 1: Create Branch and Project Setup

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Create feature branch**

```bash
git checkout feat/viewer-export-ux-improvements
git checkout -b feat/physics-tab-integration
```

- [ ] **Step 2: Add environment variable**

In `.env.local`, add:

```
ARTICULATION_API_URL=http://localhost:52071
```

- [ ] **Step 3: Commit**

```bash
git add .env.local
git commit -m "chore: add ARTICULATION_API_URL env var for physics tab"
```

---

## Task 2: Physics Store (Zustand + Zundo)

**Files:**
- Create: `src/store/physics-store.ts`

- [ ] **Step 1: Create the physics store**

Follow the exact pattern from `src/store/segment-store.ts`. The store manages parts, joints, material presets, and UI selection state. Only `parts` and `joints` are tracked by Zundo for undo/redo.

```typescript
// src/store/physics-store.ts
import { create } from 'zustand'
import { temporal } from 'zundo'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OriginalMaterial {
  baseColorFactor: [number, number, number, number] | null
  baseColorTextureId: string | null
  metallicFactor: number
  roughnessFactor: number
  normalTextureId: string | null
}

export interface PhysicsPart {
  id: string
  name: string
  color: string
  type: 'link' | 'base' | 'tool' | 'joint'
  role: 'other' | 'actuator' | 'support' | 'gripper' | 'sensor'
  mobility: 'fixed' | 'revolute' | 'prismatic'
  mass: number | null
  density: number
  collisionType: 'convexHull' | 'mesh' | 'convexDecomposition' | 'none'
  staticFriction: number
  dynamicFriction: number
  restitution: number
  materialId: string | null
  isMaterialCustom: boolean
  originalMaterial: OriginalMaterial | null
  vertexCount: number
}

export interface PhysicsJoint {
  id: string
  name: string
  type: 'Revolute' | 'Prismatic' | 'Fixed' | 'Spherical' | '6-DOF'
  parentPartId: string
  childPartId: string
  axis: [number, number, number]
  anchor: [number, number, number]
  limitsEnabled: boolean
  limitLower: number
  limitUpper: number
  driveStiffness: number
  driveDamping: number
  driveMaxForce: number
  driveType: 'position' | 'velocity' | 'none'
  disableCollision: boolean
}

export interface PhysicsMaterialPreset {
  id: string
  name: string
  density: number
  staticFriction: number
  dynamicFriction: number
  restitution: number
  color: string
}

// ─── Default material presets ──────────────────────────────────────────────

export const DEFAULT_MATERIAL_PRESETS: PhysicsMaterialPreset[] = [
  { id: 'steel', name: 'Steel', density: 7800, staticFriction: 0.6, dynamicFriction: 0.4, restitution: 0.3, color: '#71797E' },
  { id: 'aluminum', name: 'Aluminum', density: 2700, staticFriction: 0.5, dynamicFriction: 0.35, restitution: 0.3, color: '#A8A9AD' },
  { id: 'rubber', name: 'Rubber', density: 1100, staticFriction: 1.0, dynamicFriction: 0.8, restitution: 0.8, color: '#2C2C2C' },
  { id: 'plastic', name: 'Plastic', density: 950, staticFriction: 0.4, dynamicFriction: 0.3, restitution: 0.5, color: '#E8E8E8' },
  { id: 'wood', name: 'Wood', density: 600, staticFriction: 0.5, dynamicFriction: 0.35, restitution: 0.4, color: '#8B6914' },
  { id: 'concrete', name: 'Concrete', density: 2400, staticFriction: 0.7, dynamicFriction: 0.5, restitution: 0.2, color: '#808080' },
  { id: 'glass', name: 'Glass', density: 2500, staticFriction: 0.4, dynamicFriction: 0.2, restitution: 0.5, color: '#ADD8E6' },
  { id: 'foam', name: 'Foam', density: 30, staticFriction: 0.6, dynamicFriction: 0.5, restitution: 0.1, color: '#FFFDD0' },
  { id: 'ice', name: 'Ice', density: 917, staticFriction: 0.1, dynamicFriction: 0.03, restitution: 0.3, color: '#D6ECEF' },
  { id: 'ceramic', name: 'Ceramic', density: 2300, staticFriction: 0.6, dynamicFriction: 0.4, restitution: 0.2, color: '#F5F5DC' },
]

// ─── Store state interface ─────────────────────────────────────────────────

interface PhysicsStoreState {
  // Data (tracked by Zundo)
  parts: PhysicsPart[]
  joints: PhysicsJoint[]

  // Data (not tracked — static presets)
  materialPresets: PhysicsMaterialPreset[]

  // UI state (not tracked by Zundo)
  selectedPartId: string | null
  selectedJointId: string | null
  jointPreviewValue: number

  // Actions — data mutations (trigger undo snapshots)
  setParts: (parts: PhysicsPart[] | ((prev: PhysicsPart[]) => PhysicsPart[])) => void
  setJoints: (joints: PhysicsJoint[] | ((prev: PhysicsJoint[]) => PhysicsJoint[])) => void
  updatePart: (id: string, partial: Partial<PhysicsPart>) => void
  updateJoint: (id: string, partial: Partial<PhysicsJoint>) => void
  addJoint: (joint: PhysicsJoint) => void
  removeJoint: (id: string) => void
  applyMaterialPreset: (partId: string, presetId: string) => void

  // Actions — UI (no undo)
  setSelectedPartId: (id: string | null) => void
  setSelectedJointId: (id: string | null) => void
  setJointPreviewValue: (value: number) => void

  // Reset
  reset: () => void
}

// ─── Store creation ────────────────────────────────────────────────────────

const initialState = {
  parts: [] as PhysicsPart[],
  joints: [] as PhysicsJoint[],
  materialPresets: DEFAULT_MATERIAL_PRESETS,
  selectedPartId: null as string | null,
  selectedJointId: null as string | null,
  jointPreviewValue: 0,
}

export const usePhysicsStore = create<PhysicsStoreState>()(
  temporal(
    (set, get) => ({
      ...initialState,

      setParts: (parts) =>
        set((s) => ({
          parts: typeof parts === 'function' ? parts(s.parts) : parts,
        })),

      setJoints: (joints) =>
        set((s) => ({
          joints: typeof joints === 'function' ? joints(s.joints) : joints,
        })),

      updatePart: (id, partial) =>
        set((s) => ({
          parts: s.parts.map((p) => (p.id === id ? { ...p, ...partial } : p)),
        })),

      updateJoint: (id, partial) =>
        set((s) => ({
          joints: s.joints.map((j) => (j.id === id ? { ...j, ...partial } : j)),
        })),

      addJoint: (joint) =>
        set((s) => ({ joints: [...s.joints, joint] })),

      removeJoint: (id) =>
        set((s) => ({
          joints: s.joints.filter((j) => j.id !== id),
          selectedJointId: s.selectedJointId === id ? null : s.selectedJointId,
        })),

      applyMaterialPreset: (partId, presetId) => {
        const preset = get().materialPresets.find((m) => m.id === presetId)
        if (!preset) return
        set((s) => ({
          parts: s.parts.map((p) =>
            p.id === partId
              ? {
                  ...p,
                  density: preset.density,
                  staticFriction: preset.staticFriction,
                  dynamicFriction: preset.dynamicFriction,
                  restitution: preset.restitution,
                  materialId: presetId,
                  isMaterialCustom: false,
                }
              : p
          ),
        }))
      },

      // UI actions — these should NOT trigger undo snapshots
      // Zundo's partialize excludes them from tracking
      setSelectedPartId: (id) => set({ selectedPartId: id }),
      setSelectedJointId: (id) => set({ selectedJointId: id, jointPreviewValue: 0 }),
      setJointPreviewValue: (value) => set({ jointPreviewValue: value }),

      reset: () => set(initialState),
    }),
    {
      partialize: (state) => ({
        parts: state.parts,
        joints: state.joints,
      }),
      limit: 50,
    }
  )
)
```

- [ ] **Step 2: Verify the store compiles**

```bash
cd /Users/between2058/Documents/code/phidias-standalone
npx tsc --noEmit src/store/physics-store.ts 2>&1 | head -20
```

If there are import issues with `zundo`, check that the import matches `segment-store.ts` exactly.

- [ ] **Step 3: Commit**

```bash
git add src/store/physics-store.ts
git commit -m "feat(physics): add physics-store with Zustand + Zundo undo/redo"
```

---

## Task 3: API Types

**Files:**
- Modify: `src/lib/api/types.ts:149-167`

- [ ] **Step 1: Update physics types in api/types.ts**

Replace the existing `PhysicsMaterial` (lines 149–157) and `Joint` (lines 159–167) interfaces with the expanded versions that match the backend contract. Keep the existing interfaces if other code depends on them — add the new ones alongside.

Add after the existing `Joint` interface (after line 167):

```typescript
// ─── Articulation Service Types ────────────────────────────────────────────

export interface ParsedPhysicsPart {
  id: string
  name: string
  vertex_count: number
  face_count: number
  bounds_min: [number, number, number]
  bounds_max: [number, number, number]
  is_watertight: boolean
  material: {
    baseColorFactor: [number, number, number, number] | null
    baseColorTextureId: string | null
    metallicFactor: number
    roughnessFactor: number
    normalTextureId: string | null
  } | null
}

export interface ParsedPhysicsResult {
  parts: ParsedPhysicsPart[]
  model_url: string
}

export interface ArticulationExportPart {
  id: string
  name: string
  type: 'link' | 'base' | 'tool' | 'joint'
  mass: number | null
  density: number
  collision_type: 'convexHull' | 'mesh' | 'convexDecomposition' | 'none'
  static_friction: number
  dynamic_friction: number
  restitution: number
}

export interface ArticulationExportJoint {
  name: string
  parent: string
  child: string
  type: 'fixed' | 'revolute' | 'prismatic'
  axis: [number, number, number]
  anchor: [number, number, number]
  lower_limit: number | null
  upper_limit: number | null
  drive_stiffness: number | null
  drive_damping: number | null
  drive_max_force: number | null
  drive_type: 'position' | 'velocity' | 'none'
  disable_collision: boolean
}

export interface ArticulationExportData {
  glb_file: File
  model_name: string
  parts: ArticulationExportPart[]
  joints: ArticulationExportJoint[]
}

export interface ArticulationExportResult {
  success: boolean
  filename: string
  download_url: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat(physics): add articulation service API types"
```

---

## Task 4: API Proxy Route

**Files:**
- Create: `src/app/api/phidias/articulation/[...path]/route.ts`

- [ ] **Step 1: Create the proxy route**

Follow the exact pattern from `src/app/api/phidias/segment/3d/route.ts`. Read `_proxy.ts` for the `proxyRequest` function signature.

```typescript
// src/app/api/phidias/articulation/[...path]/route.ts
import { NextRequest } from 'next/server'
import { proxyRequest } from '../../_proxy'

const ARTICULATION_API_URL =
  process.env.ARTICULATION_API_URL || 'http://localhost:52071'

function buildTarget(request: NextRequest): string {
  const url = new URL(request.url)
  // Strip the /api/phidias/articulation prefix, forward the rest
  const subPath = url.pathname.replace(/^\/api\/phidias\/articulation/, '')
  const target = `${ARTICULATION_API_URL}/api${subPath}${url.search}`
  return target
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, buildTarget(request))
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, buildTarget(request))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/phidias/articulation/
git commit -m "feat(physics): add articulation API proxy route"
```

---

## Task 5: API Client Functions

**Files:**
- Modify: `src/lib/api/phidias.ts`

- [ ] **Step 1: Add articulation API functions**

Follow the existing pattern in `phidias.ts`: standalone functions using `client.post`/`client.get` with `getBackendApi()` prefix. Add these at the end of the file:

```typescript
// ─── Articulation Service ──────────────────────────────────────────────────

import type {
  ParsedPhysicsResult,
  ArticulationExportData,
  ArticulationExportResult,
} from './types'

export async function parseGlbForPhysics(
  file: File
): Promise<ParsedPhysicsResult> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post(
    `${getBackendApi()}/phidias/articulation/parse-glb`,
    formData,
    { timeout: 60000 }
  )
  return data as ParsedPhysicsResult
}

export async function exportArticulationUsda(
  exportData: ArticulationExportData
): Promise<ArticulationExportResult> {
  const formData = new FormData()
  formData.append('file', exportData.glb_file)
  formData.append(
    'articulation',
    JSON.stringify({
      model_name: exportData.model_name,
      parts: exportData.parts,
      joints: exportData.joints,
    })
  )
  const { data } = await client.post(
    `${getBackendApi()}/phidias/articulation/export-usda`,
    formData,
    { timeout: 120000 }
  )
  return data as ArticulationExportResult
}

export async function exportArticulationUsdz(
  exportData: ArticulationExportData
): Promise<ArticulationExportResult> {
  const formData = new FormData()
  formData.append('file', exportData.glb_file)
  formData.append(
    'articulation',
    JSON.stringify({
      model_name: exportData.model_name,
      parts: exportData.parts,
      joints: exportData.joints,
    })
  )
  const { data } = await client.post(
    `${getBackendApi()}/phidias/articulation/export-usdz`,
    formData,
    { timeout: 120000 }
  )
  return data as ArticulationExportResult
}

export async function downloadArticulationFile(
  filename: string
): Promise<Blob> {
  const response = await fetch(
    `${getBackendApi()}/phidias/articulation/download/${filename}`
  )
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  return response.blob()
}
```

Note: Check how `client.post` handles `FormData` in the existing code (e.g., `segment3D` function). If it wraps in a body object, match that pattern. The key is that `FormData` should be sent directly without `Content-Type` header (browser sets it with boundary).

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/phidias.ts
git commit -m "feat(physics): add articulation API client functions"
```

---

## Task 6: Activate Physics Tab

**Files:**
- Modify: `src/components/shared/LeftIconSidebar.tsx:14-34`
- Delete: `src/app/workspace/_physics/` (entire directory)
- Create: `src/app/workspace/physics/page.tsx` (placeholder first, full rewrite in Task 7)

- [ ] **Step 1: Add Physics tab to sidebar**

In `src/components/shared/LeftIconSidebar.tsx`, add an import for a physics icon and add the tab entry. Read the file first to see what icons are imported and the exact tab array structure.

Add to the imports:

```typescript
import { Atom } from 'lucide-react'
```

Add to the `tabs` array (after the CAD entry):

```typescript
{ icon: <Atom size={20} />, label: 'Physics', href: '/workspace/physics' },
```

- [ ] **Step 2: Create placeholder physics page**

Create `src/app/workspace/physics/page.tsx` with a minimal placeholder so the route works:

```typescript
'use client'

export default function PhysicsPage() {
  return (
    <div className="flex-1 flex items-center justify-center text-white/50">
      Physics workspace — loading...
    </div>
  )
}
```

- [ ] **Step 3: Delete old _physics directory**

```bash
rm -rf src/app/workspace/_physics
```

- [ ] **Step 4: Verify the tab appears**

```bash
npm run dev
```

Open `http://localhost:3000/workspace/physics` and verify the sidebar shows the Physics tab and the placeholder page loads.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/LeftIconSidebar.tsx src/app/workspace/physics/
git rm -r src/app/workspace/_physics/
git commit -m "feat(physics): activate Physics tab in sidebar, remove _physics prototype"
```

---

## Task 7: Physics Page Layout

**Files:**
- Modify: `src/app/workspace/physics/page.tsx` (full rewrite)

- [ ] **Step 1: Write the physics page**

This page follows the same structure as segment page but with a **bottom editor panel** instead of a left panel. Reference `src/app/workspace/segment/page.tsx` for patterns (dynamic ThreeViewport import, workspace context usage, toolbar layout).

Key layout: ThreeViewport fills the top area, bottom panel is a resizable/collapsible editor with tabs (Parts, Materials, Joints, Export).

```typescript
// src/app/workspace/physics/page.tsx
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useWorkspace } from '@/lib/workspace-context'
import { usePhysicsStore, type PhysicsPart, type PhysicsJoint } from '@/store/physics-store'
import PhysicsEditorPanel from '@/components/physics/PhysicsEditorPanel'
import { Undo2, Redo2 } from 'lucide-react'
import type { RenderMode } from '@/components/shared/ThreeViewport'

const ThreeViewport = dynamic(
  () => import('@/components/shared/ThreeViewport'),
  { ssr: false }
)

type EditorTab = 'parts' | 'materials' | 'joints'

export default function PhysicsPage() {
  const { assets, activeAssetId } = useWorkspace()
  const activeAsset = useMemo(
    () => assets.find((a) => a.id === activeAssetId),
    [assets, activeAssetId]
  )

  // Store
  const parts = usePhysicsStore((s) => s.parts)
  const joints = usePhysicsStore((s) => s.joints)
  const selectedPartId = usePhysicsStore((s) => s.selectedPartId)
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId)
  const setSelectedPartId = usePhysicsStore((s) => s.setSelectedPartId)
  const setSelectedJointId = usePhysicsStore((s) => s.setSelectedJointId)

  // Local UI state
  const [editorTab, setEditorTab] = useState<EditorTab>('parts')
  const [renderMode, setRenderMode] = useState<RenderMode>('textured')
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  // Segment colors for part visualization
  const segmentColors = useMemo(() => {
    const colors: Record<string, string> = {}
    for (const part of parts) {
      colors[part.name] = part.color
    }
    return colors
  }, [parts])

  // Undo/Redo
  const handleUndo = useCallback(() => {
    usePhysicsStore.temporal.getState().undo()
  }, [])

  const handleRedo = useCallback(() => {
    usePhysicsStore.temporal.getState().redo()
  }, [])

  const canUndo = usePhysicsStore.temporal((s) => s.pastStates.length > 0)
  const canRedo = usePhysicsStore.temporal((s) => s.futureStates.length > 0)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  // Click on mesh in viewport → select part
  const handleObjectSelect = useCallback(
    (id: string | null) => {
      setSelectedPartId(id)
      setSelectedJointId(null)
    },
    [setSelectedPartId, setSelectedJointId]
  )

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* ── Viewport Area ─────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <ThreeViewport
          modelUrl={activeAsset?.modelUrl}
          renderMode={renderMode}
          segmentColors={segmentColors}
          selectedObjectId={selectedPartId}
          onObjectSelect={handleObjectSelect}
          showGrid
          showAxes
        >
          {/* JointVisualizer, AnchorGizmo, MotionPreviewController
              will be added in Tasks 10-12 */}
        </ThreeViewport>

        {/* ── Floating Toolbar (top-right of viewport) ──────────────── */}
        {/* Render mode, etc. — reuse pattern from segment page */}
      </div>

      {/* ── Bottom Toolbar (undo/redo + panel toggle) ─────────────────── */}
      <div className="absolute bottom-[var(--panel-height,280px)] left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 mb-2">
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors bg-[#1a1a2e]/80 backdrop-blur border border-[#333355] text-white/70 hover:text-white disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors bg-[#1a1a2e]/80 backdrop-blur border border-[#333355] text-white/70 hover:text-white disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* ── Bottom Editor Panel ───────────────────────────────────────── */}
      <PhysicsEditorPanel
        activeTab={editorTab}
        onTabChange={setEditorTab}
        collapsed={panelCollapsed}
        onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
        modelUrl={activeAsset?.modelUrl}
      />
    </div>
  )
}
```

Note: `--panel-height` CSS variable is used so the floating toolbar sits just above the bottom panel. The `PhysicsEditorPanel` component will set this via inline style or a fixed height.

- [ ] **Step 2: Commit**

```bash
git add src/app/workspace/physics/page.tsx
git commit -m "feat(physics): implement Physics page layout with bottom editor panel"
```

---

## Task 8: PhysicsEditorPanel (Bottom Panel Container)

**Files:**
- Create: `src/components/physics/PhysicsEditorPanel.tsx`

- [ ] **Step 1: Create the editor panel container**

This is the bottom panel with tabs (Parts, Materials, Joints) and export buttons. Glassmorphism styling per CLAUDE.md.

```typescript
// src/components/physics/PhysicsEditorPanel.tsx
'use client'

import { ChevronDown, ChevronUp, Layers, Palette, Link2, Download } from 'lucide-react'
import PhysicsPartsPanel from './PhysicsPartsPanel'
import PhysicsMaterialsPanel from './PhysicsMaterialsPanel'
import PhysicsJointsPanel from './PhysicsJointsPanel'
import PhysicsExportButtons from './PhysicsExportButtons'

interface PhysicsEditorPanelProps {
  activeTab: 'parts' | 'materials' | 'joints'
  onTabChange: (tab: 'parts' | 'materials' | 'joints') => void
  collapsed: boolean
  onToggleCollapse: () => void
  modelUrl?: string
}

const PANEL_HEIGHT = 280

const tabs = [
  { id: 'parts' as const, label: 'Parts', icon: Layers },
  { id: 'materials' as const, label: 'Materials', icon: Palette },
  { id: 'joints' as const, label: 'Joints', icon: Link2 },
]

export default function PhysicsEditorPanel({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  modelUrl,
}: PhysicsEditorPanelProps) {
  return (
    <div
      className="relative border-t border-[#333355] bg-[#1a1a2e]/90 backdrop-blur-xl"
      style={{ height: collapsed ? 36 : PANEL_HEIGHT }}
    >
      {/* ── Tab Bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center h-9 px-3 border-b border-[#333355] gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors
              ${
                activeTab === id
                  ? 'bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5'
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Export buttons */}
        <PhysicsExportButtons modelUrl={modelUrl} />

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="h-[calc(100%-36px)] overflow-y-auto p-3">
          {activeTab === 'parts' && <PhysicsPartsPanel />}
          {activeTab === 'materials' && <PhysicsMaterialsPanel />}
          {activeTab === 'joints' && <PhysicsJointsPanel />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create stub export buttons component**

Create a minimal `PhysicsExportButtons.tsx` (full implementation in Task 13):

```typescript
// src/components/physics/PhysicsExportButtons.tsx
'use client'

import { Download } from 'lucide-react'

interface PhysicsExportButtonsProps {
  modelUrl?: string
}

export default function PhysicsExportButtons({ modelUrl }: PhysicsExportButtonsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        disabled={!modelUrl}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors disabled:opacity-30"
      >
        <Download size={12} />
        USDA
      </button>
      <button
        disabled={!modelUrl}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors disabled:opacity-30"
      >
        <Download size={12} />
        USDZ
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/physics/PhysicsEditorPanel.tsx src/components/physics/PhysicsExportButtons.tsx
git commit -m "feat(physics): add PhysicsEditorPanel bottom panel with tab navigation"
```

---

## Task 9: PhysicsPartsPanel Rewrite

**Files:**
- Modify: `src/components/physics/PhysicsPartsPanel.tsx` (full rewrite)

- [ ] **Step 1: Rewrite PhysicsPartsPanel**

Read the existing file first. The rewrite removes the external props dependency and reads directly from `physics-store`. Adds segment import button and GLB upload.

```typescript
// src/components/physics/PhysicsPartsPanel.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, ArrowRight, Search, ChevronDown } from 'lucide-react'
import {
  usePhysicsStore,
  type PhysicsPart,
} from '@/store/physics-store'
import { useWorkspace } from '@/lib/workspace-context'
import { parseGlbForPhysics } from '@/lib/api/phidias'

const PART_TYPES = ['link', 'base', 'tool', 'joint'] as const
const ROLES = ['other', 'actuator', 'support', 'gripper', 'sensor'] as const
const MOBILITY_TYPES = ['fixed', 'revolute', 'prismatic'] as const
const COLLISION_TYPES = ['convexHull', 'mesh', 'convexDecomposition', 'none'] as const

export default function PhysicsPartsPanel() {
  const parts = usePhysicsStore((s) => s.parts)
  const selectedPartId = usePhysicsStore((s) => s.selectedPartId)
  const setSelectedPartId = usePhysicsStore((s) => s.setSelectedPartId)
  const setParts = usePhysicsStore((s) => s.setParts)
  const updatePart = usePhysicsStore((s) => s.updatePart)

  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredParts = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedPart = parts.find((p) => p.id === selectedPartId)

  // GLB upload handler
  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true)
      try {
        const result = await parseGlbForPhysics(file)
        const newParts: PhysicsPart[] = result.parts.map((p, i) => ({
          id: p.id,
          name: p.name,
          color: `hsl(${(i * 360) / result.parts.length}, 70%, 60%)`,
          type: 'link' as const,
          role: 'other' as const,
          mobility: 'fixed' as const,
          mass: null,
          density: 1000,
          collisionType: 'convexHull' as const,
          staticFriction: 0.5,
          dynamicFriction: 0.3,
          restitution: 0.3,
          materialId: null,
          isMaterialCustom: false,
          originalMaterial: p.material,
          vertexCount: p.vertex_count,
        }))
        setParts(newParts)
      } catch (err) {
        console.error('[Physics] GLB parse failed:', err)
      } finally {
        setIsUploading(false)
      }
    },
    [setParts]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file?.name.endsWith('.glb') || file?.name.endsWith('.gltf')) {
        handleFileUpload(file)
      }
    },
    [handleFileUpload]
  )

  return (
    <div className="flex gap-3 h-full">
      {/* ── Left: Part List ───────────────────────────────────────────── */}
      <div className="w-56 flex flex-col gap-2 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#7c3aed]/50"
          />
        </div>

        {/* Parts list */}
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {filteredParts.map((part) => (
            <button
              key={part.id}
              onClick={() => setSelectedPartId(part.id)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left
                ${
                  selectedPartId === part.id
                    ? 'bg-[#7c3aed]/20 border border-[#7c3aed]/30'
                    : 'hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: part.color }}
              />
              <span className="text-white/80 truncate flex-1">{part.name}</span>
              <span className="text-white/30 text-[10px] uppercase">{part.type}</span>
            </button>
          ))}
        </div>

        {/* Upload area */}
        {parts.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-[#333355] rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[#7c3aed]/50 transition-colors"
          >
            <Upload size={20} className="text-white/30" />
            <span className="text-xs text-white/40">
              {isUploading ? 'Parsing...' : 'Drop GLB or click to upload'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
          </div>
        )}

        {/* Summary */}
        <div className="text-[10px] text-white/30 px-1">
          {parts.length} parts | {parts.filter((p) => p.type === 'base').length} base | {parts.filter((p) => p.type === 'link').length} links
        </div>
      </div>

      {/* ── Right: Selected Part Properties ───────────────────────────── */}
      {selectedPart ? (
        <div className="flex-1 space-y-3 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={selectedPart.name}
              onChange={(e) => updatePart(selectedPart.id, { name: e.target.value })}
              className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
            />
          </div>

          {/* Type / Role / Mobility — inline row */}
          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Type"
              value={selectedPart.type}
              options={PART_TYPES}
              onChange={(v) => updatePart(selectedPart.id, { type: v as PhysicsPart['type'] })}
            />
            <SelectField
              label="Role"
              value={selectedPart.role}
              options={ROLES}
              onChange={(v) => updatePart(selectedPart.id, { role: v as PhysicsPart['role'] })}
            />
            <SelectField
              label="Mobility"
              value={selectedPart.mobility}
              options={MOBILITY_TYPES}
              onChange={(v) => updatePart(selectedPart.id, { mobility: v as PhysicsPart['mobility'] })}
            />
          </div>

          {/* Mass & Density */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">
                Mass (kg) <span className="normal-case">{selectedPart.mass === null ? '— auto' : ''}</span>
              </label>
              <input
                type="number"
                value={selectedPart.mass ?? ''}
                placeholder="Auto"
                onChange={(e) =>
                  updatePart(selectedPart.id, {
                    mass: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Density (kg/m3)</label>
              <input
                type="number"
                value={selectedPart.density}
                onChange={(e) =>
                  updatePart(selectedPart.id, { density: parseFloat(e.target.value) || 0 })
                }
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
              />
            </div>
          </div>

          {/* Collision */}
          <SelectField
            label="Collision"
            value={selectedPart.collisionType}
            options={COLLISION_TYPES}
            onChange={(v) => updatePart(selectedPart.id, { collisionType: v as PhysicsPart['collisionType'] })}
          />

          {/* Surface Physics */}
          <div className="grid grid-cols-3 gap-2">
            <SliderField
              label="Static Friction"
              value={selectedPart.staticFriction}
              min={0} max={2} step={0.01}
              onChange={(v) => updatePart(selectedPart.id, { staticFriction: v })}
            />
            <SliderField
              label="Dynamic Friction"
              value={selectedPart.dynamicFriction}
              min={0} max={2} step={0.01}
              onChange={(v) => updatePart(selectedPart.id, { dynamicFriction: v })}
            />
            <SliderField
              label="Restitution"
              value={selectedPart.restitution}
              min={0} max={1} step={0.01}
              onChange={(v) => updatePart(selectedPart.id, { restitution: v })}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/30 text-xs">
          Select a part to edit properties
        </div>
      )}
    </div>
  )
}

// ─── Helper components ─────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wider">
        {label} <span className="text-white/50">{value.toFixed(2)}</span>
      </label>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-0.5 accent-[#7c3aed]"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/physics/PhysicsPartsPanel.tsx
git commit -m "feat(physics): rewrite PhysicsPartsPanel with store integration and GLB upload"
```

---

## Task 10: PhysicsMaterialsPanel Rewrite

**Files:**
- Modify: `src/components/physics/PhysicsMaterialsPanel.tsx` (full rewrite)

- [ ] **Step 1: Rewrite PhysicsMaterialsPanel**

Read existing file first. The rewrite reads from `physics-store` directly. Shows a grid of material presets with click-to-apply on the selected part.

```typescript
// src/components/physics/PhysicsMaterialsPanel.tsx
'use client'

import { usePhysicsStore } from '@/store/physics-store'

export default function PhysicsMaterialsPanel() {
  const materialPresets = usePhysicsStore((s) => s.materialPresets)
  const selectedPartId = usePhysicsStore((s) => s.selectedPartId)
  const parts = usePhysicsStore((s) => s.parts)
  const applyMaterialPreset = usePhysicsStore((s) => s.applyMaterialPreset)

  const selectedPart = parts.find((p) => p.id === selectedPartId)

  return (
    <div className="flex gap-3 h-full">
      {/* ── Material Grid ─────────────────────────────────────────────── */}
      <div className="flex-1">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Material Presets
          {!selectedPartId && (
            <span className="ml-2 text-[#f5a623]">select a part first</span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {materialPresets.map((mat) => {
            const isActive = selectedPart?.materialId === mat.id && !selectedPart.isMaterialCustom
            return (
              <button
                key={mat.id}
                disabled={!selectedPartId}
                onClick={() => selectedPartId && applyMaterialPreset(selectedPartId, mat.id)}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors
                  ${isActive
                    ? 'bg-[#7c3aed]/20 border border-[#7c3aed]/40 ring-1 ring-[#7c3aed]/30'
                    : 'bg-white/5 border border-[#333355] hover:bg-white/10 disabled:opacity-30'
                  }
                `}
              >
                <div
                  className="w-6 h-6 rounded-full border border-white/10"
                  style={{ backgroundColor: mat.color }}
                />
                <span className="text-white/70 text-[10px]">{mat.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Current Material Info ──────────────────────────────────────── */}
      {selectedPart && (
        <div className="w-48 shrink-0 space-y-2">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            Current: {selectedPart.materialId ?? 'Custom'}
            {selectedPart.isMaterialCustom && selectedPart.materialId && (
              <span className="ml-1 text-[#f5a623]">(modified)</span>
            )}
          </div>
          <InfoRow label="Density" value={`${selectedPart.density} kg/m³`} />
          <InfoRow label="Static Friction" value={selectedPart.staticFriction.toFixed(2)} />
          <InfoRow label="Dynamic Friction" value={selectedPart.dynamicFriction.toFixed(2)} />
          <InfoRow label="Restitution" value={selectedPart.restitution.toFixed(2)} />
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-white/40">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Delete PhysicsPropertiesPanel**

Properties are now inline in PhysicsPartsPanel. Remove the old file:

```bash
rm src/components/physics/PhysicsPropertiesPanel.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/physics/PhysicsMaterialsPanel.tsx
git rm src/components/physics/PhysicsPropertiesPanel.tsx
git commit -m "feat(physics): rewrite PhysicsMaterialsPanel, remove PhysicsPropertiesPanel"
```

---

## Task 11: PhysicsJointsPanel Rewrite

**Files:**
- Modify: `src/components/physics/PhysicsJointsPanel.tsx` (full rewrite)
- Create: `src/components/physics/PhysicsMotionPreview.tsx`

- [ ] **Step 1: Rewrite PhysicsJointsPanel**

Read existing file first. The rewrite reads from `physics-store`, adds anchor numeric inputs with bidirectional sync, and includes the motion preview slider.

```typescript
// src/components/physics/PhysicsJointsPanel.tsx
'use client'

import { useCallback } from 'react'
import { Plus, Trash2, RotateCw, ArrowRightLeft, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { usePhysicsStore, type PhysicsJoint } from '@/store/physics-store'
import PhysicsMotionPreview from './PhysicsMotionPreview'
import { v4 as uuidv4 } from 'uuid'

const JOINT_TYPES = ['Revolute', 'Prismatic', 'Fixed', 'Spherical', '6-DOF'] as const
const DRIVE_TYPES = ['position', 'velocity', 'none'] as const
const AXIS_PRESETS: { label: string; value: [number, number, number] }[] = [
  { label: 'X', value: [1, 0, 0] },
  { label: 'Y', value: [0, 1, 0] },
  { label: 'Z', value: [0, 0, 1] },
]

const JOINT_ICONS: Record<string, typeof RotateCw> = {
  Revolute: RotateCw,
  Prismatic: ArrowRightLeft,
  Fixed: Lock,
  Spherical: RotateCw,
  '6-DOF': RotateCw,
}

export default function PhysicsJointsPanel() {
  const parts = usePhysicsStore((s) => s.parts)
  const joints = usePhysicsStore((s) => s.joints)
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId)
  const setSelectedJointId = usePhysicsStore((s) => s.setSelectedJointId)
  const addJoint = usePhysicsStore((s) => s.addJoint)
  const updateJoint = usePhysicsStore((s) => s.updateJoint)
  const removeJoint = usePhysicsStore((s) => s.removeJoint)

  const selectedJoint = joints.find((j) => j.id === selectedJointId)

  const handleAddJoint = useCallback(() => {
    if (parts.length < 2) return
    const basePart = parts.find((p) => p.type === 'base') || parts[0]
    const childPart = parts.find((p) => p.id !== basePart.id) || parts[1]
    const joint: PhysicsJoint = {
      id: uuidv4(),
      name: `Joint_${joints.length + 1}`,
      type: 'Revolute',
      parentPartId: basePart.id,
      childPartId: childPart.id,
      axis: [0, 0, 1],
      anchor: [0, 0, 0],
      limitsEnabled: true,
      limitLower: -90,
      limitUpper: 90,
      driveStiffness: 1000,
      driveDamping: 100,
      driveMaxForce: 1000,
      driveType: 'position',
      disableCollision: true,
    }
    addJoint(joint)
    setSelectedJointId(joint.id)
  }, [parts, joints, addJoint, setSelectedJointId])

  return (
    <div className="flex gap-3 h-full">
      {/* ── Left: Joint List ──────────────────────────────────────────── */}
      <div className="w-48 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Joints ({joints.length})
          </span>
          <button
            onClick={handleAddJoint}
            disabled={parts.length < 2}
            className="w-5 h-5 flex items-center justify-center rounded bg-[#7c3aed]/20 text-[#a78bfa] hover:bg-[#7c3aed]/30 transition-colors disabled:opacity-30"
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5">
          {joints.map((joint) => {
            const Icon = JOINT_ICONS[joint.type] || RotateCw
            return (
              <button
                key={joint.id}
                onClick={() => setSelectedJointId(joint.id)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left
                  ${
                    selectedJointId === joint.id
                      ? 'bg-[#7c3aed]/20 border border-[#7c3aed]/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                <Icon size={12} className="text-white/40 shrink-0" />
                <span className="text-white/80 truncate flex-1">{joint.name}</span>
                <span className="text-white/30 text-[10px]">{joint.type}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: Selected Joint Editor ──────────────────────────────── */}
      {selectedJoint ? (
        <div className="flex-1 space-y-3 overflow-y-auto">
          {/* Name + Type row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={selectedJoint.name}
                onChange={(e) => updateJoint(selectedJoint.id, { name: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Type</label>
              <select
                value={selectedJoint.type}
                onChange={(e) => updateJoint(selectedJoint.id, { type: e.target.value as PhysicsJoint['type'] })}
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
              >
                {JOINT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Parent / Child */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Parent</label>
              <select
                value={selectedJoint.parentPartId}
                onChange={(e) => updateJoint(selectedJoint.id, { parentPartId: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
              >
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Child</label>
              <select
                value={selectedJoint.childPartId}
                onChange={(e) => updateJoint(selectedJoint.id, { childPartId: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
              >
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Axis + Anchor */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Axis</label>
              <div className="flex gap-1 mt-0.5">
                {AXIS_PRESETS.map(({ label, value }) => {
                  const isActive =
                    selectedJoint.axis[0] === value[0] &&
                    selectedJoint.axis[1] === value[1] &&
                    selectedJoint.axis[2] === value[2]
                  return (
                    <button
                      key={label}
                      onClick={() => updateJoint(selectedJoint.id, { axis: value })}
                      className={`
                        flex-1 py-1 rounded-md text-xs font-medium transition-colors
                        ${isActive
                          ? 'bg-[#7c3aed]/30 text-[#a78bfa] border border-[#7c3aed]/40'
                          : 'bg-white/5 text-white/50 border border-[#333355] hover:bg-white/10'
                        }
                      `}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Anchor (x, y, z)</label>
              <div className="flex gap-1 mt-0.5">
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.01"
                    value={selectedJoint.anchor[i]}
                    onChange={(e) => {
                      const newAnchor = [...selectedJoint.anchor] as [number, number, number]
                      newAnchor[i] = parseFloat(e.target.value) || 0
                      updateJoint(selectedJoint.id, { anchor: newAnchor })
                    }}
                    className="w-full px-1.5 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Limits (only for Revolute/Prismatic) */}
          {(selectedJoint.type === 'Revolute' || selectedJoint.type === 'Prismatic') && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Limits</label>
                <input
                  type="checkbox"
                  checked={selectedJoint.limitsEnabled}
                  onChange={(e) => updateJoint(selectedJoint.id, { limitsEnabled: e.target.checked })}
                  className="accent-[#7c3aed]"
                />
              </div>
              {selectedJoint.limitsEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/30">
                      Lower ({selectedJoint.type === 'Revolute' ? 'deg' : 'm'})
                    </label>
                    <input
                      type="number"
                      value={selectedJoint.limitLower}
                      onChange={(e) => updateJoint(selectedJoint.id, { limitLower: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30">
                      Upper ({selectedJoint.type === 'Revolute' ? 'deg' : 'm'})
                    </label>
                    <input
                      type="number"
                      value={selectedJoint.limitUpper}
                      onChange={(e) => updateJoint(selectedJoint.id, { limitUpper: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drive params (only for Revolute/Prismatic) */}
          {(selectedJoint.type === 'Revolute' || selectedJoint.type === 'Prismatic') && (
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Drive</label>
                <select
                  value={selectedJoint.driveType}
                  onChange={(e) => updateJoint(selectedJoint.id, { driveType: e.target.value as PhysicsJoint['driveType'] })}
                  className="w-full mt-0.5 px-1.5 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50"
                >
                  {DRIVE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30">Stiffness</label>
                <input type="number" value={selectedJoint.driveStiffness}
                  onChange={(e) => updateJoint(selectedJoint.id, { driveStiffness: parseFloat(e.target.value) || 0 })}
                  className="w-full px-1.5 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50" />
              </div>
              <div>
                <label className="text-[10px] text-white/30">Damping</label>
                <input type="number" value={selectedJoint.driveDamping}
                  onChange={(e) => updateJoint(selectedJoint.id, { driveDamping: parseFloat(e.target.value) || 0 })}
                  className="w-full px-1.5 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50" />
              </div>
              <div>
                <label className="text-[10px] text-white/30">Max Force</label>
                <input type="number" value={selectedJoint.driveMaxForce}
                  onChange={(e) => updateJoint(selectedJoint.id, { driveMaxForce: parseFloat(e.target.value) || 0 })}
                  className="w-full px-1.5 py-1 text-xs bg-white/5 border border-[#333355] rounded-md text-white/80 focus:outline-none focus:border-[#7c3aed]/50" />
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-white/60">
              <input
                type="checkbox"
                checked={selectedJoint.disableCollision}
                onChange={(e) => updateJoint(selectedJoint.id, { disableCollision: e.target.checked })}
                className="accent-[#7c3aed]"
              />
              Disable parent-child collision
            </label>
          </div>

          {/* Motion Preview */}
          {(selectedJoint.type === 'Revolute' || selectedJoint.type === 'Prismatic') && (
            <PhysicsMotionPreview joint={selectedJoint} />
          )}

          {/* Delete */}
          <button
            onClick={() => removeJoint(selectedJoint.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
            Delete Joint
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/30 text-xs">
          {joints.length === 0 ? 'Add a joint to get started' : 'Select a joint to edit'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PhysicsMotionPreview**

The slider that controls `jointPreviewValue` in the store. The actual 3D transform is handled by `MotionPreviewController` (Task 12).

```typescript
// src/components/physics/PhysicsMotionPreview.tsx
'use client'

import { usePhysicsStore, type PhysicsJoint } from '@/store/physics-store'

interface PhysicsMotionPreviewProps {
  joint: PhysicsJoint
}

export default function PhysicsMotionPreview({ joint }: PhysicsMotionPreviewProps) {
  const jointPreviewValue = usePhysicsStore((s) => s.jointPreviewValue)
  const setJointPreviewValue = usePhysicsStore((s) => s.setJointPreviewValue)

  const isRevolute = joint.type === 'Revolute'
  const unit = isRevolute ? 'deg' : 'm'
  const min = joint.limitsEnabled ? joint.limitLower : (isRevolute ? -180 : -1)
  const max = joint.limitsEnabled ? joint.limitUpper : (isRevolute ? 180 : 1)

  return (
    <div className="bg-white/5 rounded-lg p-2 border border-[#333355]">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-white/40 uppercase tracking-wider">
          Motion Preview
        </label>
        <span className="text-xs text-[#a78bfa] font-mono">
          {jointPreviewValue.toFixed(1)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={isRevolute ? 1 : 0.01}
        value={jointPreviewValue}
        onChange={(e) => setJointPreviewValue(parseFloat(e.target.value))}
        onMouseUp={() => setJointPreviewValue(0)}
        onTouchEnd={() => setJointPreviewValue(0)}
        className="w-full accent-[#7c3aed]"
      />
      <div className="flex justify-between text-[10px] text-white/30">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Install uuid if not present**

Check `package.json` for uuid dependency. If not present:

```bash
pnpm add uuid && pnpm add -D @types/uuid
```

- [ ] **Step 4: Commit**

```bash
git add src/components/physics/PhysicsJointsPanel.tsx src/components/physics/PhysicsMotionPreview.tsx
git commit -m "feat(physics): rewrite PhysicsJointsPanel with anchor inputs and motion preview"
```

---

## Task 12: Joint 3D Visualizer

**Files:**
- Create: `src/components/physics/JointVisualizer.tsx`

- [ ] **Step 1: Create JointVisualizer component**

This is an R3F component rendered as a child of ThreeViewport's `<Canvas>`. It renders visual markers for all joints.

```typescript
// src/components/physics/JointVisualizer.tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { usePhysicsStore, type PhysicsJoint, type PhysicsPart } from '@/store/physics-store'

const AXIS_COLORS: Record<string, string> = {
  '1,0,0': '#ff4444',
  '0,1,0': '#44ff44',
  '0,0,1': '#4444ff',
}

function getAxisColor(axis: [number, number, number]): string {
  const key = axis.join(',')
  return AXIS_COLORS[key] || '#ffff44'
}

interface JointMarkerProps {
  joint: PhysicsJoint
  isSelected: boolean
  childPart: PhysicsPart | undefined
  parentPart: PhysicsPart | undefined
}

function JointMarker({ joint, isSelected, childPart, parentPart }: JointMarkerProps) {
  const axisColor = getAxisColor(joint.axis)
  const opacity = isSelected ? 1.0 : 0.4
  const anchorPos = new THREE.Vector3(...joint.anchor)
  const axisDir = new THREE.Vector3(...joint.axis).normalize()
  const arrowEnd = anchorPos.clone().add(axisDir.clone().multiplyScalar(0.15))

  return (
    <group>
      {/* Anchor sphere */}
      <mesh position={anchorPos}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? '#ffcc00' : '#ffcc00'}
          transparent
          opacity={opacity}
          depthTest={false}
        />
      </mesh>

      {/* Axis arrow */}
      <Line
        points={[anchorPos.toArray(), arrowEnd.toArray()]}
        color={axisColor}
        lineWidth={isSelected ? 3 : 1.5}
        transparent
        opacity={opacity}
        depthTest={false}
      />

      {/* Arrow tip */}
      <mesh position={arrowEnd}>
        <coneGeometry args={[0.008, 0.025, 8]} />
        <meshBasicMaterial color={axisColor} transparent opacity={opacity} depthTest={false} />
      </mesh>
    </group>
  )
}

export default function JointVisualizer() {
  const joints = usePhysicsStore((s) => s.joints)
  const parts = usePhysicsStore((s) => s.parts)
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId)

  return (
    <group>
      {joints.map((joint) => (
        <JointMarker
          key={joint.id}
          joint={joint}
          isSelected={selectedJointId === joint.id}
          childPart={parts.find((p) => p.id === joint.childPartId)}
          parentPart={parts.find((p) => p.id === joint.parentPartId)}
        />
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Add JointVisualizer to Physics page**

In `src/app/workspace/physics/page.tsx`, import and render `JointVisualizer` as a child of `ThreeViewport`:

Add import:
```typescript
import JointVisualizer from '@/components/physics/JointVisualizer'
```

Inside the `<ThreeViewport>` component, add:
```tsx
<ThreeViewport
  modelUrl={activeAsset?.modelUrl}
  renderMode={renderMode}
  segmentColors={segmentColors}
  selectedObjectId={selectedPartId}
  onObjectSelect={handleObjectSelect}
  showGrid
  showAxes
>
  <JointVisualizer />
</ThreeViewport>
```

Verify that `ThreeViewport` passes `children` through to the R3F `<Canvas>`. Check `ThreeViewport.tsx` — if it doesn't render `{children}` inside the Canvas, this approach won't work and you'll need to add children support. Looking at the ThreeViewport props interface (line 93: `children?: React.ReactNode`), it does accept children — verify it's rendered inside the Canvas.

- [ ] **Step 3: Commit**

```bash
git add src/components/physics/JointVisualizer.tsx src/app/workspace/physics/page.tsx
git commit -m "feat(physics): add JointVisualizer 3D markers for anchors and axes"
```

---

## Task 13: Anchor Gizmo (Draggable TransformControls)

**Files:**
- Create: `src/components/physics/AnchorGizmo.tsx`

- [ ] **Step 1: Create AnchorGizmo component**

Uses `@react-three/drei`'s `TransformControls` in translate mode. Only shown when a joint is selected. Syncs position back to store on drag.

```typescript
// src/components/physics/AnchorGizmo.tsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { TransformControls } from '@react-three/drei'
import { usePhysicsStore } from '@/store/physics-store'

export default function AnchorGizmo() {
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId)
  const joints = usePhysicsStore((s) => s.joints)
  const updateJoint = usePhysicsStore((s) => s.updateJoint)

  const selectedJoint = joints.find((j) => j.id === selectedJointId)
  const meshRef = useRef<THREE.Mesh>(null!)
  const controlsRef = useRef<any>(null)

  // Sync mesh position when joint anchor changes (e.g., from panel input)
  useEffect(() => {
    if (selectedJoint && meshRef.current) {
      meshRef.current.position.set(...selectedJoint.anchor)
    }
  }, [selectedJoint?.anchor[0], selectedJoint?.anchor[1], selectedJoint?.anchor[2]])

  // Handle drag end — write back to store
  const handleDragEnd = useCallback(() => {
    if (!selectedJointId || !meshRef.current) return
    const pos = meshRef.current.position
    updateJoint(selectedJointId, {
      anchor: [
        Math.round(pos.x * 1000) / 1000,
        Math.round(pos.y * 1000) / 1000,
        Math.round(pos.z * 1000) / 1000,
      ],
    })
  }, [selectedJointId, updateJoint])

  // Attach drag event listener
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.addEventListener('mouseUp', handleDragEnd)
    return () => controls.removeEventListener('mouseUp', handleDragEnd)
  }, [handleDragEnd])

  if (!selectedJoint) return null

  return (
    <TransformControls
      ref={controlsRef}
      object={meshRef}
      mode="translate"
      size={0.5}
    >
      <mesh ref={meshRef} position={selectedJoint.anchor}>
        {/* Invisible mesh — TransformControls needs an object to attach to.
            The visible anchor sphere is in JointVisualizer. */}
        <sphereGeometry args={[0.001]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </TransformControls>
  )
}
```

- [ ] **Step 2: Add AnchorGizmo to Physics page**

In `src/app/workspace/physics/page.tsx`, add:

```typescript
import AnchorGizmo from '@/components/physics/AnchorGizmo'
```

Inside `<ThreeViewport>`:
```tsx
<JointVisualizer />
<AnchorGizmo />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/physics/AnchorGizmo.tsx src/app/workspace/physics/page.tsx
git commit -m "feat(physics): add AnchorGizmo for draggable joint anchor editing"
```

---

## Task 14: Motion Preview Controller (useFrame Animation)

**Files:**
- Create: `src/components/physics/MotionPreviewController.tsx`

- [ ] **Step 1: Create MotionPreviewController**

This R3F component applies a temporary transform to the child mesh based on the `jointPreviewValue` from the store. Uses `useFrame` for 60fps updates.

```typescript
// src/components/physics/MotionPreviewController.tsx
'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { usePhysicsStore } from '@/store/physics-store'

export default function MotionPreviewController() {
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId)
  const joints = usePhysicsStore((s) => s.joints)
  const parts = usePhysicsStore((s) => s.parts)
  const jointPreviewValue = usePhysicsStore((s) => s.jointPreviewValue)

  const { scene } = useThree()
  const originalMatrixRef = useRef<THREE.Matrix4 | null>(null)
  const targetMeshRef = useRef<THREE.Object3D | null>(null)

  const selectedJoint = joints.find((j) => j.id === selectedJointId)
  const childPart = selectedJoint
    ? parts.find((p) => p.id === selectedJoint.childPartId)
    : null

  // Find child mesh in the scene by name
  useEffect(() => {
    // Reset previous mesh
    if (targetMeshRef.current && originalMatrixRef.current) {
      targetMeshRef.current.matrix.copy(originalMatrixRef.current)
      targetMeshRef.current.matrixAutoUpdate = true
      targetMeshRef.current = null
      originalMatrixRef.current = null
    }

    if (!childPart) return

    // Find mesh by name in scene
    let found: THREE.Object3D | null = null
    scene.traverse((obj) => {
      if (obj.name === childPart.name && !found) {
        found = obj
      }
    })

    if (found) {
      targetMeshRef.current = found
      originalMatrixRef.current = found.matrix.clone()
      found.matrixAutoUpdate = false
    }

    return () => {
      // Restore on unmount/change
      if (targetMeshRef.current && originalMatrixRef.current) {
        targetMeshRef.current.matrix.copy(originalMatrixRef.current)
        targetMeshRef.current.matrixAutoUpdate = true
      }
    }
  }, [childPart?.name, scene])

  useFrame(() => {
    if (
      !selectedJoint ||
      !targetMeshRef.current ||
      !originalMatrixRef.current ||
      jointPreviewValue === 0
    ) {
      // Reset to original if no preview
      if (targetMeshRef.current && originalMatrixRef.current && jointPreviewValue === 0) {
        targetMeshRef.current.matrix.copy(originalMatrixRef.current)
      }
      return
    }

    const anchor = new THREE.Vector3(...selectedJoint.anchor)
    const axis = new THREE.Vector3(...selectedJoint.axis).normalize()

    // Start from original matrix
    const matrix = originalMatrixRef.current.clone()

    if (selectedJoint.type === 'Revolute') {
      // Rotate child around anchor + axis
      const angle = THREE.MathUtils.degToRad(jointPreviewValue)

      // Translate to anchor origin → rotate → translate back
      const toOrigin = new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z)
      const rotation = new THREE.Matrix4().makeRotationAxis(axis, angle)
      const fromOrigin = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z)

      const previewMatrix = new THREE.Matrix4()
        .multiply(fromOrigin)
        .multiply(rotation)
        .multiply(toOrigin)
        .multiply(matrix)

      targetMeshRef.current.matrix.copy(previewMatrix)
    } else if (selectedJoint.type === 'Prismatic') {
      // Translate child along axis
      const offset = axis.clone().multiplyScalar(jointPreviewValue)
      const translation = new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z)

      const previewMatrix = new THREE.Matrix4()
        .multiply(translation)
        .multiply(matrix)

      targetMeshRef.current.matrix.copy(previewMatrix)
    }
  })

  return null // Pure logic component, no visual output
}
```

- [ ] **Step 2: Add MotionPreviewController to Physics page**

In `src/app/workspace/physics/page.tsx`, add:

```typescript
import MotionPreviewController from '@/components/physics/MotionPreviewController'
```

Inside `<ThreeViewport>`:
```tsx
<JointVisualizer />
<AnchorGizmo />
<MotionPreviewController />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/physics/MotionPreviewController.tsx src/app/workspace/physics/page.tsx
git commit -m "feat(physics): add MotionPreviewController for real-time joint animation preview"
```

---

## Task 15: Export Validation and Buttons

**Files:**
- Modify: `src/components/physics/PhysicsExportButtons.tsx` (full implementation)

- [ ] **Step 1: Implement full export buttons with validation**

```typescript
// src/components/physics/PhysicsExportButtons.tsx
'use client'

import { useState, useCallback } from 'react'
import { Download, AlertTriangle, CheckCircle } from 'lucide-react'
import { usePhysicsStore } from '@/store/physics-store'
import { exportArticulationUsda, exportArticulationUsdz, downloadArticulationFile } from '@/lib/api/phidias'
import type { ArticulationExportPart, ArticulationExportJoint } from '@/lib/api/types'

interface PhysicsExportButtonsProps {
  modelUrl?: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateArticulation(
  parts: ReturnType<typeof usePhysicsStore.getState>['parts'],
  joints: ReturnType<typeof usePhysicsStore.getState>['joints']
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Must have base
  if (!parts.some((p) => p.type === 'base')) {
    errors.push('At least one part must be type "base"')
  }

  // Joint completeness
  for (const joint of joints) {
    if (!parts.find((p) => p.id === joint.parentPartId)) {
      errors.push(`Joint "${joint.name}": parent part not found`)
    }
    if (!parts.find((p) => p.id === joint.childPartId)) {
      errors.push(`Joint "${joint.name}": child part not found`)
    }
  }

  // No orphan links
  const linkedPartIds = new Set(
    joints.flatMap((j) => [j.parentPartId, j.childPartId])
  )
  for (const part of parts) {
    if (part.type === 'link' && !linkedPartIds.has(part.id)) {
      errors.push(`Part "${part.name}" (link) is not connected to any joint`)
    }
  }

  // Name conflicts after sanitization
  const sanitized = parts.map((p) => p.name.replace(/[^a-zA-Z0-9_]/g, '_'))
  const seen = new Set<string>()
  for (const name of sanitized) {
    if (seen.has(name)) {
      errors.push(`Duplicate part name after sanitization: "${name}"`)
    }
    seen.add(name)
  }

  // Anchor sanity
  for (const joint of joints) {
    if (joint.anchor[0] === 0 && joint.anchor[1] === 0 && joint.anchor[2] === 0) {
      warnings.push(`Joint "${joint.name}": anchor is at origin [0,0,0]`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export default function PhysicsExportButtons({ modelUrl }: PhysicsExportButtonsProps) {
  const parts = usePhysicsStore((s) => s.parts)
  const joints = usePhysicsStore((s) => s.joints)
  const [isExporting, setIsExporting] = useState<'usda' | 'usdz' | null>(null)

  const handleExport = useCallback(
    async (format: 'usda' | 'usdz') => {
      if (!modelUrl) return

      // Validate
      const validation = validateArticulation(parts, joints)
      if (!validation.valid) {
        // Log and show validation errors
        // NOTE: Use the project's custom Toast/Modal component here.
        // Search for existing Toast usage in the codebase (e.g., in segment or model pages)
        // and use the same pattern. Do NOT use native alert() per CLAUDE.md rules.
        console.error('[Physics Export] Validation failed:', validation.errors)
        return
      }
      if (validation.warnings.length > 0) {
        console.warn('[Physics Export] Warnings:', validation.warnings)
      }

      setIsExporting(format)
      try {
        // Fetch the GLB file from modelUrl
        const glbResponse = await fetch(modelUrl)
        const glbBlob = await glbResponse.blob()
        const glbFile = new File([glbBlob], 'model.glb', { type: 'model/gltf-binary' })

        // Build export data
        const exportParts: ArticulationExportPart[] = parts.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type === 'joint' ? 'link' : p.type, // backend doesn't accept 'joint' type
          mass: p.mass,
          density: p.density,
          collision_type: p.collisionType,
          static_friction: p.staticFriction,
          dynamic_friction: p.dynamicFriction,
          restitution: p.restitution,
        }))

        const exportJoints: ArticulationExportJoint[] = joints
          .filter((j) => j.type === 'Revolute' || j.type === 'Prismatic' || j.type === 'Fixed')
          .map((j) => ({
            name: j.name,
            parent: j.parentPartId,
            child: j.childPartId,
            type: j.type.toLowerCase() as 'revolute' | 'prismatic' | 'fixed',
            axis: j.axis,
            anchor: j.anchor,
            lower_limit: j.limitsEnabled ? j.limitLower : null,
            upper_limit: j.limitsEnabled ? j.limitUpper : null,
            drive_stiffness: j.driveStiffness,
            drive_damping: j.driveDamping,
            drive_max_force: j.driveMaxForce,
            drive_type: j.driveType,
            disable_collision: j.disableCollision,
          }))

        const exportData = {
          glb_file: glbFile,
          model_name: 'PhysicsModel',
          parts: exportParts,
          joints: exportJoints,
        }

        const result =
          format === 'usda'
            ? await exportArticulationUsda(exportData)
            : await exportArticulationUsdz(exportData)

        if (result.success) {
          // Download the file
          const blob = await downloadArticulationFile(result.filename)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = result.filename
          a.click()
          URL.revokeObjectURL(url)
        }
      } catch (err) {
        console.error('[Physics Export] Failed:', err)
      } finally {
        setIsExporting(null)
      }
    },
    [modelUrl, parts, joints]
  )

  const disabled = !modelUrl || parts.length === 0

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleExport('usda')}
        disabled={disabled || isExporting !== null}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors disabled:opacity-30"
      >
        <Download size={12} />
        {isExporting === 'usda' ? 'Exporting...' : 'USDA'}
      </button>
      <button
        onClick={() => handleExport('usdz')}
        disabled={disabled || isExporting !== null}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors disabled:opacity-30"
      >
        <Download size={12} />
        {isExporting === 'usdz' ? 'Exporting...' : 'USDZ'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/physics/PhysicsExportButtons.tsx
git commit -m "feat(physics): implement USDA/USDZ export with pre-export validation"
```

---

## Task 16: Segment to Physics Bridge

**Files:**
- Modify: `src/lib/workspace-context.tsx:55-78`
- Modify: `src/app/workspace/segment/page.tsx:1370-1478`
- Modify: `src/app/workspace/physics/page.tsx`

- [ ] **Step 1: Add pendingPhysicsData to WorkspaceContext**

In `src/lib/workspace-context.tsx`, add to the `WorkspaceContextValue` interface (around line 76):

```typescript
// Add after segmentHierarchy fields
pendingPhysicsData: { modelUrl: string; hierarchy: HierarchyItem[] } | null
setPendingPhysicsData: (data: { modelUrl: string; hierarchy: HierarchyItem[] } | null) => void
```

In the `WorkspaceProvider` component, add state:

```typescript
const [pendingPhysicsData, setPendingPhysicsData] = useState<{
  modelUrl: string
  hierarchy: HierarchyItem[]
} | null>(null)
```

Add to the context value object:

```typescript
pendingPhysicsData,
setPendingPhysicsData,
```

- [ ] **Step 2: Add "Physics →" button to Segment toolbar**

In `src/app/workspace/segment/page.tsx`, find the bottom toolbar area (around line 1370). Add a button before the ExportDropdown. Import what's needed:

```typescript
import { Atom } from 'lucide-react'
import { useRouter } from 'next/navigation'
```

Add the router:
```typescript
const router = useRouter()
```

Add the handler:
```typescript
const handleSendToPhysics = useCallback(() => {
  if (!activeAsset?.modelUrl || !segmentHierarchy) return
  setPendingPhysicsData({
    modelUrl: activeAsset.modelUrl,
    hierarchy: segmentHierarchy,
  })
  router.push('/workspace/physics')
}, [activeAsset?.modelUrl, segmentHierarchy, setPendingPhysicsData, router])
```

Add the button in the toolbar (before ExportDropdown, after the separator):
```tsx
<div className="h-5 w-px bg-[#333355]" />
<button
  onClick={handleSendToPhysics}
  disabled={!activeAsset?.modelUrl || parts.length === 0}
  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors disabled:opacity-30"
  title="Send to Physics"
>
  <Atom size={14} />
  Physics
</button>
```

- [ ] **Step 3: Handle incoming segment data in Physics page**

In `src/app/workspace/physics/page.tsx`, add to the imports:

```typescript
import { useWorkspace } from '@/lib/workspace-context'
```

Update the workspace context usage:

```typescript
const { assets, activeAssetId, pendingPhysicsData, setPendingPhysicsData } = useWorkspace()
```

Add a `useEffect` to consume pending data:

```typescript
useEffect(() => {
  if (!pendingPhysicsData) return

  // Convert HierarchyItem[] to PhysicsPart[]
  const newParts: PhysicsPart[] = pendingPhysicsData.hierarchy
    .filter((item) => item.type === 'mesh' || !item.type)
    .map((item, i, arr) => ({
      id: item.id,
      name: item.name,
      color: item.color || `hsl(${(i * 360) / arr.length}, 70%, 60%)`,
      type: 'link' as const,
      role: 'other' as const,
      mobility: 'fixed' as const,
      mass: null,
      density: 1000,
      collisionType: 'convexHull' as const,
      staticFriction: 0.5,
      dynamicFriction: 0.3,
      restitution: 0.3,
      materialId: null,
      isMaterialCustom: false,
      originalMaterial: null,
      vertexCount: 0,
    }))

  if (parts.length > 0) {
    // Existing data — show confirmation
    // For now, overwrite. TODO: Add confirmation Modal
    console.warn('[Physics] Overwriting existing parts with segment data')
  }

  setParts(newParts)
  usePhysicsStore.getState().setJoints([])
  usePhysicsStore.temporal.getState().clear()
  setPendingPhysicsData(null)
}, [pendingPhysicsData])
```

Note: The `HierarchyItem` type is imported from `src/lib/api/types.ts` (line 169). Check the exact structure and adjust the conversion accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/workspace-context.tsx src/app/workspace/segment/page.tsx src/app/workspace/physics/page.tsx
git commit -m "feat(physics): add Segment → Physics bridge with context handoff"
```

---

## Task 17: ExportDropdown Integration

**Files:**
- Modify: `src/components/shared/ExportDropdown.tsx:272-322`

- [ ] **Step 1: Add USDA/USDZ options to ExportDropdown**

In `src/components/shared/ExportDropdown.tsx`, the dropdown menu is around lines 272–322. Add USDA and USDZ options that are only visible when the Physics tab is active.

First, detect if we're on the Physics tab. Add import:

```typescript
import { usePathname } from 'next/navigation'
```

Inside the component, add:

```typescript
const pathname = usePathname()
const isPhysicsTab = pathname?.includes('/workspace/physics')
```

In the dropdown menu (after the existing `.usdz` option around line 320), add:

```tsx
{isPhysicsTab && (
  <>
    <div className="h-px bg-[#333355] my-1" />
    <button
      onClick={() => {
        setOpen(false)
        // Dispatch to PhysicsExportButtons via a custom event
        window.dispatchEvent(new CustomEvent('physics-export', { detail: 'usda' }))
      }}
      className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 rounded-md transition-colors"
    >
      .usda (Physics)
    </button>
    <button
      onClick={() => {
        setOpen(false)
        window.dispatchEvent(new CustomEvent('physics-export', { detail: 'usdz' }))
      }}
      className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 rounded-md transition-colors"
    >
      .usdz (Physics)
    </button>
  </>
)}
```

Then in `PhysicsExportButtons.tsx`, add a listener for this event:

```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const format = (e as CustomEvent).detail as 'usda' | 'usdz'
    handleExport(format)
  }
  window.addEventListener('physics-export', handler)
  return () => window.removeEventListener('physics-export', handler)
}, [handleExport])
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/ExportDropdown.tsx src/components/physics/PhysicsExportButtons.tsx
git commit -m "feat(physics): add USDA/USDZ options in ExportDropdown for Physics tab"
```

---

## Task 18: Backend Microservice (articulation-service)

**Files:** All in a new repo at `/Users/between2058/Documents/code/articulation-service/`

This task creates the independent backend. It's based on the articulation-mvp but with material extraction and UsdPreviewSurface support.

- [ ] **Step 1: Initialize project structure**

```bash
mkdir -p /Users/between2058/Documents/code/articulation-service/{services,models,outputs,uploads,logs}
cd /Users/between2058/Documents/code/articulation-service
git init
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
python-multipart==0.0.17
pydantic>=2.0.0
trimesh>=4.0.0
numpy>=1.24.0
Pillow>=10.0.0
usd-core>=24.0
```

- [ ] **Step 3: Create models/schemas.py**

```python
# models/schemas.py
from pydantic import BaseModel
from typing import Optional, Tuple, List


class ParsedMaterial(BaseModel):
    base_color_factor: Optional[Tuple[float, float, float, float]] = None
    base_color_texture_id: Optional[str] = None
    metallic_factor: float = 0.0
    roughness_factor: float = 1.0
    normal_texture_id: Optional[str] = None


class ParsedPart(BaseModel):
    id: str
    name: str
    vertex_count: int
    face_count: int
    bounds_min: Tuple[float, float, float]
    bounds_max: Tuple[float, float, float]
    is_watertight: bool
    material: Optional[ParsedMaterial] = None


class ArticulationPart(BaseModel):
    id: str
    name: str
    type: str  # link, base, tool
    mass: Optional[float] = None
    density: float = 1000.0
    collision_type: str = "convexHull"
    static_friction: float = 0.5
    dynamic_friction: float = 0.3
    restitution: float = 0.3


class ArticulationJoint(BaseModel):
    name: str
    parent: str
    child: str
    type: str  # fixed, revolute, prismatic
    axis: Tuple[float, float, float] = (0, 0, 1)
    anchor: Tuple[float, float, float] = (0, 0, 0)
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None
    drive_stiffness: Optional[float] = None
    drive_damping: Optional[float] = None
    drive_max_force: Optional[float] = None
    drive_type: str = "position"
    disable_collision: bool = True


class ArticulationData(BaseModel):
    model_name: str
    parts: List[ArticulationPart]
    joints: List[ArticulationJoint]


class UploadResponse(BaseModel):
    parts: List[ParsedPart]
    model_url: str
    filename: str


class ExportResponse(BaseModel):
    success: bool
    filename: str
    download_url: str
```

- [ ] **Step 4: Create services/glb_parser.py with material extraction**

Based on articulation-mvp's `glb_parser.py` but adds material extraction. Key addition: parse `trimesh.visual.material.PBRMaterial` for each mesh.

```python
# services/glb_parser.py
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import trimesh
import numpy as np
from PIL import Image
from models.schemas import ParsedPart, ParsedMaterial

logger = logging.getLogger(__name__)


class GLBParser:
    def __init__(self, upload_dir: str = "uploads", texture_dir: str = "outputs/textures"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.texture_dir = Path(texture_dir)
        self.texture_dir.mkdir(parents=True, exist_ok=True)

    def parse_glb(self, filepath: str) -> List[ParsedPart]:
        filepath = Path(filepath)
        if not filepath.exists():
            raise FileNotFoundError(f"GLB file not found: {filepath}")

        scene = trimesh.load(str(filepath), force='scene')
        parts = []

        if isinstance(scene, trimesh.Trimesh):
            mat = self._extract_material(scene, "mesh_0")
            parts.append(self._create_part(scene, "mesh_0", "mesh_0", mat))
        elif isinstance(scene, trimesh.Scene):
            geometry_to_node = {}
            for node_name in scene.graph.nodes:
                if node_name == scene.graph.base_frame:
                    continue
                try:
                    _, geometry_name = scene.graph.get(node_name)
                    if geometry_name and geometry_name in scene.geometry:
                        if geometry_name not in geometry_to_node:
                            geometry_to_node[geometry_name] = node_name
                except (ValueError, TypeError):
                    continue

            used_ids = set()
            for i, (geometry_key, mesh) in enumerate(scene.geometry.items()):
                if not isinstance(mesh, trimesh.Trimesh):
                    continue
                node_name = geometry_to_node.get(geometry_key, geometry_key)
                original_name = node_name or f"Part_{i}"
                part_id = self._unique_id(original_name, used_ids)
                used_ids.add(part_id)
                mat = self._extract_material(mesh, part_id)
                parts.append(self._create_part(mesh, part_id, original_name, mat))

        logger.info(f"Parsed {len(parts)} parts from GLB")
        return parts

    def _extract_material(self, mesh: trimesh.Trimesh, part_id: str) -> Optional[ParsedMaterial]:
        """Extract PBR material info from a trimesh mesh."""
        try:
            visual = mesh.visual
            if visual is None:
                return None

            # Handle PBR material
            if hasattr(visual, 'material') and visual.material is not None:
                mat = visual.material
                result = ParsedMaterial()

                # Base color factor
                if hasattr(mat, 'baseColorFactor') and mat.baseColorFactor is not None:
                    bc = mat.baseColorFactor
                    result.base_color_factor = (
                        float(bc[0]) / 255 if bc[0] > 1 else float(bc[0]),
                        float(bc[1]) / 255 if bc[1] > 1 else float(bc[1]),
                        float(bc[2]) / 255 if bc[2] > 1 else float(bc[2]),
                        float(bc[3]) / 255 if bc[3] > 1 else float(bc[3]),
                    )

                # Base color texture
                if hasattr(mat, 'baseColorTexture') and mat.baseColorTexture is not None:
                    tex_path = self.texture_dir / f"{part_id}_baseColor.png"
                    img = mat.baseColorTexture
                    if isinstance(img, Image.Image):
                        img.save(str(tex_path))
                        result.base_color_texture_id = f"{part_id}_baseColor.png"

                # Metallic/roughness
                if hasattr(mat, 'metallicFactor'):
                    result.metallic_factor = float(mat.metallicFactor or 0.0)
                if hasattr(mat, 'roughnessFactor'):
                    result.roughness_factor = float(mat.roughnessFactor or 1.0)

                # Normal texture
                if hasattr(mat, 'normalTexture') and mat.normalTexture is not None:
                    tex_path = self.texture_dir / f"{part_id}_normal.png"
                    img = mat.normalTexture
                    if isinstance(img, Image.Image):
                        img.save(str(tex_path))
                        result.normal_texture_id = f"{part_id}_normal.png"

                return result

            # Handle vertex colors as fallback
            if hasattr(visual, 'vertex_colors') and visual.vertex_colors is not None:
                avg_color = visual.vertex_colors.mean(axis=0) / 255.0
                return ParsedMaterial(
                    base_color_factor=(float(avg_color[0]), float(avg_color[1]), float(avg_color[2]), 1.0)
                )

        except Exception as e:
            logger.warning(f"Material extraction failed for {part_id}: {e}")

        return None

    def _create_part(
        self, mesh: trimesh.Trimesh, part_id: str, name: str, material: Optional[ParsedMaterial]
    ) -> ParsedPart:
        bounds = mesh.bounds if mesh.bounds is not None else np.zeros((2, 3))
        is_watertight = False
        try:
            is_watertight = bool(mesh.is_watertight)
        except Exception:
            pass

        return ParsedPart(
            id=part_id,
            name=name,
            vertex_count=len(mesh.vertices) if mesh.vertices is not None else 0,
            face_count=len(mesh.faces) if mesh.faces is not None else 0,
            bounds_min=tuple(bounds[0].tolist()),
            bounds_max=tuple(bounds[1].tolist()),
            is_watertight=is_watertight,
            material=material,
        )

    def get_all_mesh_data(self, filepath: str) -> Dict[str, Dict[str, Any]]:
        """Get mesh data including material info for all parts."""
        filepath = Path(filepath)
        scene = trimesh.load(str(filepath), force='scene')
        result = {}
        used_names = set()

        if isinstance(scene, trimesh.Trimesh):
            result["mesh_0"] = self._mesh_to_dict(scene, "mesh_0")
        elif isinstance(scene, trimesh.Scene):
            geometry_to_node = {}
            for node_name in scene.graph.nodes:
                if node_name == scene.graph.base_frame:
                    continue
                try:
                    _, geometry_name = scene.graph.get(node_name)
                    if geometry_name and geometry_name in scene.geometry:
                        if geometry_name not in geometry_to_node:
                            geometry_to_node[geometry_name] = node_name
                except (ValueError, TypeError):
                    continue

            for geometry_key, mesh in scene.geometry.items():
                if not isinstance(mesh, trimesh.Trimesh):
                    continue
                node_name = geometry_to_node.get(geometry_key, geometry_key)
                original_name = node_name or geometry_key
                part_id = self._unique_id(original_name, used_names)
                used_names.add(part_id)
                result[part_id] = self._mesh_to_dict(mesh, part_id)

        return result

    def _mesh_to_dict(self, mesh: trimesh.Trimesh, part_id: str) -> Dict[str, Any]:
        material = self._extract_material(mesh, part_id)
        return {
            'vertices': mesh.vertices.astype(np.float32),
            'faces': mesh.faces.astype(np.int32),
            'normals': mesh.vertex_normals.astype(np.float32) if mesh.vertex_normals is not None else None,
            'material': material,
        }

    def _unique_id(self, base_name: str, used: set) -> str:
        sanitized = base_name.lower()
        sanitized = ''.join(c if c.isalnum() else '_' for c in sanitized)
        sanitized = '_'.join(filter(None, sanitized.split('_')))
        if not sanitized:
            sanitized = "part"
        unique = sanitized
        counter = 1
        while unique in used:
            unique = f"{sanitized}_{counter}"
            counter += 1
        return unique


glb_parser = GLBParser()
```

- [ ] **Step 5: Create services/usd_builder.py with material support**

Based on MVP's `usd_builder.py` but adds `UsdShade.Material` with `UsdPreviewSurface` shader. This is the critical fix for the white-model issue.

```python
# services/usd_builder.py
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from pxr import Usd, UsdGeom, UsdShade, Sdf, Gf, Vt

logger = logging.getLogger(__name__)


class USDBuilder:
    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def create_stage(self, filename: str, model_name: str = "Robot",
                     up_axis: str = "Z", meters_per_unit: float = 1.0) -> Usd.Stage:
        filepath = self.output_dir / filename
        stage = Usd.Stage.CreateNew(str(filepath))
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z if up_axis == "Z" else UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, meters_per_unit)
        root_path = f"/{self._sanitize(model_name)}"
        root_xform = UsdGeom.Xform.Define(stage, root_path)
        stage.SetDefaultPrim(root_xform.GetPrim())
        return stage

    def add_physics_scene(self, stage: Usd.Stage) -> str:
        from pxr import UsdPhysics
        root_prim = stage.GetDefaultPrim()
        scene_path = root_prim.GetPath().AppendChild("PhysicsScene")
        physics_scene = UsdPhysics.Scene.Define(stage, scene_path)
        physics_scene.CreateGravityDirectionAttr(Gf.Vec3f(0, 0, -1))
        physics_scene.CreateGravityMagnitudeAttr(9.81)
        return str(scene_path)

    def add_mesh_prim(self, stage: Usd.Stage, parent_path: str, name: str,
                      vertices: np.ndarray, faces: np.ndarray,
                      normals: Optional[np.ndarray] = None,
                      material_data: Optional[Dict] = None) -> str:
        safe_name = self._sanitize(name)
        xform_path = f"{parent_path}/{safe_name}"
        UsdGeom.Xform.Define(stage, xform_path)

        mesh_path = f"{xform_path}/mesh"
        mesh = UsdGeom.Mesh.Define(stage, mesh_path)

        # Geometry
        points = Vt.Vec3fArray([Gf.Vec3f(float(v[0]), float(v[1]), float(v[2])) for v in vertices])
        mesh.CreatePointsAttr(points)
        mesh.CreateFaceVertexCountsAttr(Vt.IntArray([3] * len(faces)))
        mesh.CreateFaceVertexIndicesAttr(Vt.IntArray([int(i) for i in faces.flatten()]))

        if normals is not None:
            normal_array = Vt.Vec3fArray([Gf.Vec3f(float(n[0]), float(n[1]), float(n[2])) for n in normals])
            mesh.CreateNormalsAttr(normal_array)
            mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)

        mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)

        # Material — the critical fix
        if material_data:
            self._apply_material(stage, mesh_path, safe_name, material_data)

        return xform_path

    def _apply_material(self, stage: Usd.Stage, mesh_path: str,
                        part_name: str, material_data: Dict) -> None:
        """Create UsdPreviewSurface material and bind to mesh."""
        root_prim = stage.GetDefaultPrim()
        mat_scope = str(root_prim.GetPath()) + "/Materials"

        # Ensure Materials scope exists
        if not stage.GetPrimAtPath(mat_scope):
            UsdGeom.Scope.Define(stage, mat_scope)

        mat_path = f"{mat_scope}/Mat_{part_name}"
        material = UsdShade.Material.Define(stage, mat_path)

        # Create UsdPreviewSurface shader
        shader_path = f"{mat_path}/Shader"
        shader = UsdShade.Shader.Define(stage, shader_path)
        shader.CreateIdAttr("UsdPreviewSurface")

        # Base color
        mat_info = material_data if hasattr(material_data, 'base_color_factor') else (
            material_data.dict() if hasattr(material_data, 'dict') else material_data
        )

        bc = mat_info.get('base_color_factor')
        if bc:
            shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(
                Gf.Vec3f(float(bc[0]), float(bc[1]), float(bc[2]))
            )
            if len(bc) > 3 and float(bc[3]) < 1.0:
                shader.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(float(bc[3]))
        else:
            # Default gray instead of invisible
            shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(
                Gf.Vec3f(0.8, 0.8, 0.8)
            )

        # Base color texture
        tex_id = mat_info.get('base_color_texture_id')
        if tex_id:
            tex_path = f"{mat_path}/BaseColorTexture"
            tex_shader = UsdShade.Shader.Define(stage, tex_path)
            tex_shader.CreateIdAttr("UsdUVTexture")
            tex_shader.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(f"textures/{tex_id}")
            tex_shader.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("repeat")
            tex_shader.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("repeat")
            tex_output = tex_shader.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
            shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(tex_output)

        # Metallic / Roughness
        metallic = mat_info.get('metallic_factor', 0.0)
        roughness = mat_info.get('roughness_factor', 1.0)
        shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(float(metallic))
        shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(float(roughness))

        # Connect shader to material surface output
        shader_output = shader.CreateOutput("surface", Sdf.ValueTypeNames.Token)
        material.CreateSurfaceOutput().ConnectToSource(shader_output)

        # Bind material to mesh
        mesh_prim = stage.GetPrimAtPath(mesh_path)
        UsdShade.MaterialBindingAPI(mesh_prim).Bind(material)

        logger.info(f"Applied material to {mesh_path}")

    def build_from_parts(self, filename: str, model_name: str,
                         mesh_data: Dict[str, Dict[str, Any]],
                         part_info: List[Dict[str, Any]]) -> Tuple[Usd.Stage, Dict[str, str]]:
        stage = self.create_stage(filename, model_name)
        root_path = str(stage.GetDefaultPrim().GetPath())
        self.add_physics_scene(stage)

        part_paths = {}
        part_info_map = {p['id']: p for p in part_info}

        for part_id, data in mesh_data.items():
            info = part_info_map.get(part_id, {'type': 'link'})
            part_name = info.get('name', part_id)

            # Extract material from mesh data
            mat = data.get('material')
            mat_dict = None
            if mat:
                mat_dict = mat.dict() if hasattr(mat, 'dict') else (
                    mat.model_dump() if hasattr(mat, 'model_dump') else mat
                )

            prim_path = self.add_mesh_prim(
                stage=stage,
                parent_path=root_path,
                name=part_name,
                vertices=data['vertices'],
                faces=data['faces'],
                normals=data.get('normals'),
                material_data=mat_dict,
            )
            part_paths[part_id] = prim_path

        return stage, part_paths

    def save_stage(self, stage: Usd.Stage) -> str:
        stage.GetRootLayer().Save()
        filepath = stage.GetRootLayer().realPath
        logger.info(f"Saved USD: {filepath}")
        return filepath

    def _sanitize(self, name: str) -> str:
        sanitized = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        if sanitized and sanitized[0].isdigit():
            sanitized = '_' + sanitized
        if not sanitized:
            sanitized = '_unnamed'
        while '__' in sanitized:
            sanitized = sanitized.replace('__', '_')
        return sanitized


usd_builder = USDBuilder()
```

- [ ] **Step 6: Copy physics_injector.py from MVP**

```bash
cp /Users/between2058/Desktop/code/articulation-mvp/backend/app/services/physics_injector.py \
   /Users/between2058/Documents/code/articulation-service/services/physics_injector.py
```

Then update the import at the top of the file: change `from app.models.schemas import ...` to `from models.schemas import ...`.

- [ ] **Step 7: Create articulation_api.py**

```python
# articulation_api.py
import os
import uuid
import json
import logging
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from services.glb_parser import glb_parser
from services.usd_builder import usd_builder
from services.physics_injector import PhysicsInjector
from models.schemas import ArticulationData, UploadResponse, ExportResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("articulation_api")

app = FastAPI(title="Articulation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


@app.get("/health")
def health():
    return {"status": "ok", "service": "articulation"}


@app.post("/api/parse-glb", response_model=UploadResponse)
async def parse_glb(file: UploadFile = File(...)):
    if not file.filename.endswith(('.glb', '.gltf')):
        raise HTTPException(400, "Only GLB/GLTF files supported")

    uid = uuid.uuid4().hex[:8]
    filename = f"{uid}_{file.filename}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        parts = glb_parser.parse_glb(str(filepath))
    except Exception as e:
        filepath.unlink(missing_ok=True)
        raise HTTPException(500, f"GLB parse failed: {e}")

    return UploadResponse(
        parts=parts,
        model_url=f"/api/models/{filename}",
        filename=filename,
    )


@app.post("/api/export-usda", response_model=ExportResponse)
async def export_usda(
    file: UploadFile = File(...),
    articulation: str = Form(...),
):
    data = ArticulationData(**json.loads(articulation))

    uid = uuid.uuid4().hex[:8]
    glb_filename = f"{uid}_{file.filename}"
    glb_path = UPLOAD_DIR / glb_filename

    with open(glb_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        mesh_data = glb_parser.get_all_mesh_data(str(glb_path))
        part_info = [p.dict() if hasattr(p, 'dict') else p.model_dump() for p in data.parts]
        usda_filename = f"{data.model_name}_{uid}.usda"

        stage, part_paths = usd_builder.build_from_parts(
            usda_filename, data.model_name, mesh_data, part_info,
        )

        injector = PhysicsInjector()
        injector.inject_physics(stage, data, part_paths)
        usd_builder.save_stage(stage)

        return ExportResponse(
            success=True,
            filename=usda_filename,
            download_url=f"/api/download/{usda_filename}",
        )
    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(500, f"Export failed: {e}")


@app.post("/api/export-usdz", response_model=ExportResponse)
async def export_usdz(
    file: UploadFile = File(...),
    articulation: str = Form(...),
):
    # First generate USDA, then package as USDZ
    data = ArticulationData(**json.loads(articulation))

    uid = uuid.uuid4().hex[:8]
    glb_filename = f"{uid}_{file.filename}"
    glb_path = UPLOAD_DIR / glb_filename

    with open(glb_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        from pxr import UsdUtils

        mesh_data = glb_parser.get_all_mesh_data(str(glb_path))
        part_info = [p.dict() if hasattr(p, 'dict') else p.model_dump() for p in data.parts]
        usda_filename = f"{data.model_name}_{uid}.usda"

        stage, part_paths = usd_builder.build_from_parts(
            usda_filename, data.model_name, mesh_data, part_info,
        )

        injector = PhysicsInjector()
        injector.inject_physics(stage, data, part_paths)
        usd_builder.save_stage(stage)

        # Package as USDZ
        usda_path = OUTPUT_DIR / usda_filename
        usdz_filename = usda_filename.replace('.usda', '.usdz')
        usdz_path = OUTPUT_DIR / usdz_filename

        UsdUtils.CreateNewUsdzPackage(str(usda_path), str(usdz_path))

        return ExportResponse(
            success=True,
            filename=usdz_filename,
            download_url=f"/api/download/{usdz_filename}",
        )
    except Exception as e:
        logger.error(f"USDZ export failed: {e}", exc_info=True)
        raise HTTPException(500, f"USDZ export failed: {e}")


@app.get("/api/download/{filename}")
async def download_file(filename: str):
    filepath = OUTPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(filepath), filename=filename)


@app.get("/api/models/{filename}")
async def serve_model(filename: str):
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "Model not found")
    return FileResponse(str(filepath), media_type="model/gltf-binary")
```

- [ ] **Step 8: Create Dockerfile**

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/outputs /app/uploads /app/logs /app/outputs/textures

EXPOSE 52071

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:52071/health || exit 1

CMD ["python", "-m", "uvicorn", "articulation_api:app", \
     "--host", "0.0.0.0", "--port", "52071", "--workers", "1", "--log-level", "info"]
```

- [ ] **Step 9: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.8"

services:
  articulation-service:
    build: .
    container_name: articulation-service
    ports:
      - "52071:52071"
    volumes:
      - ./outputs:/app/outputs:rw
      - ./uploads:/app/uploads:rw
      - ./logs:/app/logs
    restart: unless-stopped
```

- [ ] **Step 10: Create .gitignore**

```
__pycache__/
*.pyc
venv/
outputs/
uploads/
logs/
.env
```

- [ ] **Step 11: Commit the backend repo**

```bash
cd /Users/between2058/Documents/code/articulation-service
git add .
git commit -m "feat: initial articulation-service with material-aware USD export"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Run lint on frontend**

```bash
cd /Users/between2058/Documents/code/phidias-standalone
npm run lint
```

Fix any lint errors.

- [ ] **Step 2: Run build check**

```bash
npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 3: Manual smoke test**

Start dev server:
```bash
npm run dev
```

Verify:
1. Physics tab appears in sidebar
2. Clicking Physics tab shows the page with bottom panel
3. Parts/Materials/Joints tabs switch correctly
4. Undo/Redo keyboard shortcuts don't crash

- [ ] **Step 4: Start backend and test integration**

```bash
cd /Users/between2058/Documents/code/articulation-service
pip install -r requirements.txt
uvicorn articulation_api:app --reload --port 52071
```

Test health endpoint:
```bash
curl http://localhost:52071/health
```

- [ ] **Step 5: Final commit**

```bash
cd /Users/between2058/Documents/code/phidias-standalone
git add .
git commit -m "feat(physics): complete Physics tab integration — all components wired up"
```
