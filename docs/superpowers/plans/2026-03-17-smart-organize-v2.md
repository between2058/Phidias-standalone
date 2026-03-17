# Smart Organize V2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve smart organize accuracy for 20+ parts via two-stage VLM pipeline, annotated screenshots, and spatial hints.

**Architecture:** Server-side two-stage VLM orchestration within a single API call. Frontend computes spatial hints, annotates screenshots with number labels, and sends enriched FormData. New utility module `smart-organize-utils.ts` holds annotation, spatial logic, and screenshot helpers extracted from `page.tsx`.

**Tech Stack:** Three.js, Canvas 2D API, Next.js API Routes, VLM (Anthropic / OpenAI-compatible)

**Spec:** `docs/superpowers/specs/2026-03-17-smart-organize-v2-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/smart-organize-utils.ts` | **Create** | Screenshot capture helpers (`renderFromAngle`, `applySegmentColorMaterials`, `captureMultiViewScreenshots`, `getMeshColors`), spatial hint computation, screenshot annotation (Canvas 2D), dynamic angle selection, number-to-ID mapping |
| `src/app/api/phidias/smart-organize/route.ts` | **Modify** | Add Stage 1 VLM call, `extractJsonObject` parser, two-stage prompt templates, number-to-ID resolution in `extractAndValidate`, separate angle label handling |
| `src/lib/api/phidias.ts` | **Modify** | Add `spatialHints`, `numberMapping`, `originalAngles`, `coloredAngles` params to `smartOrganize()` |
| `src/app/workspace/segment/page.tsx` | **Modify** | Remove screenshot helpers (moved to utils), use new utils, dynamic angles, pass new FormData fields, update `isOrganizing` to stage indicator |
| `src/components/segment/SegmentAIPanel.tsx` | **Modify** | Accept `OrganizeStage` type instead of boolean, show stage-specific text |

---

### Task 1: Create `smart-organize-utils.ts` — Move Existing Helpers + Spatial Hints

**Files:**
- Create: `src/lib/smart-organize-utils.ts`
- Modify: `src/app/workspace/segment/page.tsx` (remove extracted functions)

This task moves existing screenshot helpers out of `page.tsx` (currently 1,437 lines) into the new utility module, and adds spatial hint computation.

- [ ] **Step 1: Create the file with existing screenshot helpers + spatial hint functions**

Move `renderFromAngle`, `applySegmentColorMaterials`, `captureMultiViewScreenshots`, and `getMeshColors` from `page.tsx` (lines 148-282) into the new file. Also add `computePartSpatials` and `buildSpatialHintsText`.

