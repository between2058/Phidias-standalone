# Texture Tab — Connect to Trellis.2 /texture Endpoint

## Problem

The texture workspace tab exists in the frontend but uses mock functions. It needs to be wired to the real Trellis.2 `/texture` API endpoint.

## Solution Overview

Reuse the existing `_texture/page.tsx` and `TextureGeneratePanel.tsx` UI. Add a real API client function, get the mesh from workspace assets, and enable the sidebar tab.

```
User uploads reference image (or Text → Qwen → image)
  ↓
Get current model GLB from workspace assets
  ↓
POST /phidias/trellis2/texture (via existing catch-all proxy)
  ↓
Trellis.2 returns { request_id, glb_url }
  ↓
Download textured GLB, update asset modelUrl
```

## API Client

New function in `src/lib/api/phidias.ts`:

```typescript
export async function textureTrellis(
  referenceImage: File | Blob,
  meshFile: File | Blob,
  params?: {
    seed?: number;
    resolution?: number;
    texture_size?: number;
  },
): Promise<ReconViaGenOutput>
```

- Sends `multipart/form-data` with fields `file` (reference image) and `mesh_file` (GLB)
- Hits `{getBackendApi()}/phidias/trellis2/texture`
- Timeout: 300000ms (5 minutes)

## Proxy Route

Uses existing `/api/phidias/trellis2/[...path]/route.ts` catch-all. The path `texture` is not in ENDPOINT_MAP, so it passes through directly to `TRELLIS2_BASE/texture`. Response format is `{ request_id, glb_url }` — same as generate endpoints.

No proxy changes needed.

## Frontend Changes

### `src/app/workspace/_texture/page.tsx`

- Replace `mockGenerateTexture` with `textureTrellis`
- Get mesh from workspace assets: fetch `activeAsset.modelUrl` as Blob
- Text mode: Qwen generates image first, then pass as reference image to `textureTrellis`
- Download result via `downloadPhidiasImage(requestId, fileName, 'trellis2')`
- Update asset with new textured modelUrl

### `src/components/texture/TextureGeneratePanel.tsx`

- Align parameter controls to Trellis.2 `/texture` params:
  - Keep: seed, texture_size (1024/2048/3072/4096)
  - Keep: resolution (used for processing resolution)
  - Remove: advanced settings that don't exist in `/texture` (guidance_strength, guidance_rescale, sampling_steps, rescale_t — these are for generation, not texturing)
- Keep Image mode and Text mode as-is

### `src/components/shared/LeftIconSidebar.tsx`

Uncomment the Texture tab line.

## Files to Modify

| File | Action | Change |
|------|--------|--------|
| `src/lib/api/phidias.ts` | **Modify** | Add `textureTrellis()` function |
| `src/app/workspace/_texture/page.tsx` | **Modify** | Wire to real API, get mesh from assets |
| `src/components/texture/TextureGeneratePanel.tsx` | **Modify** | Remove non-applicable advanced params |
| `src/components/shared/LeftIconSidebar.tsx` | **Modify** | Uncomment Texture tab |

## Mesh Source

The mesh comes from the currently active workspace asset (`activeAsset.modelUrl`). The page fetches this URL as a Blob and sends it as the `mesh_file` field in the FormData. If no asset is loaded, the Generate button is disabled.

## Text Mode Flow

1. User enters text prompt
2. Qwen `/edit` generates a styled reference image
3. Reference image is passed to `textureTrellis()` along with the mesh
4. Result replaces the current asset's modelUrl

## Error Handling

- No active asset → Generate button disabled
- Trellis.2 error → show error message in UI (existing pattern)
- Qwen error (text mode) → show error, don't proceed to texturing
