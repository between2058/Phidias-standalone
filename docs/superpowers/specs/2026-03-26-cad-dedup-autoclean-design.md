# CAD Dedup + Auto-Clean + Server-Side Import

## Problem

ID designers receive large STP files (up to 2GB+) from ME engineers with hundreds of parts. The parts have messy names, duplicated screws, and tangled hierarchy. They need to manually clean up before working in KeyShot. Current CAD tab runs everything client-side via WASM, which can't handle large files.

## Solution

Three changes:

1. **Hybrid Import** — files ≤ 50MB use client-side WASM (fast), files > 50MB use OCCT server backend (stable)
2. **Find Duplicates** — identify identical parts by mesh fingerprint (user-triggered)
3. **Auto-Clean** — VLM-powered auto-naming and grouping (user-triggered)

## Hybrid Import

### Flow

```
User uploads .STP file
  ↓
File size ≤ 50MB?
  ├── Yes → Client-side WASM (existing occt-import-js flow)
  │         Result: CADImportResult { root, meshes }
  │         No session_id (can't export STEP)
  │
  └── No  → POST /import to OCCT server
              ↓
            Backend parses STEP via cadquery-ocp
              ↓
            Returns: { session_id, root, meshes }
              ↓
            Frontend converts to same CADImportResult format
            Stores session_id for later /ops and /export/stp
```

Both paths produce the same `CADImportResult` format. All downstream features (dedup, auto-clean, tree ops, viewport) work identically.

**With session_id (backend import):** can call `/ops` (rename/group/delete on XDE document) and `/export/stp` (download clean STEP)

**Without session_id (WASM import):** tree ops are client-side only, no STEP export

### Size Threshold

50MB. Configurable in the CAD page as a constant.

### API Client Function

New in `src/lib/api/phidias.ts`:

```typescript
export async function cadImport(
  file: File | Blob,
): Promise<{ session_id: string; root: CADNode; meshes: CADMesh[] }>
```

- POST `multipart/form-data` to `/phidias/occt/import`
- Timeout: 600000ms (10 minutes for large files)

### Frontend Changes

In `src/app/workspace/cad/page.tsx`, `handleFileImport`:

```typescript
const SERVER_IMPORT_THRESHOLD = 50 * 1024 * 1024; // 50MB

if (file.size > SERVER_IMPORT_THRESHOLD) {
    // Backend import
    const { session_id, root, meshes } = await cadImport(file);
    setSessionId(session_id);
    setCadResult({ root, meshes });
} else {
    // Client-side WASM (existing)
    const rawResult = await importStepFile(file, setCadProgress);
    setCadResult(expandHierarchy(rawResult));
    setSessionId(null);
}
```

New state: `const [sessionId, setSessionId] = useState<string | null>(null);`

## Feature 1: Find Duplicates (Dedup)

### Flow

```
User clicks "Find Duplicates"
  ↓
Has session_id?
  ├── Yes → POST /dedup { session_id } (backend fingerprint)
  └── No  → Client-side detectDuplicates() (existing WASM result)
  ↓
Returns duplicate groups
  ↓
Frontend displays in Duplicates tab (existing UI)
User can "Keep One" per group
```

### Backend API

**Endpoint:** `POST /dedup`

**Request:**
```json
{ "session_id": "uuid" }
```

**Response:**
```json
{
  "groups": [
    {
      "hash": "1234:2468:3.0000:5.0000:10.0000",
      "name": "M3x8 Screw",
      "mesh_indices": [0, 5, 12, 18, 23],
      "count": 5
    }
  ],
  "total_parts": 150,
  "unique_parts": 85,
  "duplicate_parts": 65
}
```

**Fingerprint algorithm:** Uses tessellation data from the session (already computed during import).

```python
def mesh_fingerprint(mesh: dict) -> str:
    positions = mesh['positions']
    indices = mesh['indices']
    v_count = len(positions) // 3
    i_count = len(indices)
    xs = positions[0::3]
    ys = positions[1::3]
    zs = positions[2::3]
    dx = max(xs) - min(xs)
    dy = max(ys) - min(ys)
    dz = max(zs) - min(zs)
    dims = sorted([dx, dy, dz])
    return f"{v_count}:{i_count}:{dims[0]:.4f}:{dims[1]:.4f}:{dims[2]:.4f}"
```

### Backend Files

| File | Action |
|------|--------|
| `occt-server/core/dedup.py` | **Create** — fingerprint + grouping logic |
| `occt-server/routers/dedup_router.py` | **Create** — POST /dedup endpoint |
| `occt-server/main.py` | **Modify** — register dedup router |
| `occt-server/models/schemas.py` | **Modify** — add DedupRequest/DedupResponse |

## Feature 2: Auto-Clean (VLM-powered)

### Flow

```
User clicks "Auto Clean"
  ↓
1. Run dedup (if not already done)
  ↓
2. Remove duplicates (keep one per group)
  ↓
3. Capture multi-angle screenshots of the scene
   (Three.js offscreen renderer, same as Smart Organize)
  ↓
4. Send to VLM (two-stage approach):
   Stage 1: identify object type + structural regions
   Stage 2: name each part + group them
  ↓
5. Apply rename + group via POST /ops (if session_id exists)
   or client-side tree ops (if WASM import)
  ↓
6. Frontend shows cleaned hierarchy
   User can undo / adjust / export clean STEP
```

### Implementation

Reuses existing infrastructure:
- **Dedup** — Feature 1 above
- **VLM** — same Smart Organize endpoint (`/phidias/smart-organize`)
- **Tree ops** — `POST /ops` (backend) or `cad-tree-ops.ts` (client)
- **Export** — `GET /export/stp` (backend only)

### Frontend Files

| File | Action |
|------|--------|
| `src/app/workspace/cad/page.tsx` | **Modify** — add sessionId state, hybrid import, wire auto-clean |
| `src/components/cad/AutoCleanDialog.tsx` | **Modify** — multi-step progress, VLM integration |

## All Files to Create/Modify

| File | Action | What |
|------|--------|------|
| `src/lib/api/phidias.ts` | **Modify** | Add `cadImport()` and `cadDedup()` functions |
| `src/app/workspace/cad/page.tsx` | **Modify** | Hybrid import (WASM vs server), sessionId state, auto-clean wiring |
| `src/components/cad/AutoCleanDialog.tsx` | **Modify** | Multi-step auto-clean with VLM |
| `occt-server/core/dedup.py` | **Create** | Fingerprint + grouping logic |
| `occt-server/routers/dedup_router.py` | **Create** | POST /dedup endpoint |
| `occt-server/main.py` | **Modify** | Register dedup router |
| `occt-server/models/schemas.py` | **Modify** | Add Dedup schemas |

## Backward Compatibility

- Files ≤ 50MB still use the fast WASM path — no change for small files
- All changes are additive — no existing API or UI removed
- Auto-Clean is optional — user can still manually organize
- STEP export only available for backend-imported files (with session_id)