```typescript
// src/lib/smart-organize-utils.ts
import * as THREE from 'three';

// Re-export Part type reference for function signatures
export interface PartLike {
  id: string;
  color: string;
  meshIds: string[];
}

export interface PartSpatialInfo {
  number: number;
  id: string;
  center: THREE.Vector3;      // world-space
  normalized: THREE.Vector3;   // [0,1] relative to model bbox
}

// ── Camera angle constants ──────────────────────────────────────────────────

/** Camera angles: [azimuth°, elevation°, label] */
export const BASE_ANGLES: [number, number, string][] = [
  [30, 20, 'front-right'],
  [210, 20, 'back-left'],
  [120, 60, 'top-side'],
];

export const EXTRA_ANGLES: [number, number, string][] = [
  [0, -30, 'bottom'],
  [0, 15, 'front'],
  [0, 90, 'top-down'],
];

/**
 * Select capture angles for color-coded screenshots based on parts count.
 * Original texture screenshots always use BASE_ANGLES.
 */
export function getColoredAngles(partsCount: number): [number, number, string][] {
  if (partsCount <= 15) return BASE_ANGLES;
  if (partsCount <= 30) return [...BASE_ANGLES, ...EXTRA_ANGLES.slice(0, 2)];
  return [...BASE_ANGLES, ...EXTRA_ANGLES];
}

// ── Screenshot helpers (moved from page.tsx) ────────────────────────────────

/** Render the scene group from a specific angle to a PNG Blob. */
export function renderFromAngle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  group: THREE.Group,
  center: THREE.Vector3,
  dist: number,
  azimuthDeg: number,
  elevationDeg: number,
): Promise<Blob> {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  camera.position.set(
    center.x + dist * Math.cos(el) * Math.sin(az),
    center.y + dist * Math.sin(el),
    center.z + dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(center);
  renderer.render(scene, camera);

  return new Promise<Blob>((resolve, reject) => {
    renderer.domElement.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Screenshot capture failed')),
      'image/png',
    );
  });
}

/** Swap all mesh materials to segment colors, returns a restore function. */
export function applySegmentColorMaterials(
  group: THREE.Group,
  parts: PartLike[],
): () => void {
  const overrides: { mesh: THREE.Mesh; origMat: THREE.Material | THREE.Material[] }[] = [];
  const colorMap = new Map<string, string>();
  for (const p of parts) {
    const color = p.color || '';
    if (color) p.meshIds.forEach(mid => colorMap.set(mid, color));
  }

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const id = child.name || child.uuid;
    const color = colorMap.get(id);
    if (color) {
      overrides.push({ mesh: child, origMat: child.material });
      child.material = new THREE.MeshStandardMaterial({
        color, roughness: 0.6, metalness: 0.1,
      });
    }
  });

  return () => {
    for (const { mesh, origMat } of overrides) {
      mesh.material = origMat;
    }
  };
}

/** Read the material colour of every Mesh child in the scene group. */
export function getMeshColors(group: THREE.Group): { id: string; color: string }[] {
  const result: { id: string; color: string }[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (mat?.color) {
        result.push({ id: child.name || child.uuid, color: '#' + mat.color.getHexString() });
      }
    }
  });
  return result;
}

// ── Spatial hint computation ────────────────────────────────────────────────

/**
 * Compute normalized bounding-box center for each part's meshes.
 * Parts with empty meshIds are skipped (no geometry).
 */
export function computePartSpatials(
  group: THREE.Group,
  parts: { id: string; meshIds: string[] }[],
): PartSpatialInfo[] {
  const modelBox = new THREE.Box3().setFromObject(group);
  const modelMin = modelBox.min;
  const modelSize = modelBox.getSize(new THREE.Vector3());
  const safeSize = new THREE.Vector3(
    modelSize.x || 1, modelSize.y || 1, modelSize.z || 1,
  );

  const results: PartSpatialInfo[] = [];
  let num = 1;

  for (const part of parts) {
    if (part.meshIds.length === 0) {
      num++;
      continue;
    }
    const partBox = new THREE.Box3();
    let found = false;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const childId = child.name || child.uuid;
        if (part.meshIds.includes(childId)) {
          partBox.expandByObject(child);
          found = true;
        }
      }
    });
    if (!found) { num++; continue; }

    const center = partBox.getCenter(new THREE.Vector3());
    const normalized = new THREE.Vector3(
      (center.x - modelMin.x) / safeSize.x,
      (center.y - modelMin.y) / safeSize.y,
      (center.z - modelMin.z) / safeSize.z,
    );
    results.push({ number: num, id: part.id, center, normalized });
    num++;
  }

  return results;
}

/**
 * Convert normalized positions into human-readable spatial descriptions.
 * Merges nearby parts (Euclidean distance < 0.15 from cluster seed) into combined descriptions.
 */
export function buildSpatialHintsText(
  spatials: PartSpatialInfo[],
  emptyParts?: { number: number; id: string }[],
): string {
  const describePosition = (n: THREE.Vector3): string => {
    const yLabel = n.y < 0.33 ? 'bottom' : n.y < 0.66 ? 'center' : 'upper';
    const zLabel = n.z < 0.4 ? 'front' : n.z > 0.6 ? 'back' : '';
    const xLabel = n.x < 0.4 ? 'left' : n.x > 0.6 ? 'right' : '';
    return [yLabel, xLabel, zLabel].filter(Boolean).join('-') + ' region';
  };

  const MERGE_THRESHOLD = 0.15;
  const used = new Set<number>();
  const groups: { members: PartSpatialInfo[]; desc: string }[] = [];

  for (let i = 0; i < spatials.length; i++) {
    if (used.has(i)) continue;
    const cluster = [spatials[i]];
    used.add(i);
    for (let j = i + 1; j < spatials.length; j++) {
      if (used.has(j)) continue;
      if (spatials[i].normalized.distanceTo(spatials[j].normalized) < MERGE_THRESHOLD) {
        cluster.push(spatials[j]);
        used.add(j);
      }
    }
    const desc = describePosition(cluster[0].normalized);
    groups.push({ members: cluster, desc });
  }

  const lines = groups.map(({ members, desc }) => {
    const ids = members.map(m => `#${m.number}`).join(', ');
    const suffix = members.length > 1 ? ', close together' : '';
    return `${ids}: ${desc}${suffix}`;
  });

  // Append notes for parts with no geometry
  if (emptyParts && emptyParts.length > 0) {
    for (const ep of emptyParts) {
      lines.push(`#${ep.number}: no geometry (empty part)`);
    }
  }

  return lines.join('\n');
}

