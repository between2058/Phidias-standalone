import * as THREE from 'three';

export type JointType = 'fixed' | 'revolute' | 'prismatic' | 'continuous' | 'planar' | 'floating';

export interface JointSpec {
  name: string;
  type: JointType;
  parent: string;
  child: string;
  axis: THREE.Vector3;
  lower: number;
  upper: number;
  origin: THREE.Matrix4;
}

export interface LinkSpec {
  name: string;
  mesh?: { url: string; scale: THREE.Vector3; color?: THREE.Color };
}

export interface RobotSpec {
  name: string;
  links: LinkSpec[];
  joints: JointSpec[];
}
