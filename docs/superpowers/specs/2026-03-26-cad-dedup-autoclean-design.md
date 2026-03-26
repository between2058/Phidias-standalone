# CAD Dedup + Auto-Clean

## Problem

ID designers receive large STP files from ME engineers with hundreds of parts. The parts have messy names, duplicated screws, and tangled hierarchy. They need to manually clean up before working in KeyShot.

## Solution

Two user-triggered features in the CAD tab:

1. **Find Duplicates** — identify identical parts by mesh fingerprint
2. **Auto-Clean** — VLM-powered auto-naming and grouping (like Smart Organize)

## Feature 1: Find Duplicates (Dedup)

### Flow

```
User clicks "Find Duplicates"
  ↓
POST /dedup { session_id }
  ↓
Backend computes mesh fingerprint per part:
  hash = f"{vertex_count}:{index_count}:{bbox_dx:.4f}:{bbox_dy:.4f}:{bbox_dz:.4f}"
  ↓
Groups parts with identical hash
  ↓
Returns: { groups: [{ hash, name, meshIndices[], count }] }
  ↓
Frontend displays in Duplicates tab (existing UI)
User can "Keep One" per group (hides others via /ops delete)
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
      "hash": "1234:2468:10.0000:5.0000:3.0000",
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

**Fingerprint algorithm:** Uses existing tessellation data (already computed during import). No extra OCC computation needed.

```python
def mesh_fingerprint(mesh: dict) -> str:
    positions = mesh['positions']
    indices = mesh['indices']
    v_count = len(positions) // 3
    i_count = len(indices)
    # Compute bounding box dimensions
    xs = positions[0::3]
    ys = positions[1::3]
    zs = positions[2::3]
    dx = max(xs) - min(xs)
    dy = max(ys) - min(ys)
    dz = max(zs) - min(zs)
    # Sort dimensions so orientation doesn't matter
    dims = sorted([dx, dy, dz])
    return f"{v_count}:{i_count}:{dims[0]:.4f}:{dims[1]:.4f}:{dims[2]:.4f}"
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `occt-server/routers/dedup_router.py` | **Create** — POST /dedup endpoint |
| `occt-server/core/dedup.py` | **Create** — fingerprint + grouping logic |
| `occt-server/main.py` | **Modify** — register dedup router |
| `occt-server/models/schemas.py` | **Modify** — add DedupRequest/Response models |

## Feature 2: Auto-Clean (VLM-powered)

### Flow

```
User clicks "Auto Clean"
  ↓
1. Run dedup if not already done
  ↓
2. Remove duplicates (keep one per group)
  ↓
3. Capture multi-angle screenshots of each remaining part
   (render each part individually with segment colors)
  ↓
4. Send to VLM (same two-stage approach as Smart Organize):
   Stage 1: identify object type + structural regions
   Stage 2: name each part + group them
  ↓
5. Apply rename + group operations via POST /ops
  ↓
6. Frontend shows cleaned hierarchy
   User can undo / adjust / export clean STEP
```

### Implementation

Auto-Clean reuses existing infrastructure:
- **Dedup** — from Feature 1 above
- **VLM calls** — reuse Smart Organize's `/phidias/smart-organize` endpoint or call VLM directly
- **Tree operations** — existing `POST /ops` (rename, group, delete)
- **Export** — existing `GET /export/stp`

The frontend orchestrates the flow:
1. Call `POST /dedup` → get duplicate groups
2. Call `POST /ops` with delete operations for duplicates
3. Capture screenshots of the cleaned scene (client-side, Three.js)
4. Call Smart Organize VLM endpoint with screenshots
5. Call `POST /ops` with rename + group operations from VLM result
6. Display result, user confirms

### Frontend Changes

The CAD page's existing `AutoCleanDialog` component will be updated to orchestrate this multi-step flow with progress indication.

### Files to Modify

| File | Action |
|------|--------|
| `src/app/workspace/cad/page.tsx` | **Modify** — wire auto-clean to real APIs |
| `src/components/cad/AutoCleanDialog.tsx` | **Modify** — add multi-step progress, VLM integration |

## Backward Compatibility

- All changes are additive — no existing API or UI is removed
- Dedup uses existing tessellation data (no extra import cost)
- Auto-Clean is optional — user can still manually organize
- Export STEP already works
