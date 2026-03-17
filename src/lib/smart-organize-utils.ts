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

// ── Multi-view screenshot capture ───────────────────────────────────────────

/**
 * Capture multi-angle screenshots in both original and colored modes.
 * Originals always use BASE_ANGLES (3); colored uses the provided dynamic angles (3-6).
 * If spatials are provided, colored screenshots are annotated with numbered labels.
 */
export async function captureMultiViewScreenshots(
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
