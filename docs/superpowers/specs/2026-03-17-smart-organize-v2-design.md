# Smart Organize V2 — Two-Stage + Annotated Screenshots + Spatial Hints

## Problem

When parts count exceeds ~20, the current single-pass smart organize produces inaccurate part names (A) and unreasonable groupings (C). Root cause: VLM cognitive overload from too many similar colors and too much cross-referencing in a single call.

## Solution Overview

A two-stage VLM pipeline with enhanced visual inputs:

```
Stage 1: Structure Recognition (lightweight, original textures only)
  → object type + high-level structural regions

Stage 2: Naming & Grouping (annotated color-coded screenshots + spatial hints + Stage 1 context)
  → per-part name + group assignments
```

## API Architecture

### Orchestration Strategy

Both VLM stages are orchestrated **server-side** within a single API call. The frontend sends one request (same as today); the backend makes two sequential VLM calls internally.

**Rationale**: Keeps the frontend simple, avoids dual-mode API surface expansion, and allows the backend to pass Stage 1 results directly to Stage 2 without a round-trip.

### Standalone Mode

Single endpoint: `POST /phidias/smart-organize` (unchanged).

The backend `route.ts` receives the same FormData as today (parts, original images, colored images, angles), plus new fields:
- `spatialHints` (JSON string) — pre-computed spatial position descriptions
- `numberMapping` (JSON string) — number-to-part-ID mapping

The backend internally:
1. Calls VLM Stage 1 with original images only
2. Calls VLM Stage 2 with all data + Stage 1 result
3. Resolves number-to-ID mapping in `extractAndValidate`
4. Returns `SmartOrganizeResponse` (unchanged)

### Web Component Mode

Same single-endpoint contract. The external backend service receives the same FormData and orchestrates both VLM stages internally. No additional endpoints required.

### API Client Signature

```typescript
export async function smartOrganize(
  parts: SmartOrganizePart[],
  originalFiles: (File | Blob)[],
  coloredFiles: (File | Blob)[],
  angleLabels: string[],
  spatialHints?: string,           // NEW: pre-computed spatial descriptions
  numberMapping?: Record<number, string>,  // NEW: number → part ID
  settings?: Record<string, unknown>,
): Promise<SmartOrganizeResponse>
```

## Stage 1: Structure Recognition

**Input**: Original texture screenshots only (3 angles, fixed).

**Prompt**:
```
You see multi-angle screenshots of a 3D model. Please:
1. Identify what this object is (e.g. "office chair", "sports car")
2. List the major structural regions you can identify (e.g. "base with 5 wheels", "seat cushion", "backrest", "two armrests")
3. Return ONLY JSON: {"object": "...", "regions": ["...", "..."]}
```

**Config**:
- `max_tokens`: 512 (response is short)
- `temperature`: 0.2 (same as current)
- Retry: 1 attempt (no retry — failure is gracefully handled)

**Response parsing**:
- Extract JSON object (not array) from VLM response — use a dedicated `extractJsonObject` parser that looks for `{...}` instead of `[...]`
- Validate: `object` must be a non-empty string (truncate to 100 chars); `regions` must be an array of strings (cap at 20 entries)
- On any parse/validation failure: default to `{ object: "unknown object", regions: [] }`

**Failure handling**: If Stage 1 fails entirely (network error, timeout), Stage 2 proceeds without structural context. The `object` field defaults to `"unknown object"` and `regions` defaults to an empty array. This degrades to an enhanced single-pass (still has annotations + spatial hints).

**Timeout**: 30 seconds (shorter than Stage 2, since the task is lightweight).

## Pre-Processing Enhancements

### Annotated Number Labels on Color-Coded Screenshots

After rendering color-coded screenshots via WebGL, overlay number labels using a **2D canvas compositing pipeline**:

1. **Render WebGL frame** → call `renderer.domElement.toDataURL()` to get the base image
2. **Create a 2D canvas** (same resolution: 768×768) → draw the WebGL image onto it
3. **Compute screen-space centroid** — project each mesh's bounding box center to 2D screenshot coordinates using `Vector3.project(camera)`, then map to canvas pixel coordinates
4. **Draw labels** — at each centroid, draw a filled circle (radius 12px, `rgba(0,0,0,0.75)` background) with white bold number text (font size 14px)
5. **Handle overlap** — if two labels are within 20px (calibrated for 768×768 resolution):
   - Sort overlapping labels by part index
   - Displace radially outward from the cluster centroid, spacing at 24px intervals
   - Clamp to canvas bounds (12px padding from edges)
   - Maximum displacement: 60px from original position (beyond this, label accuracy degrades — acceptable trade-off)
