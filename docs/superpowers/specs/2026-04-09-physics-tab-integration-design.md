# Physics Tab Integration Design

> Integrate articulation-mvp functionality into Phidias as the Physics workspace tab.

**Date**: 2026-04-09
**Strategy**: Rewrite — use existing `_physics` tab as base, extract core logic from articulation-mvp, reimplement with Phidias patterns.

---

## 1. Backend Microservice (articulation-service)

### Deployment

Independent Docker repo, same pattern as TRELLIS.2:

```
articulation-service/
├── Dockerfile                  # Python 3.10+ base (CPU-only, no GPU needed)
├── docker-compose.yml          # Standalone run
├── requirements.txt            # trimesh, pxr (USD Core), fastapi, uvicorn
├── articulation_api.py         # FastAPI entry (like trellis2_api.py)
├── services/
│   ├── glb_parser.py           # Refactored from MVP, adds material extraction
│   ├── usd_builder.py          # Refactored from MVP, adds UsdPreviewSurface materials
│   └── physics_injector.py     # From MVP, minor adjustments
├── models/
│   └── schemas.py              # Pydantic models
├── outputs/
├── uploads/
└── logs/
```

Port: `52071` (after Trellis2's 52070). Added to `ai-services-unified/docker-compose.yml` for unified orchestration.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse-glb` | POST | Parse GLB, return parts list + material info |
| `/api/export-usda` | POST | Accept articulation data, produce USDA with materials + textures |
| `/api/export-usdz` | POST | Same but packaged as USDZ |
| `/api/download/{filename}` | GET | Download generated file |
| `/health` | GET | Health check |

### Material Fix (Critical)

The MVP exported white models to Isaac Sim because `glb_parser.py` only extracted geometry (vertices, faces, normals) and `usd_builder.py` created no `UsdShade.Material`.

Fix:
1. **glb_parser.py**: Extract PBR material data via trimesh — `baseColorTexture`, `baseColorFactor`, `metallicFactor`, `roughnessFactor`, `normalTexture`.
2. **usd_builder.py**: Create `UsdShade.Material` with `UsdPreviewSurface` shader, bind to mesh prims via `UsdShade.MaterialBindingAPI`.
3. **Textures**: Saved as sidecar PNG files with relative path references in USDA. For USDZ, textures are embedded in the package.

---

## 2. Phidias Frontend Integration Layer

### Environment Variable

```env
ARTICULATION_API_URL=http://localhost:52071
```

### Next.js API Proxy

`src/app/api/phidias/articulation/[...path]/route.ts`
- Uses existing `_proxy.ts` pattern to forward to `ARTICULATION_API_URL`.
- Standalone mode goes through proxy; Web Component mode hits backend directly.

### API Client Functions

In `src/lib/api/phidias.ts` (function-based, per CLAUDE.md):

```typescript
export async function parseGlbForPhysics(file: File): Promise<ParsedPhysicsResult>
export async function exportArticulationUsda(data: ArticulationExportData): Promise<ExportResult>
export async function exportArticulationUsdz(data: ArticulationExportData): Promise<ExportResult>
export async function downloadArticulationFile(filename: string): Promise<Blob>
```

Type definitions added to `src/lib/api/types.ts`, aligned with backend Pydantic schemas.

---

## 3. Physics Store (Zustand + Zundo)

New file: `src/store/physics-store.ts`

Same pattern as `segment-store.ts` and `cad-store.ts` — Zustand + Zundo temporal middleware, 50 snapshot limit.

### State

```typescript
interface PhysicsState {
  // Data (tracked by Zundo)
  parts: PhysicsPart[]
  joints: PhysicsJoint[]
  materialPresets: PhysicsMaterial[]

  // UI state (excluded from undo history)
  selectedPartId: string | null
  selectedJointId: string | null
  jointPreviewAngle: number
}
```

Zundo `partialize`: only `parts` + `joints` tracked.

### PhysicsPart

```typescript
interface PhysicsPart {
  id: string
  name: string
  color: string
  type: 'link' | 'base' | 'tool' | 'joint'
  role: 'other' | 'actuator' | 'support' | 'gripper' | 'sensor'
  mobility: 'fixed' | 'revolute' | 'prismatic'
  mass: number | null              // null = auto from density
  density: number
  collisionType: 'convexHull' | 'mesh' | 'convexDecomposition' | 'none'
  staticFriction: number
  dynamicFriction: number
  restitution: number
  materialId: string | null
  isMaterialCustom: boolean
  originalMaterial: OriginalMaterial | null   // From GLB for USD export
}

interface OriginalMaterial {
  baseColorFactor: [number, number, number, number] | null  // RGBA 0-1
  baseColorTextureId: string | null   // Reference to extracted texture file
  metallicFactor: number
  roughnessFactor: number
  normalTextureId: string | null
}
```

### PhysicsJoint

```typescript
interface PhysicsJoint {
  id: string
  name: string
  type: 'Revolute' | 'Prismatic' | 'Fixed' | 'Spherical' | '6-DOF'
  parentPartId: string
  childPartId: string
  axis: [number, number, number]
  anchor: [number, number, number]   // Child-local coordinates
  limitsEnabled: boolean
  limitLower: number
  limitUpper: number
  driveStiffness: number
  driveDamping: number
  driveMaxForce: number
  driveType: 'position' | 'velocity' | 'none'
  disableCollision: boolean
}
```

### Actions

- `setParts` / `setJoints` — accept array or reducer function
- `updatePart(id, partial)` / `updateJoint(id, partial)`
- `addJoint(joint)` / `removeJoint(id)`
- `setSelectedPartId` / `setSelectedJointId` / `setJointPreviewAngle` — UI-only, no undo snapshot

### Segment to Physics Conversion

- Read `WorkspaceContext.segmentHierarchy` to get segment parts
- Convert to `PhysicsPart[]` preserving id, name, color; fill default physics values
- Alternative: use `parseGlbForPhysics()` from a fresh GLB upload

---

## 4. UI Panel Rewrite

### Tab Activation

Rename `src/app/workspace/_physics/` to `src/app/workspace/physics/` (remove `_` prefix). Add Physics entry in `LeftIconSidebar`.

### Page Layout

```
┌──────┬─────────────────────────────┬───────────┐
│      │                             │           │
│ Left │   ThreeViewport             │  Assets   │
│ Icon │   + Joint Visualizer        │  Panel    │
│  Bar │   + Anchor Gizmo            │           │
│      │   + Motion Preview          │           │
│      │                             │           │
├──────┴─────────────────────────────┴───────────┤
│  Physics Editor Panel (bottom)                  │
│  ┌─────────┬──────────┬─────────┬────────────┐ │
│  │  Parts  │ Materials│  Joints │  [Export]   │ │
│  │  Tab    │  Tab     │  Tab    │  USDA/USDZ │ │
│  └─────────┴──────────┴─────────┴────────────┘ │
└─────────────────────────────────────────────────┘
```

### Components (rewrite from existing `src/components/physics/`)

| Component | Description |
|-----------|-------------|
| `PhysicsPartsPanel` | Part list + type/role/mobility + mass/collision. New: import from Segment button, standalone GLB upload button |
| `PhysicsMaterialsPanel` | Material preset library (steel, rubber, plastic, etc.) + custom params. Click to apply to selected part |
| `PhysicsJointsPanel` | Joint CRUD list + parent/child selection + type/axis/limits/drive params. New: anchor numeric input (bidirectional sync with 3D gizmo) |
| `PhysicsExportPanel` | Export buttons (USDA / USDZ) with pre-export validation |

### Entry Points

- **From Segment**: "Physics →" button in Segment tab toolbar. Writes `segmentHierarchy` + `activeAsset.modelUrl` to WorkspaceContext, navigates to `/workspace/physics`. Physics page detects segment data via `useEffect` and converts to `PhysicsPart[]`. If Physics already has data, confirmation Modal appears.
- **Standalone**: Built-in FileUploader (drag-drop GLB) in Physics tab, calls `parseGlbForPhysics()`.

### Styling

Glassmorphism per CLAUDE.md: frosted glass, gradient borders, rounded corners, dark blue base (`#1a1a2e`), purple theme (`#7c3aed`), orange accent (`#f5a623`).

---

## 5. Joint 3D Visualization & Interaction

### 5a. Joint Visualizer (Visual Markers)

New `JointVisualizer` sub-component inside ThreeViewport, renders per joint:
- **Anchor sphere**: Semi-transparent yellow sphere at pivot position
- **Axis arrow**: Direction arrow from anchor (red/green/blue = X/Y/Z)
- **Parent-Child line**: Dashed line connecting parent and child centers
- Selected joint highlighted, unselected semi-transparent

### 5b. Anchor Dragging (TransformControls)

On joint selection, anchor sphere becomes draggable:
- Reuse ThreeViewport's existing `TransformControls` mechanism (translate mode only)
- Drag updates `physics-store` `joint.anchor` in real-time
- Panel anchor [x, y, z] inputs and 3D gizmo are **bidirectionally synced**
- Snap-to-surface option: anchor snaps to nearest mesh surface

### 5c. Motion Preview

On joint selection, a preview slider appears in the bottom panel:
- **Revolute**: Slider range = `[limitLower, limitUpper]` (degrees). Child part rotates around anchor + axis in real-time.
- **Prismatic**: Slider range = `[limitLower, limitUpper]` (meters). Child part translates along axis in real-time.
- **Fixed**: No slider.
- Preview is **frontend-only transform** — does not modify actual data, only applies temporary local matrix to child mesh.
- Releasing slider or switching joint resets child to original position.
- `jointPreviewAngle` stored in store UI state (excluded from undo).

### Implementation

- Motion preview transform calculated in `useFrame` for 60fps.
- Uses `THREE.Matrix4.makeRotationAxis()` + `THREE.Matrix4.makeTranslation()` based on anchor/axis.
- Child mesh group matrix set to `autoUpdate = false` during preview for manual control.

---

## 6. Export Flow & Validation

### Pre-export Validation (Client-side)

| Check | Rule | Severity |
|-------|------|----------|
| Must have base | At least one part with type `base` | Block |
| Joint completeness | Every joint's parentPartId and childPartId reference existing parts | Block |
| No orphan links | All `link` type parts referenced by at least one joint | Block |
| Anchor sanity | Anchor coordinates not `[0,0,0]` | Warning |
| Name conflicts | All part names unique after USD prim name sanitization | Block |

Validation failures shown as Toast notifications. Block-level issues disable export buttons.

### Export Integration

- Bottom panel: Export buttons (USDA / USDZ) next to Joints tab
- ThreeViewport right toolbar: `ExportDropdown` gains USDA / USDZ options when Physics tab is active
- On success: browser triggers file download

---

## 7. Undo/Redo

Full undo/redo via Zundo on all data operations:
- Part property changes (type, role, mass, friction, collision, material)
- Joint CRUD (add, update, delete)
- Anchor position changes (from gizmo drag or numeric input)
- Material preset application

UI-only state excluded: selectedPartId, selectedJointId, jointPreviewAngle.

Keyboard shortcut: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo) — consistent with Segment and CAD tabs.

