'use client';

/**
 * JointVisualizer — R3F component that renders 3D markers (anchor spheres,
 * axis arrows, and arrow-tip cones) for every joint in the physics store.
 *
 * Rendered as a child of <ThreeViewport> inside the Physics page.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsJoint } from '@/store/physics-store';

// ─── Constants ─────────────────────────────────────────────────────────────

const ANCHOR_RADIUS = 0.02;
const AXIS_LENGTH = 0.15;
const CONE_RADIUS = 0.008;
const CONE_HEIGHT = 0.025;
const SELECTED_OPACITY = 1;
const UNSELECTED_OPACITY = 0.4;
const CONE_SEGMENTS = 8;

/** Map dominant axis component to a color: X=red, Y=green, Z=blue. */
function axisColor(axis: [number, number, number]): string {
  const abs = [Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2])];
  const maxIdx = abs.indexOf(Math.max(...abs));
  if (maxIdx === 0) return '#ef4444'; // red  — X
  if (maxIdx === 1) return '#22c55e'; // green — Y
  return '#3b82f6';                    // blue  — Z
}

// ─── Single joint marker ───────────────────────────────────────────────────

interface JointMarkerProps {
  joint: PhysicsJoint;
  isSelected: boolean;
}

function JointMarker({ joint, isSelected }: JointMarkerProps) {
  const opacity = isSelected ? SELECTED_OPACITY : UNSELECTED_OPACITY;
  const color = axisColor(joint.axis);

  const anchor = useMemo(
    () => new THREE.Vector3(...joint.anchor),
    [joint.anchor],
  );

  const tip = useMemo(() => {
    const dir = new THREE.Vector3(...joint.axis).normalize();
    return anchor.clone().add(dir.multiplyScalar(AXIS_LENGTH));
  }, [joint.axis, anchor]);

  // Quaternion to rotate the default up-cone (Y-up) so it points along `axis`
  const coneQuaternion = useMemo(() => {
    const dir = new THREE.Vector3(...joint.axis).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [joint.axis]);

  // Position the cone so its base sits at the tip of the axis line
  const conePosition = useMemo(() => {
    const dir = new THREE.Vector3(...joint.axis).normalize();
    return tip.clone().add(dir.multiplyScalar(CONE_HEIGHT * 0.5));
  }, [joint.axis, tip]);

  const linePoints = useMemo(
    () => [anchor, tip] as [THREE.Vector3, THREE.Vector3],
    [anchor, tip],
  );

  return (
    <group>
      {/* Anchor sphere */}
      <mesh position={anchor} renderOrder={999}>
        <sphereGeometry args={[ANCHOR_RADIUS, 16, 16]} />
        <meshBasicMaterial
          color="#facc15"
          transparent
          opacity={opacity}
          depthTest={false}
        />
      </mesh>

      {/* Axis line */}
      <Line
        points={linePoints}
        color={color}
        lineWidth={2}
        transparent
        opacity={opacity}
        depthTest={false}
      />

      {/* Arrow tip cone */}
      <mesh
        position={conePosition}
        quaternion={coneQuaternion}
        renderOrder={999}
      >
        <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, CONE_SEGMENTS]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}

// ─── Main visualizer ───────────────────────────────────────────────────────

export default function JointVisualizer() {
  const joints = usePhysicsStore((s) => s.joints);
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId);

  if (joints.length === 0) return null;

  return (
    <group name="physics-joint-visualizer">
      {joints.map((joint) => (
        <JointMarker
          key={joint.id}
          joint={joint}
          isSelected={joint.id === selectedJointId}
        />
      ))}
    </group>
  );
}