6. **Export** — `canvas.toBlob()` to produce the final annotated PNG
7. **Update color legend format** — change from `"part_abc" → bright green (#00FF00)` to `#1 → "part_abc"`, so VLM reads numbers from the image instead of matching colors

**Known limitation**: Bounding box center projection may not always land on a visible surface (e.g., for L-shaped or concave parts). This is acceptable because the numbered label is still near the part and VLM can spatially correlate. A raycasting-based visible centroid would be more accurate but significantly more complex.

### Spatial Position Hints

Generate a text description of each part's spatial location within the model:

1. **Compute** — get each mesh's bounding box center in world coordinates
2. **Normalize** — map to [0, 1] range relative to the model's overall bounding box
3. **Convert to semantic description** — based on normalized coordinates, generate region labels:
   - Y-axis: `bottom` (0–0.33), `center` (0.33–0.66), `upper` (0.66–1.0)
   - X/Z-axis: `left`/`right`, `front`/`back`
   - Example: `#1: upper-back region`
4. **Merge nearby parts** — parts whose normalized bounding box centers are within Euclidean distance 0.15 share a combined description (e.g. `#12, #13, #14: bottom region, close together`), reducing prompt length and hinting at potential grouping
5. **Parts with no geometry** (`meshIds: []`): skip from spatial hints and label annotation; include in the number mapping with a note `#N: no geometry (empty part)`

### Dynamic Capture Angles

Adjust the number of color-coded screenshot angles based on parts count:

| Parts Count | Angles | Added Views |
|-------------|--------|-------------|
| ≤ 15        | 3      | (current behavior) |
| 16–30       | 5      | + bottom, + front |
| > 30        | 6      | + top-down |

Original texture screenshots always use the base 3 angles (Stage 1 cost stays constant).

New angle definitions:
```typescript
const BASE_ANGLES: [number, number, string][] = [
  [30, 20, 'front-right'],
  [210, 20, 'back-left'],
  [120, 60, 'top-side'],
];

const EXTRA_ANGLES: [number, number, string][] = [
  [0, -30, 'bottom'],
  [0, 15, 'front'],
  [0, 90, 'top-down'],
];
```

**Backend image handling**: The backend receives separate `angleLabels` for original and colored image sets. The FormData includes:
- `originalAngles` (JSON string) — always 3 labels
- `coloredAngles` (JSON string) — 3–6 labels depending on parts count

The `buildImageContent*` functions use the respective angle label arrays when labeling images.

## Stage 2: Naming & Grouping

**Input**:
- Stage 1 result (`object`, `regions`)
- Annotated (numbered) color-coded screenshots (dynamic angle count)
- Original texture screenshots (3 angles)
- Spatial position hints text
- Number-to-ID mapping

**Prompt**:
```
This 3D model is a "{object}" with these structural regions: {regions}.

Below are multi-angle screenshots:
- ORIGINAL TEXTURE views: understand materials and function
- NUMBERED COLOR-CODED views: each part has a number label on it

Part mapping (number → ID):
#1 → "part_abc"
#2 → "part_def"
...

Spatial hints (position within model):
#1, #2, #3: bottom region, close together
#4: center region
#5, #6: upper-left region
...

Instructions:
1. Match each numbered part to the structural regions listed above.
2. Name each part based on its real-world function (2-4 words).
3. Group parts using the structural regions as group names.
   You may split or merge regions if the parts don't fit well.
4. Return ONLY a JSON array: [{"id":"part_abc", "name":"...", "group":"..."}, ...]

Rules:
- Use the part ID (not the number) in the "id" field
- Use short, descriptive English names (2-4 words max)
- Same-type parts MUST share a group
- Symmetric parts share a group
- Include ALL {N} parts — do not skip any
- Return ONLY the JSON array
```

**Config**:
- `max_tokens`: 16384 (same as current)
- `temperature`: 0.2
- Retry: up to 2 attempts (same as current)
- Timeout: 120 seconds

**Key differences from current approach**:
- VLM knows what the object is (from Stage 1) — no need to guess
- VLM reads numbered labels from the image — no need to match colors to IDs
- Spatial hints provide grouping cues — VLM can confirm or override
- `regions` serve as suggested group candidates, not hard constraints