// ── Number mapping ──────────────────────────────────────────────────────────

/**
 * Build a 1-based number-to-part-ID mapping.
 * Also returns a list of parts with no geometry for spatial hints annotation.
 */
export function buildNumberMapping(
  parts: { id: string; meshIds: string[] }[],
): { mapping: Record<number, string>; emptyParts: { number: number; id: string }[] } {
  const mapping: Record<number, string> = {};
  const emptyParts: { number: number; id: string }[] = [];
  parts.forEach((p, i) => {
    const num = i + 1;
    mapping[num] = p.id;
    if (p.meshIds.length === 0) {
      emptyParts.push({ number: num, id: p.id });
    }
  });
  return { mapping, emptyParts };
}
```

- [ ] **Step 2: Remove the moved functions from `page.tsx`**

Remove lines 148-282 from `page.tsx` (the `CAPTURE_ANGLES` constant, `renderFromAngle`, `applySegmentColorMaterials`, `captureMultiViewScreenshots`, and `getMeshColors` functions). Add an import at the top:

```typescript
import {
  renderFromAngle,
  applySegmentColorMaterials,
  getMeshColors,
  BASE_ANGLES,
  type PartLike,
} from '@/lib/smart-organize-utils';
```

Ensure any remaining references to `CAPTURE_ANGLES` in `page.tsx` are replaced with `BASE_ANGLES`.

- [ ] **Step 3: Verify build still works**

```bash
pnpm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/smart-organize-utils.ts src/app/workspace/segment/page.tsx
git commit -m "refactor(smart-organize): extract screenshot helpers to utils, add spatial hints"
```

---

### Task 2: Add Screenshot Annotation to `smart-organize-utils.ts`

**Files:**
- Modify: `src/lib/smart-organize-utils.ts`

- [ ] **Step 1: Add the screenshot annotation functions**

Append to `smart-organize-utils.ts`:

```typescript
// ── Screenshot annotation ───────────────────────────────────────────────────

export interface LabelPosition {
  number: number;
  x: number;  // canvas pixel x
  y: number;  // canvas pixel y
}

/**
 * Project part centroids to 2D screen coordinates for a given camera.
 */
export function projectToScreen(
  spatials: PartSpatialInfo[],
  camera: THREE.Camera,
  width: number,
  height: number,
): LabelPosition[] {
  const labels: LabelPosition[] = [];
  for (const s of spatials) {
    const v = s.center.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * width;
    const y = (-v.y * 0.5 + 0.5) * height;
    // Skip labels that project behind the camera
    if (v.z > 1) continue;
    labels.push({ number: s.number, x, y });
  }
  return labels;
}

/**
 * Resolve overlapping labels by displacing them radially.
 * Mutates the input array in place.
 */
export function resolveOverlaps(
  labels: LabelPosition[],
  canvasWidth: number,
  canvasHeight: number,
  minDist = 20,
  maxDisplacement = 60,
  padding = 12,
): void {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const dx = labels[j].x - labels[i].x;
        const dy = labels[j].y - labels[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist > 0) {
          const pushDist = Math.min((minDist - dist) / 2 + 2, maxDisplacement);
          const angle = Math.atan2(dy, dx);
          labels[j].x += Math.cos(angle) * pushDist;
          labels[j].y += Math.sin(angle) * pushDist;
          labels[i].x -= Math.cos(angle) * pushDist;
          labels[i].y -= Math.sin(angle) * pushDist;
        }
      }
    }
  }
  for (const l of labels) {
    l.x = Math.max(padding, Math.min(canvasWidth - padding, l.x));
    l.y = Math.max(padding, Math.min(canvasHeight - padding, l.y));
  }
}

/**
 * Annotate a WebGL-rendered screenshot blob with numbered labels.
 * Returns a new Blob with labels drawn via Canvas 2D compositing.
 */
