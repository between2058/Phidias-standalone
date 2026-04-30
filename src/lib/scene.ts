/**
 * Scene graph utilities — parse a Three.js scene into HierarchyItem trees,
 * find objects by ID, and convert transforms to/from panel format.
 */

import * as THREE from 'three';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';
import type { TransformValues } from '@/components/shared/TransformPanel';

// ─── Scene graph ─────────────────────────────────────────────────────────────

/** Stable ID for a Three.js object: prefer name (for physics compat), fall back to uuid. */
export function objectId(obj: THREE.Object3D): string {
  return obj.name || obj.uuid;
}

function toHierarchyItem(obj: THREE.Object3D): HierarchyItem | null {
  // Skip internal Three.js scene helpers
  if (obj instanceof THREE.Camera) return null;
  if (obj instanceof THREE.Light) return null;
  // Skip objects starting with __ (internal)
  if (obj.name.startsWith('__')) return null;
  // Skip GridHelper and other internal helpers
  if (obj.type === 'GridHelper' || obj.type === 'AxesHelper' || obj.type === 'ArrowHelper') return null;

  const children = obj.children
    .map(toHierarchyItem)
    .filter((c): c is HierarchyItem => c !== null);

  const type: HierarchyItem['type'] =
    obj instanceof THREE.Mesh ? 'mesh' : 'group';

  return {
    id: objectId(obj),
    name: obj.name || obj.type || 'Node',
    visible: obj.visible,
    type,
    children: children.length > 0 ? children : undefined,
  };
}

/**
 * Parse a THREE.Group (e.g. from onSceneReady) into a HierarchyItem tree.
 * Starts from root.children so the wrapper group itself is excluded.
 */
export function parseSceneGraph(root: THREE.Object3D): HierarchyItem[] {
  return root.children
    .map(toHierarchyItem)
    .filter((c): c is HierarchyItem => c !== null);
}

/**
 * Find a Three.js object in the scene tree by name or uuid.
 */
export function findObjectInScene(
  root: THREE.Object3D,
  id: string,
): THREE.Object3D | null {
  if (objectId(root) === id) return root;
  for (const child of root.children) {
    const found = findObjectInScene(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Immutably update the visible flag of a node in a HierarchyItem tree.
 */
export function updateNodeVisibility(
  nodes: HierarchyItem[],
  id: string,
  visible: boolean,
): HierarchyItem[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, visible };
    if (node.children)
      return {
        ...node,
        children: updateNodeVisibility(node.children, id, visible),
      };
    return node;
  });
}

/**
 * Immutably update the name of a node in a HierarchyItem tree.
 */
export function updateNodeName(
  nodes: HierarchyItem[],
  id: string,
  name: string,
): HierarchyItem[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, name };
    if (node.children)
      return {
        ...node,
        children: updateNodeName(node.children, id, name),
      };
    return node;
  });
}

// ─── Transform conversion ─────────────────────────────────────────────────────

/**
 * Read a Three.js object's transform into the panel's TransformValues format.
 * Rotation is converted from radians → degrees for human-readable display.
 */
export function readTransformValues(obj: THREE.Object3D): TransformValues {
  return {
    position: {
      x: +obj.position.x.toFixed(4),
      y: +obj.position.y.toFixed(4),
      z: +obj.position.z.toFixed(4),
    },
    rotation: {
      x: +THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(2),
      y: +THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(2),
      z: +THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(2),
    },
    scale: {
      x: +obj.scale.x.toFixed(4),
      y: +obj.scale.y.toFixed(4),
      z: +obj.scale.z.toFixed(4),
    },
  };
}

/**
 * Write TransformValues (degrees for rotation) back to a Three.js object.
 */
export function writeTransformValues(
  obj: THREE.Object3D,
  t: TransformValues,
): void {
  obj.position.set(t.position.x, t.position.y, t.position.z);
  obj.rotation.set(
    THREE.MathUtils.degToRad(t.rotation.x),
    THREE.MathUtils.degToRad(t.rotation.y),
    THREE.MathUtils.degToRad(t.rotation.z),
  );
  obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
}

/**
 * Convert ThreeViewport's TransformData (radians, arrays) to TransformValues (degrees, objects).
 */
export function transformDataToValues(data: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}): TransformValues {
  return {
    position: { x: data.position[0], y: data.position[1], z: data.position[2] },
    rotation: {
      x: +THREE.MathUtils.radToDeg(data.rotation[0]).toFixed(2),
      y: +THREE.MathUtils.radToDeg(data.rotation[1]).toFixed(2),
      z: +THREE.MathUtils.radToDeg(data.rotation[2]).toFixed(2),
    },
    scale: { x: data.scale[0], y: data.scale[1], z: data.scale[2] },
  };
}
