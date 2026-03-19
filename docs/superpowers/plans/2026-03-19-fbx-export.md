# FBX Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FBX export to the 3D model editor via a Docker-containerized Blender headless converter.

**Architecture:** Frontend exports scene as GLB (existing), POSTs to a backend proxy route that streams to a Docker Blender service for GLB→FBX conversion. The proxy uses the existing `proxyRequest()` streaming helper.

**Tech Stack:** Docker, Blender 4.0+ (bpy), FastAPI, Next.js API Routes, Three.js

**Spec:** `docs/superpowers/specs/2026-03-19-fbx-export-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `docker/blender-converter/server.py` | **Create** | FastAPI service: `/health` and `/convert` endpoints |
| `docker/blender-converter/requirements.txt` | **Create** | Pinned Python dependencies |
| `docker/blender-converter/Dockerfile` | **Create** | Blender headless image with FastAPI |
| `src/app/api/phidias/convert/fbx/route.ts` | **Create** | Streaming proxy to Docker converter |
| `src/lib/api/phidias.ts` | **Modify** | Add `convertToFbx()` function |
| `src/components/shared/ExportDropdown.tsx` | **Modify** | Add FBX option, progress text, no-scene fallback |
| `.env.example` | **Modify** | Add `CONVERT_API_URL` |

---

### Task 1: Create Docker Blender Converter Service

**Files:**
- Create: `docker/blender-converter/server.py`
- Create: `docker/blender-converter/requirements.txt`
- Create: `docker/blender-converter/Dockerfile`

- [ ] **Step 1: Create `requirements.txt`**

```
fastapi==0.115.0
uvicorn==0.30.0
python-multipart==0.0.9
```

- [ ] **Step 2: Create `server.py`**

```python
import os
import tempfile

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    try:
        import bpy

        with tempfile.TemporaryDirectory() as tmpdir:
            glb_path = os.path.join(tmpdir, "input.glb")
            fbx_path = os.path.join(tmpdir, "output.fbx")

            # Save uploaded GLB
            contents = await file.read()
            with open(glb_path, "wb") as f:
                f.write(contents)

            # Clear default scene
            bpy.ops.wm.read_factory_settings(use_empty=True)

            # Import GLB (preserves node hierarchy)
            bpy.ops.import_scene.gltf(filepath=glb_path)

            # Export FBX with embedded textures
            bpy.ops.export_scene.fbx(
                filepath=fbx_path,
                path_mode="COPY",
                embed_textures=True,
            )

            return FileResponse(
                fbx_path,
                media_type="application/octet-stream",
                filename="output.fbx",
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8100)
```

- [ ] **Step 3: Create `Dockerfile`**

```dockerfile
FROM nytimes/blender:4.0-gpu-ubuntu18.04

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

CMD ["python", "server.py"]
```

Note: The exact base image may need to be adjusted based on available Blender Docker images. The implementer should verify `nytimes/blender:4.0-gpu-ubuntu18.04` exists or substitute with an equivalent Blender 4.0+ headless image (e.g., build from `ubuntu:22.04` with `apt install blender`).

- [ ] **Step 4: Commit**

```bash
git add docker/blender-converter/
git commit -m "feat(fbx-export): add Docker Blender converter service"
```

---

### Task 2: Create Backend Proxy Route

**Files:**
- Create: `src/app/api/phidias/convert/fbx/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create the proxy route**

```typescript
import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_proxy';

const CONVERT_BASE = process.env.CONVERT_API_URL ?? 'http://localhost:8100';

export async function POST(request: NextRequest) {
    return proxyRequest(request, `${CONVERT_BASE}/convert`);
}
```

Note: The import path `../../_proxy` is relative from `src/app/api/phidias/convert/fbx/` to `src/app/api/phidias/_proxy.ts`.

- [ ] **Step 2: Add `CONVERT_API_URL` to `.env.example`**

Append to the end of `.env.example`:

```
CONVERT_API_URL=http://localhost:8100
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/phidias/convert/fbx/route.ts .env.example
git commit -m "feat(fbx-export): add streaming proxy route for GLB-to-FBX conversion"
```

---

### Task 3: Add `convertToFbx` API Client Function

**Files:**
- Modify: `src/lib/api/phidias.ts`

- [ ] **Step 1: Add `convertToFbx` function**

Add after the existing `smartOrganize` function (around line 543):

