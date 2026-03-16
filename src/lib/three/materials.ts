/**
 * Three.js material factory utilities.
 * Matcap, wireframe, segmentation color palettes.
 */

import * as THREE from 'three';

// ─── Matcap Material ──────────────────────────────────────────────────────────

/**
 * Create a MeshMatcapMaterial.
 * Optionally accepts a matcap texture URL; otherwise uses a procedurally
 * generated gradient that approximates a plastic look.
 */
export function createMatcapMaterial(
  matcapTextureUrl?: string,
): THREE.MeshMatcapMaterial {
  if (matcapTextureUrl) {
    const texture = new THREE.TextureLoader().load(matcapTextureUrl);
    return new THREE.MeshMatcapMaterial({ matcap: texture });
  }

  // Procedural fallback: generate a 64×64 radial gradient canvas texture
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size * 0.35,
      size * 0.35,
      0,
      size * 0.5,
      size * 0.5,
      size * 0.5,
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.4, '#888888');
    gradient.addColorStop(1, '#222222');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.MeshMatcapMaterial({ matcap: texture });
}

// ─── Wireframe Overlay Material ───────────────────────────────────────────────

/**
 * Create a MeshBasicMaterial configured for wireframe rendering.
 * If a baseColor is supplied, use it; otherwise default to a subtle
 * blue-grey that reads well over the dark Phidias background.
 */
export function createWireframeMaterial(
  baseColor: THREE.ColorRepresentation = '#4a90d9',
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: baseColor,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  });
}

/**
 * Create a wireframe overlay that sits on top of an existing solid mesh.
 * Returns a LineSegments object that should be added as a child of the mesh.
 */
export function createWireframeOverlay(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation = '#333366',
): THREE.LineSegments {
  const wireGeo = new THREE.WireframeGeometry(geometry);
  const wireMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    depthTest: true,
  });
  return new THREE.LineSegments(wireGeo, wireMat);
}

// ─── Segmentation Color Palette ───────────────────────────────────────────────

/**
 * Phidias brand-aligned segmentation palette — 16 visually distinct colors.
 * Used to color-code individual mesh parts in the Segment tab.
 */
const SEGMENT_PALETTE: string[] = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#ef4444', // red
  '#f97316', // orange
  '#ec4899', // pink
  '#22c55e', // green
  '#a855f7', // purple
  '#eab308', // yellow
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#84cc16', // lime
  '#06b6d4', // cyan (repeat cycle)
  '#fb923c', // amber-orange
  '#60a5fa', // light blue
  '#4ade80', // light green
];

/**
 * Return an array of `count` MeshStandardMaterials, each with a distinct
 * color drawn from the Phidias segment palette.
 */
export function createSegmentMaterials(
  count: number,
): THREE.MeshStandardMaterial[] {
  return Array.from({ length: count }, (_, i) => {
    const color = SEGMENT_PALETTE[i % SEGMENT_PALETTE.length];
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.1,
      // Slightly emissive so parts pop against the dark bg
      emissive: color,
      emissiveIntensity: 0.05,
    });
  });
}

/**
 * Return a single MeshStandardMaterial for a segmented part, with an
 * optional selection highlight (brighter emissive).
 */
export function createSegmentMaterial(
  color: string,
  selected = false,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    emissive: selected ? color : '#000000',
    emissiveIntensity: selected ? 0.3 : 0,
  });
}

// ─── PBR Preview Material ─────────────────────────────────────────────────────

/**
 * Standard PBR material used for the Texture tab preview.
 */
export function createPBRMaterial(options?: {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: options?.color ?? '#cccccc',
    roughness: options?.roughness ?? 0.5,
    metalness: options?.metalness ?? 0.0,
    map: options?.map,
    normalMap: options?.normalMap,
    roughnessMap: options?.roughnessMap,
  });
}

// ─── Physics Debug Material ───────────────────────────────────────────────────

/**
 * Semi-transparent material for collision mesh overlay in Physics tab.
 */
export function createColliderMaterial(
  color: THREE.ColorRepresentation = '#22c55e',
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
