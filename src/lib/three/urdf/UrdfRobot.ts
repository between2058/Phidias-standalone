import * as THREE from 'three';
import type { JointSpec, LinkSpec, RobotSpec } from './types';

export class UrdfRobot {
  public readonly root: THREE.Group;
  public readonly joints: JointSpec[];
  public readonly links: LinkSpec[];

  private jointObjects: Map<string, THREE.Object3D>;

  constructor(spec: RobotSpec, root: THREE.Group, jointObjects: Map<string, THREE.Object3D>) {
    this.root = root;
    this.joints = spec.joints;
    this.links = spec.links;
    this.jointObjects = jointObjects;
  }

  setJointAngle(name: string, value: number): void {
    const joint = this.joints.find((j) => j.name === name);
    const obj = this.jointObjects.get(name);
    if (!joint || !obj) return;
    // The joint origin is already applied to the parent joint-frame group in
    // buildSceneGraph; the motion node's local matrix must therefore be ONLY
    // the joint motion (rotation for revolute, translation for prismatic).
    // Applying joint.origin here again would double-shift the child link.
    if (joint.type === 'revolute' || joint.type === 'continuous') {
      obj.matrix.makeRotationAxis(joint.axis, value);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    } else if (joint.type === 'prismatic') {
      const t = new THREE.Vector3().copy(joint.axis).multiplyScalar(value);
      obj.matrix.makeTranslation(t.x, t.y, t.z);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    }
    obj.updateMatrixWorld(true);
  }

  dispose(): void {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const m = child.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      }
    });
  }
}
