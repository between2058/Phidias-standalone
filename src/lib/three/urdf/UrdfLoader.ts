import * as THREE from 'three';
import { MeshResolver } from './MeshResolver';
import { UrdfRobot } from './UrdfRobot';
import { parseUrdf, findRootLink, originToMatrix4 } from './urdf-parser';
import type { UrdfSpec, UrdfJoint, UrdfVisual } from './urdf-parser';
import { buildPrimitiveMesh, loadGeometryObject } from './geometry-loader';
import type { JointSpec, LinkSpec, RobotSpec } from './types';

export interface UrdfLoaderOptions {
  /** Base URL, e.g. /api/library/records/<id> */
  baseUrl: string;
}

/**
 * Convert a parsed UrdfJoint into the framework-agnostic JointSpec used by UrdfRobot.
 */
function toJointSpec(joint: UrdfJoint): JointSpec {
  const axisRaw = joint.axis ?? [0, 0, 1];
  return {
    name: joint.name,
    type: joint.type,
    parent: joint.parent,
    child: joint.child,
    axis: new THREE.Vector3(axisRaw[0], axisRaw[1], axisRaw[2]),
    lower: joint.limit?.lower ?? 0,
    upper: joint.limit?.upper ?? 0,
    origin: originToMatrix4(joint.origin),
  };
}

/**
 * Build a Three.js scene graph from a parsed UrdfSpec.
 * Returns linkNodes (Map<name, Group>), jointMotionNodes (Map<jointName, Object3D>), and the root Group.
 */
function buildSceneGraph(spec: UrdfSpec): {
  root: THREE.Group;
  linkNodes: Map<string, THREE.Group>;
  jointMotionNodes: Map<string, THREE.Object3D>;
} {
  const linkNodes = new Map<string, THREE.Group>();
  const jointMotionNodes = new Map<string, THREE.Object3D>();

  // Create a group for each link
  for (const link of spec.links) {
    const linkGroup = new THREE.Group();
    linkGroup.name = `link:${link.name}`;
    linkNodes.set(link.name, linkGroup);
  }

  // Wire up joint hierarchy: parent link → joint-frame → motion-group → child link
  for (const joint of spec.joints) {
    const parentGroup = linkNodes.get(joint.parent);
    const childGroup = linkNodes.get(joint.child);
    if (!parentGroup || !childGroup) continue;

    const jointFrame = new THREE.Group();
    jointFrame.name = `joint-frame:${joint.name}`;
    if (joint.origin) {
      jointFrame.applyMatrix4(originToMatrix4(joint.origin));
    }

    const motionGroup = new THREE.Group();
    motionGroup.name = `joint-motion:${joint.name}`;

    motionGroup.add(childGroup);
    jointFrame.add(motionGroup);
    parentGroup.add(jointFrame);
    jointMotionNodes.set(joint.name, motionGroup);
  }

  // Find root link and build top-level group
  const rootLinkName = findRootLink(spec);
  const root = new THREE.Group();
  root.name = `robot:${spec.name}`;
  if (rootLinkName) {
    const rootLinkGroup = linkNodes.get(rootLinkName);
    if (rootLinkGroup) {
      root.add(rootLinkGroup);
    }
  }

  return { root, linkNodes, jointMotionNodes };
}

/**
 * Attach visual geometry to each link group.
 * Primitive geometries are built inline; mesh geometries are loaded asynchronously.
 */
async function attachVisuals(
  spec: UrdfSpec,
  linkNodes: Map<string, THREE.Group>,
  resolver: MeshResolver,
  urdfPath: string,
): Promise<void> {
  const pending: Array<Promise<void>> = [];

  for (const link of spec.links) {
    const linkGroup = linkNodes.get(link.name);
    if (!linkGroup) continue;

    for (const visual of link.visuals) {
      if (visual.geometry.type === 'mesh') {
        pending.push(
          loadMeshVisual(visual, linkGroup, resolver, urdfPath),
        );
      } else {
        const mesh = buildPrimitiveMesh(visual.geometry, visual.material);
        if (mesh) {
          if (visual.origin) {
            mesh.applyMatrix4(originToMatrix4(visual.origin));
          }
          mesh.name = visual.name ?? `visual:${link.name}`;
          linkGroup.add(mesh);
        }
      }
    }
  }

  // Load all meshes concurrently; failures are swallowed per-mesh so partial loads succeed.
  await Promise.allSettled(pending);
}

async function loadMeshVisual(
  visual: UrdfVisual,
  linkGroup: THREE.Group,
  resolver: MeshResolver,
  urdfPath: string,
): Promise<void> {
  const meshGroup = await loadGeometryObject(visual.geometry, resolver, urdfPath, visual.material);
  if (visual.origin) {
    meshGroup.applyMatrix4(originToMatrix4(visual.origin));
  }
  meshGroup.name = visual.name ?? `mesh-visual`;
  linkGroup.add(meshGroup);
}

export class UrdfLoader {
  private resolver: MeshResolver;

  constructor(opts: UrdfLoaderOptions) {
    this.resolver = new MeshResolver({ baseUrl: opts.baseUrl });
  }

  async load(urdfPath: string): Promise<UrdfRobot> {
    const urdfUrl = this.resolver.resolve(urdfPath);
    const response = await fetch(urdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch URDF: ${response.status} ${response.statusText}`);
    }
    const xmlText = await response.text();

    const spec = parseUrdf(xmlText);

    const { root: linkRoot, linkNodes, jointMotionNodes } = buildSceneGraph(spec);

    await attachVisuals(spec, linkNodes, this.resolver, urdfPath);

    // URDF is Z-up by robotics convention; THREE is Y-up. Wrap the link tree
    // in a rotated group and ground-normalize so models land upright on
    // OrbitControls' default ground plane (matches Articraft's viewer).
    const root = new THREE.Group();
    root.name = `robot:${spec.name}`;
    root.rotation.x = -Math.PI / 2;
    root.add(linkRoot);
    normalizeToGroundOrigin(root);

    // Build RobotSpec (framework-agnostic)
    const robotSpec: RobotSpec = {
      name: spec.name,
      links: spec.links.map((l): LinkSpec => ({ name: l.name })),
      joints: spec.joints.map(toJointSpec),
    };

    return new UrdfRobot(robotSpec, root, jointMotionNodes);
  }
}

function normalizeToGroundOrigin(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (!isFinite(box.min.x)) return;
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.y -= box.min.y;
  group.position.z -= center.z;
  group.updateMatrixWorld(true);
}