export async function annotateScreenshot(
  sourceBlob: Blob,
  labels: LabelPosition[],
  width: number,
  height: number,
): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(sourceBlob);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px sans-serif';

  for (const label of labels) {
    ctx.beginPath();
    ctx.arc(label.x, label.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(label.number), label.x, label.y);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Annotation canvas export failed')),
      'image/png',
    );
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/smart-organize-utils.ts
git commit -m "feat(smart-organize): add screenshot annotation with numbered labels"
```

---

### Task 3: Update Backend Route — Stage 1 VLM Call + `extractJsonObject`

**Files:**
- Modify: `src/app/api/phidias/smart-organize/route.ts`

- [ ] **Step 1: Add `extractJsonObject` parser and Stage 1 logic**

Add after `extractJson` function (~line 259):

```typescript
// ── Stage 1: Structure Recognition ──────────────────────────────────────────

interface Stage1Result {
    object: string;
    regions: string[];
}

function extractJsonObject(text: string): Record<string, unknown> {
    const trimmed = text.trim();

    if (trimmed.startsWith('{')) {
        try { return JSON.parse(trimmed); } catch { /* continue */ }
    }

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
    }

    let depth = 0, start = -1;
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '{') { if (depth === 0) start = i; depth++; }
        else if (trimmed[i] === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                try { return JSON.parse(trimmed.slice(start, i + 1)); } catch { /* continue */ }
            }
        }
    }

    throw new Error('No valid JSON object found in VLM response');
}

function parseStage1Response(raw: string): Stage1Result {
    try {
        const obj = extractJsonObject(raw);
        const object = typeof obj.object === 'string' && obj.object.trim()
            ? obj.object.trim().slice(0, 100)
            : 'unknown object';
        const regions = Array.isArray(obj.regions)
            ? obj.regions.filter((r): r is string => typeof r === 'string').slice(0, 20)
            : [];
        return { object, regions };
    } catch {
        return { object: 'unknown object', regions: [] };
    }
}

const STAGE1_SYSTEM = [
    'You are a 3D model analyst. You receive multi-angle screenshots of a 3D model.',
    'Your task: identify the object type and list its major structural regions.',
    'You MUST return ONLY a valid JSON object. No markdown, no explanation.',
].join('\n');

const STAGE1_USER = [
    'You see multi-angle screenshots of a 3D model. Please:',
    '1. Identify what this object is (e.g. "office chair", "sports car")',
    '2. List the major structural regions you can identify (e.g. "base with 5 wheels", "seat cushion", "backrest", "two armrests")',
    '3. Return ONLY JSON: {"object": "...", "regions": ["...", "..."]}',
].join('\n');

async function runStage1(originalImages: ImageData[], originalAngles: string[]): Promise<Stage1Result> {
    try {
        console.log(`[smart-organize:stage1] calling VLM with ${originalImages.length} images...`);
        const raw = isAnthropic()
            ? await callAnthropic(originalImages, [], originalAngles, [], STAGE1_SYSTEM, STAGE1_USER, 512)
            : await callOpenAICompat(originalImages, [], originalAngles, [], STAGE1_SYSTEM, STAGE1_USER, 512);
        console.log(`[smart-organize:stage1] raw response: ${raw}`);
        const result = parseStage1Response(raw);
        console.log(`[smart-organize:stage1] parsed: object="${result.object}", regions=[${result.regions.join(', ')}]`);
        return result;
    } catch (err: any) {
        console.warn(`[smart-organize:stage1] failed, using defaults:`, err.message);
        return { object: 'unknown object', regions: [] };
    }
}
```

- [ ] **Step 2: Update `callAnthropic` and `callOpenAICompat` signatures**

Update both functions to accept `maxTokens` and separate angle arrays:

```typescript
async function callAnthropic(
    originalImages: ImageData[],
    coloredImages: ImageData[],
    originalAngles: string[],
    coloredAngles: string[],
    system: string,
    user: string,
    maxTokens = 16384,
): Promise<string>
```

Replace hardcoded `max_tokens: 16384` with `max_tokens: maxTokens` in the request body.

Do the same for `callOpenAICompat`.

- [ ] **Step 3: Update `buildImageContent*` functions for separate angle arrays**

```typescript
function buildImageContentOpenAI(
    originalImages: ImageData[],
    coloredImages: ImageData[],
    originalAngles: string[],
    coloredAngles: string[],
): any[] {
    const content: any[] = [];

    content.push({ type: 'text', text: '--- ORIGINAL TEXTURE VIEWS ---' });
    for (let i = 0; i < originalImages.length; i++) {
        const label = originalAngles[i] ?? `angle ${i + 1}`;
        content.push({ type: 'text', text: `[Original — ${label}]` });
        content.push({
            type: 'image_url',
            image_url: { url: `data:${originalImages[i].mime};base64,${originalImages[i].base64}` },
        });
    }

    if (coloredImages.length > 0) {
        content.push({ type: 'text', text: '--- NUMBERED COLOR-CODED PART VIEWS ---' });
        for (let i = 0; i < coloredImages.length; i++) {
            const label = coloredAngles[i] ?? `angle ${i + 1}`;
            content.push({ type: 'text', text: `[Color-coded — ${label}]` });
            content.push({
                type: 'image_url',
                image_url: { url: `data:${coloredImages[i].mime};base64,${coloredImages[i].base64}` },
            });
        }
    }

    return content;
}
```

Do the same for `buildImageContentAnthropic`. Note the section header changes from `COLOR-CODED PART VIEWS` to `NUMBERED COLOR-CODED PART VIEWS`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/phidias/smart-organize/route.ts
git commit -m "feat(smart-organize): add Stage 1 VLM call and extractJsonObject parser"
```

