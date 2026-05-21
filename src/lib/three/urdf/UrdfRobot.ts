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
    if (joint.type === 'revolute' || joint.type === 'continuous') {
      obj.matrix.copy(joint.origin);
      obj.matrix.multiply(new THREE.Matrix4().makeRotationAxis(joint.axis, value));
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    } else if (joint.type === 'prismatic') {
      obj.matrix.copy(joint.origin);
      const t = new THREE.Vector3().copy(joint.axis).multiplyScalar(value);
      obj.matrix.multiply(new THREE.Matrix4().makeTranslation(t.x, t.y, t.z));
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