---

## 8. Data Flow Summary

```
                    ┌─────────────┐
                    │  Segment Tab│
                    │  (optional) │
                    └──────┬──────┘
                           │ "Physics →" button
                           │ segmentHierarchy + modelUrl
                           ▼
┌──────────┐      ┌──────────────────┐      ┌─────────────────────┐
│ GLB File │─────▶│   Physics Tab    │─────▶│ articulation-service│
│(drag-drop)│     │                  │      │   (Python FastAPI)  │
└──────────┘      │  physics-store   │      │                     │
                  │  ┌────────────┐  │      │  parse-glb          │
                  │  │ parts[]    │  │ POST │  ├─ glb_parser      │
                  │  │ joints[]   │──┼──────▶  │  (+ materials)   │
                  │  └────────────┘  │      │  │                  │
                  │                  │      │  export-usda/usdz   │
                  │  ThreeViewport   │      │  ├─ usd_builder     │
                  │  ├─ JointViz    │      │  │  (+ UsdPreview    │
                  │  ├─ AnchorGizmo │      │  │   Surface)        │
                  │  └─ MotionPreview│      │  └─ physics_injector│
                  │                  │      │                     │
                  └──────────────────┘      └──────────┬──────────┘
                                                       │
                                                       ▼
                                              .usda / .usdz
                                              (with materials)
                                                       │
                                                       ▼
                                              NVIDIA Isaac Sim
```
