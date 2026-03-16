/**
 * Three.js scene utility helpers.
 * Camera manipulation, fitting, joint visualization, and mesh statistics.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';

// ─── Camera Clamping ─────────────────────────────────────────────────────────

/**
 * Apply min/max distance constraints to an OrbitControls instance.
 */
export function clampCamera(
  controls: OrbitControls,
  minDistance: number,
  maxDistance: number,
): void {
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
}

// ─── Fit Camera to Object ────────────────────────────────────────────────────

/**
 * Automatically position the camera so that the entire object is visible.
 * Handles arbitrary geometry by computing its bounding sphere.
 */
export function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
  padding = 1.4,
): void {
  // Compute bounding box of all meshes in the object hierarchy
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = (camera.fov * Math.PI) / 180;
  let cameraDistance = (maxDim / 2 / Math.tan(fovRad / 2)) * padding;

  // Ensure we don't go below near plane
  cameraDistance = Math.max(cameraDistance, camera.near * 2);

  // Position camera above and in front of the object center
  const direction = new THREE.Vector3(0, 0.5, 1).normalize();
  camera.position.copy(center).addScaledVector(direction, cameraDistance);
  camera.near = cameraDistance / 100;
  camera.far = cameraDistance * 100;
  camera.updateProjectionMatrix();

  // Point controls at the object center
  controls.target.copy(center);
  controls.update();
}

// ─── Arrow Helper for Joint Visualization ────────────────────────────────────

/**
 * Create a colored ArrowHelper for visualizing joint axes.
 *
 * @param origin  - Starting position of the arrow
 * @param direction - Unit vector direction (will be normalized internally)
 * @param length  - Length of the arrow shaft
 * @param color   - Hex color string or THREE.ColorRepresentation
 * @param headLength - Optional arrow head length (defaults to 20% of length)
 * @param headWidth  - Optional arrow head width (defaults to 10% of length)
 */
export function createArrowHelper(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  color: THREE.ColorRepresentation,
  headLength?: number,
  headWidth?: number,
): THREE.ArrowHelper {
  const normalizedDir = direction.clone().normalize();
  return new THREE.ArrowHelper(
    normalizedDir,
    origin,
    length,
    color,
    headLength ?? length * 0.2,
    headWidth ?? length * 0.1,
  );
}

// ─── Mesh Statistics ─────────────────────────────────────────────────────────

export interface MeshStats {
  faces: number;
  vertices: number;
  meshCount: number;
}

/**
 * Traverse a Three.js Object3D hierarchy and sum up face and vertex counts.
 * Works for both indexed and non-indexed geometries.
 */
export function getMeshStats(scene: THREE.Object3D): MeshStats {
  let faces = 0;
  let vertices = 0;
  let meshCount = 0;

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry as THREE.BufferGeometry;
    meshCount++;

    // Vertex count
    const positionAttr = geo.attributes.position;
    if (positionAttr) {
      vertices += positionAttr.count;
    }

    // Face count
    if (geo.index) {
      faces += geo.index.count / 3;
    } else if (positionAttr) {
      faces += positionAttr.count / 3;
    }
  });

  return { faces: Math.round(faces), vertices, meshCount };
}

// ─── Format Numbers ───────────────────────────────────────────────────────────

/**
 * Format a large integer with commas for display.
 * e.g. 1935274 → "1,935,274"
 */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

// ─── Bounding Box Center ──────────────────────────────────────────────────────

/**
 * Return the world-space center of an object's bounding box.
 */
export function getBoundingCenter(object: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

// ─── Ground Snap ─────────────────────────────────────────────────────────────

/**
 * Move an object so its lowest point sits on Y=0 (the ground plane).
 */
export function snapToGround(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object);
  const minY = box.min.y;
  object.position.y -= minY;
}