```typescript
/**
 * Convert a GLB file to FBX via the server-side Blender converter.
 */
export async function convertToFbx(
  glbFile: Blob,
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', glbFile, 'model.glb');

  const { data } = await client.post<Blob>(
    `${getBackendApi()}/phidias/convert/fbx`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    },
  );
  return data;
}
```

The `client` already handles `application/octet-stream` responses by returning a `Blob` (see `client.ts:132-138`).

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/phidias.ts
git commit -m "feat(fbx-export): add convertToFbx API client function"
```

---

### Task 4: Add FBX Option to ExportDropdown

**Files:**
- Modify: `src/components/shared/ExportDropdown.tsx`

- [ ] **Step 1: Import `convertToFbx`**

Add to the imports at the top of the file:

```typescript
import { convertToFbx } from '@/lib/api/phidias';
```

Also add the `FileBox` icon import (for the FBX menu item):

```typescript
import { Upload, Box, ChevronDown, Globe, FileBox } from 'lucide-react';
```

- [ ] **Step 2: Add `downloadFbxFromScene` and `downloadFbx` helper functions**

Add after the existing `downloadUsdzFromScene` function (~line 126):

```typescript
/** Export the live Three.js scene as GLB, convert to FBX server-side, and download. */
async function downloadFbxFromScene(scene: THREE.Group, baseName: string) {
  const glb = await exportSceneToGlb(scene);
  const glbBlob = new Blob([glb], { type: 'model/gltf-binary' });
  const fbxBlob = await convertToFbx(glbBlob);
  const url = URL.createObjectURL(fbxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.fbx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Fetch GLB from URL, convert to FBX server-side, and download. */
async function downloadFbx(modelUrl: string, baseName: string) {
  const res = await fetch(modelUrl);
  const glbBlob = await res.blob();
  const fbxBlob = await convertToFbx(glbBlob);
  const url = URL.createObjectURL(fbxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.fbx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

- [ ] **Step 3: Update `handleExport` to support FBX**

Change the format type and add the FBX branch:

```typescript
async function handleExport(format: 'glb' | 'usdz' | 'fbx') {
    if (!activeAsset?.modelUrl || working) return;
    setWorking(true);
    setOpen(false);
    try {
      const liveScene = sceneRef?.current;
      if (format === 'glb') {
        if (liveScene) {
          await downloadGlbFromScene(liveScene, baseName);
        } else {
          downloadGlb(activeAsset.modelUrl, baseName);
        }
      } else if (format === 'usdz') {
        if (liveScene) {
          await downloadUsdzFromScene(liveScene, baseName);
        } else {
          await downloadUsdz(activeAsset.modelUrl, baseName);
        }
      } else if (format === 'fbx') {
        if (liveScene) {
          await downloadFbxFromScene(liveScene, baseName);
        } else {
          await downloadFbx(activeAsset.modelUrl, baseName);
        }
      }
    } catch (err) {
      console.error(`[ExportDropdown] ${format} export failed:`, err);
    } finally {
      setWorking(false);
    }
  }
```

- [ ] **Step 4: Update the button text to show "Converting to FBX..." during FBX export**

Replace the `working` state from `boolean` to a string to track which format is exporting:

```typescript
const [working, setWorking] = useState<string | false>(false);
```

Update `handleExport` — change `setWorking(true)` to `setWorking(format)` and `setWorking(false)` stays the same.

Update the main button text:

```typescript
<span>{working ? (working === 'fbx' ? 'Converting…' : 'Exporting…') : 'Export'}</span>
```

Update all `working` boolean checks to `!!working`:
- `disabled={disabled || !!working}`
- `opacity: disabled || !!working ? 0.5 : 1`

- [ ] **Step 5: Add FBX menu item to the dropdown**

Add after the USDZ button (~line 242):

```tsx
<button
  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
  onClick={() => handleExport('fbx')}
>
  <span className="mt-0.5 shrink-0 text-text-secondary"><FileBox size={14} /></span>
  <div className="min-w-0">
    <div className="text-xs font-medium text-text-primary mb-0.5">.fbx</div>
    <div className="text-[11px] text-text-tertiary leading-tight">
      Autodesk FBX (requires converter service)
    </div>
  </div>
</button>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/ExportDropdown.tsx
git commit -m "feat(fbx-export): add FBX option to export dropdown with server-side conversion"
```

---

### Task 5: Build Verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any lint errors in our changed files.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Fix any type errors. The pre-existing `@/lib/api/mock` error is expected — verify no new errors from our changes.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(fbx-export): resolve lint and build errors"
```
