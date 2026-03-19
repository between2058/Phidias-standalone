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
POST /phidias/convert/fbx ──→ Receives GLB
                               ↓
                             Forward to Docker ─────────→ Blender headless
                                                          bpy: GLB → FBX
                               ↓                    ←──── Returns FBX file
                             Returns FBX Blob
  ↓ download .fbx       ←────
```

## Docker Container: Blender Converter

### Image & Service

- **Base image**: `nytimes/blender:latest` (or equivalent Blender headless image)
- **Internal service**: Lightweight Python HTTP server (FastAPI)
- **Port**: `8100`
- **Dockerfile location**: `docker/blender-converter/`

### Endpoint

```
POST /convert
  Request:  multipart/form-data, field "file" = GLB binary
  Response: application/octet-stream (FBX binary)
  Error:    500, { "error": "..." }
```

### Conversion Logic (Python + bpy)

1. Save received GLB to temp file
2. `bpy.ops.import_scene.gltf(filepath='input.glb')` — load model
3. `bpy.ops.export_scene.fbx(filepath='output.fbx', path_mode='COPY', embed_textures=True)` — export
   - `path_mode='COPY'` + `embed_textures=True` ensures textures are embedded in FBX
   - Group hierarchy is preserved via GLB's node hierarchy
4. Return FBX file, clean up temp files

## Backend API

### Endpoint

`POST /phidias/convert/fbx`

- **Request**: `multipart/form-data` with field `file` (GLB binary)
- **Response success**: `200`, `Content-Type: application/octet-stream`, body = FBX binary
- **Response error**: `500`, `{ error: "..." }`

### Standalone Mode

New API route: `src/app/api/phidias/convert/fbx/route.ts`

- Receives GLB from frontend
- Forwards to Docker container at `CONVERT_API_URL/convert` (env var, default `http://localhost:8100`)
- Streams FBX response back to frontend

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

Sends `multipart/form-data` to `{getBackendApi()}/phidias/convert/fbx`, returns FBX Blob.

### Export Dropdown (`src/components/shared/ExportDropdown.tsx`)

Add "FBX" as a third option in the dropdown menu (after GLB and USDZ).

On click:
1. Call existing `exportSceneToGlb()` to get GLB ArrayBuffer
2. Wrap as Blob, call `convertToFbx(blob)`
3. Trigger browser download as `{baseName}.fbx`

Material restoration (swap segment colors → originals before export) is already handled by `exportSceneToGlb()`.

### Standalone Proxy (`src/app/api/phidias/convert/fbx/route.ts`)

New route that:
1. Receives GLB from frontend via FormData
2. Forwards to `CONVERT_API_URL/convert`
3. Returns FBX binary response

## Files to Create/Modify

| File | Action | Responsibility |
|------|--------|----------------|
| `docker/blender-converter/Dockerfile` | **Create** | Blender headless image with FastAPI service |
| `docker/blender-converter/server.py` | **Create** | FastAPI endpoint for GLB→FBX conversion |
| `docker/blender-converter/requirements.txt` | **Create** | Python dependencies (fastapi, uvicorn, python-multipart) |
| `src/app/api/phidias/convert/fbx/route.ts` | **Create** | Next.js API proxy route |
| `src/lib/api/phidias.ts` | **Modify** | Add `convertToFbx()` function |
| `src/components/shared/ExportDropdown.tsx` | **Modify** | Add FBX option to dropdown |

## Error Handling

- Docker container unreachable → backend returns `500` with message "Conversion service unavailable"
- Blender conversion fails → container returns `500` with Blender error message
- Frontend shows error via existing toast/error mechanism

## Backward Compatibility

- Existing GLB and USDZ exports are unchanged
- FBX option only appears in the dropdown; no existing behavior is modified
- `CONVERT_API_URL` env var is optional — if not set, FBX conversion uses default localhost URL (will fail gracefully if Docker is not running)
