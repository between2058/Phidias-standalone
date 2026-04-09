'use client';

/**
 * AnchorGizmo — R3F component that shows drei TransformControls (translate
 * mode) around the selected joint's anchor position, allowing the user to
 * drag the anchor to a new location.
 *
 * Only visible when a joint is selected. On drag end the new position is
 * written back to the physics store via `updateJoint`.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import { usePhysicsStore } from '@/store/physics-store';

// ─── Component ─────────────────────────────────────────────────────────────

export default function AnchorGizmo() {
  const joints = usePhysicsStore((s) => s.joints);
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId);
  const updateJoint = usePhysicsStore((s) => s.updateJoint);

  const selectedJoint = selectedJointId
    ? joints.find((j) => j.id === selectedJointId) ?? null
    : null;

  // A tiny invisible mesh as the TransformControls target
  const meshRef = useRef<THREE.Mesh>(null!);
  const controlsRef = useRef<TransformControlsImpl>(null!);

  // Sync mesh position when anchor changes from panel input or store update
  useEffect(() => {
    if (selectedJoint && meshRef.current) {
      const [x, y, z] = selectedJoint.anchor;
      meshRef.current.position.set(x, y, z);
    }
  }, [selectedJoint?.anchor[0], selectedJoint?.anchor[1], selectedJoint?.anchor[2], selectedJoint]);

  // Write new position back to store on drag end
  const handleMouseUp = useCallback(() => {
    if (!selectedJoint || !meshRef.current) return;
    const pos = meshRef.current.position;
    updateJoint(selectedJoint.id, {
      anchor: [pos.x, pos.y, pos.z],
    });
  }, [selectedJoint, updateJoint]);

  if (!selectedJoint) return null;

  return (
    <group name="physics-anchor-gizmo">
      {/* Invisible target mesh */}
      <mesh
        ref={meshRef}
        position={selectedJoint.anchor}
        visible={false}
      >
        <boxGeometry args={[0.001, 0.001, 0.001]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* TransformControls in translate mode */}
      <TransformControls
        ref={controlsRef}
        object={meshRef}
        mode="translate"
        size={0.6}
        onMouseUp={handleMouseUp}
      />
    </group>
  );
}