---

### Task 4: Update Backend Route — Stage 2 Prompt + Number-to-ID Resolution

**Files:**
- Modify: `src/app/api/phidias/smart-organize/route.ts`

- [ ] **Step 1: Update `extractAndValidate` with number-to-ID resolution**

```typescript
function extractAndValidate(
    rawText: string,
    inputParts: { id: string; color: string }[],
    numberMapping?: Record<string, string>,  // "1" → "part_abc" (JSON keys are always strings)
): { id: string; name: string; group: string }[] {
    const parsed = extractJson(rawText);

    if (!Array.isArray(parsed)) {
        throw new Error('VLM response is not an array');
    }

    const inputIds = new Set(inputParts.map(p => p.id));
    const resultMap = new Map<string, { name: string; group: string }>();

    for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        let id = String(item.id ?? '');
        const name = String(item.name ?? '').trim();
        const group = String(item.group ?? '').trim();

        // Resolve numeric ID via number mapping (VLM may return "1" instead of "part_abc")
        if (id && !inputIds.has(id) && numberMapping) {
            const resolved = numberMapping[id];
            if (resolved) id = resolved;
        }

        if (id && inputIds.has(id) && name) {
            resultMap.set(id, { name, group: group || 'Ungrouped' });
        }
    }

    const result: { id: string; name: string; group: string }[] = [];
    for (let idx = 0; idx < inputParts.length; idx++) {
        const p = inputParts[idx];
        const match = resultMap.get(p.id);
        if (match) {
            result.push({ id: p.id, ...match });
        } else {
            const colorName = hexToReadableName(p.color);
            result.push({
                id: p.id,
                name: `Part ${idx + 1} (${colorName})`,
                group: 'Ungrouped',
            });
        }
    }

    return result;
}
```

- [ ] **Step 2: Rewrite `POST` handler for two-stage flow**

Replace the existing `POST` handler body. Key structure:

