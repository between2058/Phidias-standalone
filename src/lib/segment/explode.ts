import * as THREE from 'three';

/** Distance below which a radial vector is treated as degenerate (part at center). */
const EPSILON = 1e-4;
/** Golden angle — deterministic fan-out for parts whose centroid sits at the center. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface PartBounds {
  /** Object name/key as it appears in the scene (meshId or merged_/group_ id). */
  key: string;
  /** World-space centroid of the part (Box3 center). */
  centroid: THREE.Vector3;
}

/**
 * Compute the radial explosion direction+magnitude for each top-level part.
 * radialVec = centroid - modelCenter, where modelCenter is the average of all
 * centroids. Parts coincident with the center get a deterministic index-based
 * fan-out direction scaled to the average radial magnitude so they still separate.
 */
export function computeRadialVectors(parts: PartBounds[]): Map<string, THREE.Vector3> {
  const result = new Map<string, THREE.Vector3>();
  if (parts.length === 0) return result;

  const center = new THREE.Vector3();
  for (const p of parts) center.add(p.centroid);
  center.divideScalar(parts.length);

  let magSum = 0;
  let magCount = 0;
  const raw = parts.map((p) => {
    const vec = p.centroid.clone().sub(center);
    const len = vec.length();
    if (len > EPSILON) {
      magSum += len;
      magCount += 1;
    }
    return { key: p.key, vec, len };
  });
  const avgMag = magCount > 0 ? magSum / magCount : 1;

  raw.forEach((r, i) => {
    if (r.len > EPSILON) {
      result.set(r.key, r.vec);
    } else {
      const a = i * GOLDEN_ANGLE;
      result.set(r.key, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(avgMag));
    }
  });
  return result;
}

/** Final per-part offset = radialVec * amount * progress. Pure; does not mutate input. */
export function explodeOffset(
  radialVec: THREE.Vector3,
  amount: number,
  progress: number,
): THREE.Vector3 {
  return radialVec.clone().multiplyScalar(amount * progress);
}

/** Ease-in-out cubic, input clamped to [0, 1]. */
export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}
