# FBX Export via Docker Blender Converter

## Problem

Users need to export 3D models as FBX files (with geometry, materials/textures, and group hierarchy preserved). Three.js has no FBXExporter, so a server-side conversion is required.

## Solution Overview

Frontend exports the scene as GLB (existing capability), POSTs it to a backend endpoint, which forwards it to a Docker-containerized Blender headless service for GLB→FBX conversion.

```
Frontend                      Backend API Route           Docker Container
────────                      ─────────────────           ────────────────
User clicks "FBX"
  ↓
exportSceneToGlb()
  ↓ GLB Blob
POST /phidias/convert/fbx ──→ proxyRequest() ─────────→ Blender headless
                                (streaming)               bpy: GLB → FBX
  ↓ download .fbx       ←──── FBX stream         ←────── Returns FBX file
```

## Docker Container: Blender Converter

### Image & Service

- **Base image**: Official Blender PPA or `linuxserver/blender` (pin Blender 4.0+)
- **Internal service**: FastAPI (Python)
- **Port**: `8100`
- **Dockerfile location**: `docker/blender-converter/`
- **Health check**: `GET /health` → `{ "status": "ok" }`

### Endpoints

```
GET  /health
  Response: 200, { "status": "ok" }

POST /convert
  Request:  multipart/form-data, field "file" = GLB binary
  Response: application/octet-stream (FBX binary)
  Error:    500, { "error": "..." }
```

### Conversion Logic (Python + bpy)

```python
with tempfile.TemporaryDirectory() as tmpdir:
    glb_path = os.path.join(tmpdir, 'input.glb')
    fbx_path = os.path.join(tmpdir, 'output.fbx')

    # Save uploaded GLB
    with open(glb_path, 'wb') as f:
        f.write(await file.read())

    # Clear default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import GLB (preserves node hierarchy)
    bpy.ops.import_scene.gltf(filepath=glb_path)

    # Export FBX with embedded textures
    bpy.ops.export_scene.fbx(
        filepath=fbx_path,
        path_mode='COPY',
        embed_textures=True,
    )

    # Return FBX as streaming response
    return FileResponse(fbx_path, media_type='application/octet-stream')
```

`tempfile.TemporaryDirectory()` ensures cleanup even if Blender crashes.

### Dependencies (`requirements.txt`)

```
fastapi==0.115.0
uvicorn==0.30.0
python-multipart==0.0.9
```

Pin versions for reproducible Docker builds.

## Backend API

### Endpoint

`POST /phidias/convert/fbx`

- **Request**: `multipart/form-data` with field `file` (GLB binary)
- **Response success**: `200`, `Content-Type: application/octet-stream`, body = FBX binary
- **Response error**: `500`, `{ error: "..." }`

### Standalone Mode

New API route: `src/app/api/phidias/convert/fbx/route.ts`

Uses the existing `proxyRequest()` streaming proxy — no FormData parsing needed:

```typescript
import { proxyRequest } from '../_proxy';

const CONVERT_BASE = process.env.CONVERT_API_URL ?? 'http://localhost:8100';

export async function POST(request: NextRequest) {
    return proxyRequest(request, `${CONVERT_BASE}/convert`);
}
```

This handles large files efficiently via streaming and follows the established proxy pattern.

### Web Component Mode

Frontend POSTs directly to `apiBaseUrl + /phidias/convert/fbx`. External backend handles conversion independently.

### Environment Variable

`CONVERT_API_URL` — Docker converter service URL (default: `http://localhost:8100`)

## Frontend Changes

### API Client (`src/lib/api/phidias.ts`)

New function:

```typescript
export async function convertToFbx(
  glbFile: Blob,
): Promise<Blob>
```

Implementation:
- Wraps `glbFile` in a `FormData` with field name `file`
- POSTs to `{getBackendApi()}/phidias/convert/fbx`
- Timeout: `300000` (5 minutes — Blender conversion of complex models can take time)
- Returns FBX `Blob` from response

### Export Dropdown (`src/components/shared/ExportDropdown.tsx`)

Add "FBX" as a third option in the dropdown menu (after GLB and USDZ).

Update `handleExport` format type: `'glb' | 'usdz' | 'fbx'`

On click:
1. Call existing `exportSceneToGlb()` to get GLB ArrayBuffer
2. Wrap as Blob, call `convertToFbx(blob)`
3. Trigger browser download as `{baseName}.fbx` (use existing `triggerDownload` helper from `loaders.ts`)

**Progress text**: Show "Converting to FBX..." during the network round-trip (distinct from local-only exports).

**When `sceneRef` is null** (no live scene): fetch the GLB from `modelUrl` as a Blob and send that to `convertToFbx()` instead.

Material restoration (swap segment colors → originals before export) is already handled by `exportSceneToGlb()`.

## Files to Create/Modify

| File | Action | Responsibility |
|------|--------|----------------|
| `docker/blender-converter/Dockerfile` | **Create** | Blender headless image with FastAPI service |
| `docker/blender-converter/server.py` | **Create** | FastAPI endpoint with `/convert` and `/health` |
| `docker/blender-converter/requirements.txt` | **Create** | Pinned Python dependencies |
| `src/app/api/phidias/convert/fbx/route.ts` | **Create** | Streaming proxy via `proxyRequest()` |
| `src/lib/api/phidias.ts` | **Modify** | Add `convertToFbx()` function |
| `src/components/shared/ExportDropdown.tsx` | **Modify** | Add FBX option, progress text, sceneRef-null fallback |
| `.env.example` | **Modify** | Add `CONVERT_API_URL` |

## Error Handling

- Docker container unreachable → `proxyRequest` returns upstream error → frontend shows "Conversion service unavailable"
- Blender conversion fails → container returns `500` with error detail → frontend shows error message
- Frontend shows errors via existing toast/error mechanism
- FBX option remains visible even if Docker is down — error surfaces on attempt (simpler than health-check polling)

## Backward Compatibility

- Existing GLB and USDZ exports are unchanged
- FBX option only appears in the dropdown; no existing behavior is modified
- `CONVERT_API_URL` env var is optional — if not set, uses default localhost URL (fails gracefully if Docker is not running)