```typescript
export async function POST(request: NextRequest) {
    try {
        if (!VLM_API_URL || !VLM_API_KEY) {
            return NextResponse.json(
                { error: 'VLM not configured. Set VLM_API_URL and VLM_API_KEY in .env' },
                { status: 500 },
            );
        }

        const formData = await request.formData();
        const partsJson = formData.get('parts') as string | null;
        const spatialHints = formData.get('spatialHints') as string | null;
        const numberMappingJson = formData.get('numberMapping') as string | null;
        const originalAnglesJson = formData.get('originalAngles') as string | null;
        const coloredAnglesJson = formData.get('coloredAngles') as string | null;
        // Legacy fallback
        const anglesJson = formData.get('angles') as string | null;

        if (!partsJson) {
            return NextResponse.json({ error: 'Missing parts data' }, { status: 400 });
        }

        const parts: { id: string; color: string }[] = JSON.parse(partsJson);
        const originalAngles: string[] = originalAnglesJson
            ? JSON.parse(originalAnglesJson)
            : (anglesJson ? JSON.parse(anglesJson) : []);
        const coloredAngles: string[] = coloredAnglesJson
            ? JSON.parse(coloredAnglesJson)
            : originalAngles;
        const numberMapping: Record<string, string> | undefined = numberMappingJson
            ? JSON.parse(numberMappingJson)
            : undefined;

        const originalFiles = formData.getAll('original') as File[];
        const coloredFiles = formData.getAll('colored') as File[];

        if (originalFiles.length === 0 && coloredFiles.length === 0) {
            return NextResponse.json({ error: 'No screenshots provided' }, { status: 400 });
        }

        const originalImages = await Promise.all(originalFiles.map(fileToBase64));
        const coloredImages = await Promise.all(coloredFiles.map(fileToBase64));

        // ── Stage 1: Structure Recognition ──────────────────────────────
        console.log(`[smart-organize] Starting Stage 1...`);
        const stage1 = await runStage1(originalImages, originalAngles);

        // ── Stage 2: Naming & Grouping ──────────────────────────────────
        const system = [
            'You are a 3D model part analyst. You receive multi-angle screenshots of a 3D model.',
            'The model has been identified and its structure is provided.',
            'Your task: name each numbered part and group them based on their function.',
            'You MUST return ONLY a valid JSON array. No markdown, no explanation, no extra text.',
        ].join('\n');

        // Build number mapping legend for prompt
        const mappingLegend = numberMapping
            ? Object.entries(numberMapping).map(([num, id]) => `#${num} → "${id}"`).join('\n')
            : parts.map((p, i) => `#${i + 1} → "${p.id}"`).join('\n');

        const regionsText = stage1.regions.length > 0
            ? stage1.regions.join(', ')
            : 'not identified';

        const user = [
            `This 3D model is a "${stage1.object}" with these structural regions: ${regionsText}.`,
            '',
            'Below are multi-angle screenshots:',
            '- ORIGINAL TEXTURE views: understand materials and function',
            '- NUMBERED COLOR-CODED views: each part has a number label on it',
            '',
            'Part mapping (number → ID):',
            mappingLegend,
            '',
            ...(spatialHints ? [
                'Spatial hints (position within model):',
                spatialHints,
                '',
            ] : []),
            'Instructions:',
            '1. Match each numbered part to the structural regions listed above.',
            '2. Name each part based on its real-world function (2-4 words).',
            '3. Group parts using the structural regions as group names.',
            '   You may split or merge regions if the parts don\'t fit well.',
            '4. Return ONLY a JSON array: [{"id":"part_abc", "name":"...", "group":"..."}, ...]',
            '',
            'Rules:',
            '- Use the part ID (not the number) in the "id" field',
            '- Use short, descriptive English names (2-4 words max)',
            '- Same-type parts MUST share a group',
            '- Symmetric parts share a group',
            `- Include ALL ${parts.length} parts — do not skip any`,
            '- Return ONLY the JSON array',
        ].join('\n');

        console.log(`[smart-organize] Starting Stage 2 — ${parts.length} parts, object="${stage1.object}"`);

        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                console.log(`[smart-organize:stage2] attempt ${attempt + 1} — calling VLM...`);
                const raw = isAnthropic()
                    ? await callAnthropic(originalImages, coloredImages, originalAngles, coloredAngles, system, user)
                    : await callOpenAICompat(originalImages, coloredImages, originalAngles, coloredAngles, system, user);

                console.log(`[smart-organize:stage2] attempt ${attempt + 1} — raw response (${raw.length} chars)`);
                const result = extractAndValidate(raw, parts, numberMapping);
                console.log(`[smart-organize] SUCCESS — ${result.length} parts returned`);
                return NextResponse.json({ parts: result });
            } catch (err: any) {
                lastError = err;
                console.warn(`[smart-organize:stage2] attempt ${attempt + 1} failed:`, err.message);
            }
        }

        throw lastError ?? new Error('Smart organize failed after retries');
    } catch (err: any) {
        console.error('[smart-organize]', err);
        return NextResponse.json(
            { error: err.message || 'Smart organize failed' },
            { status: 500 },
        );
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/phidias/smart-organize/route.ts
git commit -m "feat(smart-organize): add Stage 2 prompt with structural context and number-to-ID resolution"
```

---

### Task 5: Update API Client (`phidias.ts`)

**Files:**
- Modify: `src/lib/api/phidias.ts:501-529`

- [ ] **Step 1: Update `smartOrganize` function signature and FormData**

```typescript
export async function smartOrganize(
  parts: SmartOrganizePart[],
  originalFiles: (File | Blob)[],
  coloredFiles: (File | Blob)[],
  angleLabels: string[],
  spatialHints?: string,
  numberMapping?: Record<number, string>,
  originalAngles?: string[],
  coloredAngles?: string[],
  settings?: Record<string, unknown>,
): Promise<SmartOrganizeResponse> {
  const formData = new FormData();
  formData.append('parts', JSON.stringify(parts));
  if (angleLabels && angleLabels.length > 0) {
    formData.append('angles', JSON.stringify(angleLabels));
  }
  if (originalAngles) {
    formData.append('originalAngles', JSON.stringify(originalAngles));
  }
  if (coloredAngles) {
    formData.append('coloredAngles', JSON.stringify(coloredAngles));
  }
  if (spatialHints) {
    formData.append('spatialHints', spatialHints);
  }
  if (numberMapping) {
    formData.append('numberMapping', JSON.stringify(numberMapping));
  }
  originalFiles.forEach((file, idx) => {
    formData.append('original', file, `original_${idx}.png`);
  });
  coloredFiles.forEach((file, idx) => {
    formData.append('colored', file, `colored_${idx}.png`);
  });

  const { data } = await client.post<SmartOrganizeResponse>(
    `${getBackendApi()}/phidias/smart-organize`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    },
  );
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/phidias.ts
git commit -m "feat(smart-organize): add spatial hints and number mapping to API client"
```

---

### Task 6: Update Frontend — `page.tsx` Integration

**Files:**
- Modify: `src/app/workspace/segment/page.tsx`

- [ ] **Step 1: Update imports**

Add new imports from utils (in addition to the ones added in Task 1):

```typescript
import {
  computePartSpatials,
  buildSpatialHintsText,
  projectToScreen,
  resolveOverlaps,
  annotateScreenshot,
  getColoredAngles,
  buildNumberMapping,
  renderFromAngle,
  applySegmentColorMaterials,
  getMeshColors,
  BASE_ANGLES,
  type PartSpatialInfo,
  type PartLike,
} from '@/lib/smart-organize-utils';
```

- [ ] **Step 2: Update `captureMultiViewScreenshots` to accept dynamic angles and annotate**

Replace the existing `captureMultiViewScreenshots` function (which was already simplified in Task 1 after extracting helpers):

```typescript
async function captureMultiViewScreenshots(
  group: THREE.Group,
  parts: PartLike[],
  coloredAngles: [number, number, string][],
  spatials?: PartSpatialInfo[],
): Promise<{ original: Blob[]; colored: Blob[] }> {
  const w = 768, h = 768;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x1a1a2e, 1);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 1.8;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, maxDim * 100);

  const tempScene = new THREE.Scene();
  tempScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(1, 2, 1);
  tempScene.add(dir);

  const savedParent = group.parent;
  tempScene.add(group);

  // 1. Capture original texture from BASE_ANGLES (always 3)
  const original: Blob[] = [];
  for (const [az, el] of BASE_ANGLES) {
    original.push(await renderFromAngle(renderer, tempScene, camera, group, center, dist, az, el));
  }

  // 2. Capture color-coded from dynamic angles + annotate with number labels
  const restoreMaterials = applySegmentColorMaterials(group, parts);
  const colored: Blob[] = [];
  for (const [az, el] of coloredAngles) {
    let blob = await renderFromAngle(renderer, tempScene, camera, group, center, dist, az, el);

    if (spatials && spatials.length > 0) {
      const labels = projectToScreen(spatials, camera, w, h);
      resolveOverlaps(labels, w, h);
      blob = await annotateScreenshot(blob, labels, w, h);
    }

    colored.push(blob);
  }
  restoreMaterials();

  tempScene.remove(group);
  if (savedParent) savedParent.add(group);
  renderer.dispose();

  return { original, colored };
}
```

- [ ] **Step 3: Update `handleSmartOrganize` to use the new pipeline**

Replace the existing `handleSmartOrganize` callback. **IMPORTANT: Preserve the existing rename/group/scene-update logic (current lines 1149-1201) verbatim inside the new try block.**

```typescript
const handleSmartOrganize = useCallback(async () => {
  if (!sceneRef.current || parts.length === 0) return;
  setOrganizeStage('analyzing');
  setSegmentError(null);

  try {
    // 1. Compute spatial info and number mapping
    const spatials = computePartSpatials(sceneRef.current, parts);
    const { mapping: numberMapping, emptyParts } = buildNumberMapping(parts);
    const spatialHintsText = buildSpatialHintsText(spatials, emptyParts);

    // 2. Determine dynamic angles for colored screenshots
    const coloredAngles = getColoredAngles(parts.length);

    // 3. Capture multi-angle screenshots (original + annotated colored)
    const { original, colored } = await captureMultiViewScreenshots(
      sceneRef.current, parts, coloredAngles, spatials,
    );

    setOrganizeStage('organizing');

    // 4. Call VLM API
    const meshColors = getMeshColors(sceneRef.current);
    const response = await smartOrganize(
      meshColors.map(mc => ({ id: mc.id, color: mc.color })),
      original,
      colored,
      BASE_ANGLES.map(([,, label]) => label),
      spatialHintsText,
      numberMapping,
      BASE_ANGLES.map(([,, label]) => label),
      coloredAngles.map(([,, label]) => label),
    );
    const results: SmartOrganizeResult[] = response.parts;

    // ── Below is the EXISTING rename/group/scene logic — preserve verbatim ──

    // 5. Rename parts
    let newParts = parts.map((p) => {
      const match = results.find((r) => r.id === p.id);
      return match ? { ...p, name: match.name } : p;
    });

    // 6. Build groups from VLM suggestions
    const groupMap = new Map<string, string[]>();
    for (const r of results) {
      if (!r.group) continue;
      if (!groupMap.has(r.group)) groupMap.set(r.group, []);
      groupMap.get(r.group)!.push(r.id);
    }

    for (const [groupName, memberIds] of Array.from(groupMap.entries())) {
      if (memberIds.length < 2) continue;
      const groupId = `group_${groupName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      const groupPart: Part = {
        id: groupId,
        name: groupName,
        color: '',
        visible: true,
        meshIds: [],
        isGroup: true,
        childIds: memberIds,
      };
      newParts = newParts.map((p) =>
        memberIds.includes(p.id) ? { ...p, parentId: groupId } : p,
      );
      const firstIdx = newParts.findIndex((p) => memberIds.includes(p.id));
      newParts.splice(firstIdx, 0, groupPart);
    }

    setParts(newParts);

    // 7. Rebuild Three.js groups to match
    if (sceneRef.current) {
      for (const part of newParts) {
        if (!part.isGroup || !part.childIds || part.childIds.length < 2) continue;
        const threeGroup = new THREE.Group();
        threeGroup.name = part.id;
        const childMeshIds = part.childIds.flatMap(
          (cid) => newParts.find((p) => p.id === cid)?.meshIds ?? [],
        );
        const meshObjs = childMeshIds
          .map((mid) => findObjectInScene(sceneRef.current!, mid))
          .filter((o): o is THREE.Object3D => o !== null);
        sceneRef.current.add(threeGroup);
        meshObjs.forEach((obj) => threeGroup.attach(obj));
      }
    }
  } catch (err) {
    setSegmentError(err instanceof Error ? err.message : 'Smart organize failed');
  } finally {
    setOrganizeStage(null);
  }
}, [parts, setParts]);
```

- [ ] **Step 4: Update state variable**

Replace:
```typescript
const [isOrganizing, setIsOrganizing] = useState(false);
```
With:
```typescript
type OrganizeStage = null | 'analyzing' | 'organizing';
const [organizeStage, setOrganizeStage] = useState<OrganizeStage>(null);
```

Update the prop passed to `SegmentAIPanel`:
```typescript
isOrganizing={organizeStage}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/workspace/segment/page.tsx
git commit -m "feat(smart-organize): integrate two-stage pipeline with annotated screenshots"
```

---

### Task 7: Update `SegmentAIPanel` — Stage-Aware UI

**Files:**
- Modify: `src/components/segment/SegmentAIPanel.tsx`

- [ ] **Step 1: Update the `isOrganizing` prop type and button text**

Change the prop type:
```typescript
// Before
isOrganizing?: boolean;

// After
isOrganizing?: null | 'analyzing' | 'organizing';
```

Update the button rendering (around line 424):
```typescript
{isOrganizing ? (
  <span className="flex items-center justify-center gap-2">
    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    {isOrganizing === 'analyzing' ? 'Analyzing structure...' : 'Organizing parts...'}
  </span>
) : (
  'Smart Organize'
)}
```

Update `disabled` and style conditions — replace `isOrganizing` boolean checks with `!!isOrganizing`:
- `disabled={!!isOrganizing}`
- `!!isOrganizing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'`
- Same for the `style` prop `background` and `color` conditionals

- [ ] **Step 2: Commit**

```bash
git add src/components/segment/SegmentAIPanel.tsx
git commit -m "feat(smart-organize): show stage-specific progress text in UI"
```

---

### Task 8: Build Verification

- [ ] **Step 1: Run lint**

```bash
pnpm run lint
```

Fix any lint errors.

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

Fix any type errors or build failures.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(smart-organize): resolve lint and build errors"
```
