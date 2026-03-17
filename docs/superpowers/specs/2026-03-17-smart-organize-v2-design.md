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

## Stage 1: Structure Recognition

**Input**: Original texture screenshots only (3 angles, fixed).

**Prompt**:
```
You see multi-angle screenshots of a 3D model. Please:
1. Identify what this object is (e.g. "office chair", "sports car")
2. List the major structural regions you can identify (e.g. "base with 5 wheels", "seat cushion", "backrest", "two armrests")
3. Return JSON: {"object": "...", "regions": ["...", "..."]}
```

**Config**:
- `max_tokens`: 512 (response is short)
- `temperature`: 0.2 (same as current)

**Failure handling**: If Stage 1 fails, Stage 2 proceeds without structural context (degrades to enhanced single-pass). The `object` field defaults to `"unknown object"` and `regions` defaults to an empty array.

## Pre-Processing Enhancements

### Annotated Number Labels on Color-Coded Screenshots

After rendering color-coded screenshots, overlay number labels using Canvas 2D:

1. **Compute screen-space centroid** — project each mesh's bounding box center to 2D screenshot coordinates using the camera's projection matrix
2. **Draw labels** — at each centroid, draw a small filled circle (dark background) with white number text (e.g. `1`, `2`, `3`)
3. **Handle overlap** — if two labels are within 20px, apply simple offset displacement to avoid occlusion
4. **Update color legend format** — change from `"part_abc" → bright green (#00FF00)` to `#1 → "part_abc"`, so VLM reads numbers from the image instead of matching colors

### Spatial Position Hints

Generate a text description of each part's spatial location within the model:

1. **Compute** — get each mesh's bounding box center in world coordinates
2. **Normalize** — map to [0, 1] range relative to the model's overall bounding box
3. **Convert to semantic description** — based on normalized coordinates, generate region labels:
   - Y-axis: `bottom` (0-0.33), `center` (0.33-0.66), `upper` (0.66-1.0)
   - X/Z-axis: `left`/`right`, `front`/`back`
   - Example: `#1: upper-back region`
4. **Merge nearby parts** — parts within a proximity threshold share a combined description (e.g. `#12, #13, #14: bottom region, close together`), reducing prompt length and hinting at potential grouping

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

## Stage 2: Naming & Grouping

**Input**:
- Stage 1 result (`object`, `regions`)
- Annotated (numbered) color-coded screenshots (dynamic angle count)
- Original texture screenshots (3 angles)
- Spatial position hints text

**Prompt**:
```
This 3D model is a "{object}" with these structural regions: {regions}.

Below are multi-angle screenshots:
- ORIGINAL TEXTURE views: understand materials and function
- NUMBERED COLOR-CODED views: each part has a number label on it

Spatial hints (normalized position within model bounding box):
#1, #2, #3: bottom region, close together
#4: center region
#5, #6: upper-left region
...

Instructions:
1. Match each numbered part to the structural regions listed above.
2. Name each part based on its real-world function (2-4 words).
3. Group parts using the structural regions as group names.
   You may split or merge regions if the parts don't fit well.
4. Return ONLY a JSON array: [{"id":"...", "name":"...", "group":"..."}, ...]

Rules:
- Use short, descriptive English names (2-4 words max)
- Same-type parts MUST share a group
- Symmetric parts share a group
- Include ALL {N} parts — do not skip any
- Return ONLY the JSON array
```

**Key differences from current approach**:
- VLM knows what the object is (from Stage 1) — no need to guess
- VLM reads numbered labels from the image — no need to match colors to IDs
- Spatial hints provide grouping cues — VLM can confirm or override
- `regions` serve as suggested group candidates, not hard constraints

**Response parsing**: Reuse existing `extractAndValidate` logic unchanged. The `id` field in the mapping from number to part ID is resolved on the frontend before calling `extractAndValidate`.

## Data Flow

```
User clicks "Smart Organize"
        ↓
1. Capture original texture screenshots (3 angles)
        ↓
2. Stage 1 VLM call → { object, regions }
        ↓  (on failure: object="unknown object", regions=[])
        ↓
3. Determine angle count based on parts.length
4. Capture color-coded screenshots (3-6 angles)
5. Annotate screenshots with number labels (Canvas 2D)
6. Compute spatial position hints
        ↓
7. Stage 2 VLM call → [{ id, name, group }, ...]
        ↓
8. Apply results (rename parts, build groups, update scene)
   (same as current logic)
```

## Number-to-ID Mapping

Parts are assigned sequential numbers (1-based) for display in screenshots. The mapping is maintained in the frontend:

```typescript
const numberToId = new Map<number, string>();
parts.forEach((p, i) => { numberToId.set(i + 1, p.id); });
```

The Stage 2 prompt uses numbers. The response JSON uses the original part IDs (the prompt includes the mapping in the color legend: `#1 → "part_abc"`). If the VLM returns numbers instead of IDs, the frontend resolves them before passing to `extractAndValidate`.

## Files to Modify

1. **`src/app/api/phidias/smart-organize/route.ts`** — split into two-stage VLM calls, update prompt templates
2. **`src/app/workspace/segment/page.tsx`** — add screenshot annotation logic, spatial hint computation, dynamic angle selection, orchestrate two-stage flow
3. **`src/lib/api/phidias.ts`** — add Stage 1 API function (or extend existing `smartOrganize` to accept a `stage` parameter)

## Backward Compatibility

- The external API contract (`SmartOrganizeResponse`) remains unchanged
- The frontend result handling (rename + group + scene update) remains unchanged
- For web component mode, the backend service will need to implement the two-stage logic independently (or expose two endpoints)

## Performance Considerations

- Stage 1 is lightweight (~512 max_tokens, 3 images, no parts data) — adds minimal latency
- Dynamic angles add 2-3 extra screenshots for 20+ parts — marginal render cost
- Canvas 2D annotation is synchronous and fast
- Spatial hint computation is O(N) on parts count — negligible
- Total: ~1.5x current latency for 2 VLM calls, but significantly better quality