**Number-to-ID resolution in `extractAndValidate`**: The existing validation checks `inputIds.has(id)`. Add a pre-pass: if `id` is a pure number string (e.g. `"1"`, `"12"`), resolve it via the number mapping before the `has` check. This handles VLMs that return numbers despite being asked for IDs.

## Number-to-ID Mapping

Parts are assigned sequential numbers (1-based) for display in screenshots. The mapping is computed on the frontend and sent to the backend:

```typescript
const numberMapping: Record<number, string> = {};
parts.forEach((p, i) => { numberMapping[i + 1] = p.id; });
```

The mapping is used in:
1. The Stage 2 prompt (so VLM knows which number corresponds to which ID)
2. `extractAndValidate` fallback (resolve numeric IDs to real IDs)

## Data Flow

```
User clicks "Smart Organize"
        ↓
Frontend:
  1. Capture original texture screenshots (3 angles)
  2. Determine angle count based on parts.length
  3. Capture color-coded screenshots (3-6 angles)
  4. Annotate color-coded screenshots with number labels (Canvas 2D)
  5. Compute spatial position hints
  6. Build number-to-ID mapping
  7. POST to /phidias/smart-organize (single call)
        ↓
Backend:
  8.  Parse FormData
  9.  Stage 1 VLM call (original images only) → { object, regions }
      (on failure: defaults, continue)
  10. Stage 2 VLM call (all images + Stage 1 context + spatial hints)
      → [{ id, name, group }, ...]
  11. Resolve number-to-ID if needed
  12. Validate and return SmartOrganizeResponse
        ↓
Frontend:
  13. Apply results (rename parts, build groups, update scene)
      (same as current logic)
```

## Cancellation and Timeout

- The frontend `abortRef` controller is passed to the API call (same as current)
- Aborting during Stage 1 cancels the entire operation
- Aborting during Stage 2 cancels the entire operation
- Per-stage timeouts: Stage 1 = 30s, Stage 2 = 120s
- Overall request timeout remains 600s (same as current client config)

## UI Progress Feedback

Update `isOrganizing` from boolean to a stage indicator:

```typescript
type OrganizeStage = null | 'analyzing' | 'organizing';
```

- `null` — idle
- `'analyzing'` — Stage 1 in progress (UI shows "Analyzing structure...")
- `'organizing'` — Stage 2 in progress (UI shows "Organizing parts...")

The `SegmentAIPanel` button text updates based on stage.

## Edge Cases

| Case | Handling |
|------|----------|
| 0–1 parts | Skip smart organize entirely (button disabled, same as current) |
| Parts with empty `meshIds` | Excluded from annotation/spatial hints; included in number mapping with note |
| VLM returns out-of-range numbers | Ignored in `extractAndValidate`; fallback name assigned |
| 50+ parts | Same pipeline applies; label density on screenshots may reduce accuracy but spatial hints compensate. Future improvement: consider batching by spatial clusters |
| Non-English VLM response | `extractAndValidate` accepts any string for `name`/`group`; no language enforcement |

## Files to Modify

1. **`src/app/api/phidias/smart-organize/route.ts`** — add Stage 1 VLM call, `extractJsonObject` parser, number-to-ID resolution in `extractAndValidate`, separate angle label handling for original vs. colored
2. **`src/app/workspace/segment/page.tsx`** — dynamic angle selection, orchestrate new FormData fields
3. **`src/lib/api/phidias.ts`** — update `smartOrganize` signature with new optional params
4. **NEW: `src/lib/smart-organize-utils.ts`** — extract screenshot annotation logic (Canvas 2D compositing) and spatial hint computation to keep `page.tsx` under 1,000 lines

## Backward Compatibility

- The external API contract (`SmartOrganizeResponse`) remains unchanged
- The frontend result handling (rename + group + scene update) remains unchanged
- The backend endpoint path and method remain unchanged
- The new FormData fields (`spatialHints`, `numberMapping`, `originalAngles`, `coloredAngles`) are optional — if missing, the backend falls back to current behavior (single-pass, shared angle labels)
- `hexToReadableName` is retained for fallback naming in `extractAndValidate`

## Performance Considerations

- Stage 1 is lightweight (~512 max_tokens, 3 images, no parts data) — adds ~3-5s latency
- Dynamic angles add 2-3 extra screenshots for 20+ parts — marginal render cost
- Canvas 2D annotation is synchronous and fast (~50ms per screenshot)
- Spatial hint computation is O(N) on parts count — negligible
- Total: ~1.3-1.5x current latency for 2 VLM calls, but significantly better quality
