'use client';

/**
 * MotionPreviewController — Pure-logic R3F component (renders null) that
 * applies temporary transforms to child-part meshes based on
 * `jointPreviewValue` from the physics store.
 *
 * Transform math:
 *   Revolute  — translate to anchor origin, rotate around axis, translate back,
 *               then multiply with original matrix.
 *   Prismatic — translate along axis by distance, multiply with original matrix.
 *
 * Restores the original matrix when the preview value resets to 0 or when
 * the component unmounts / the selected joint changes.
 */

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { usePhysicsStore } from '@/store/physics-store';

// ─── Helpers ───────────────────────────────────────────────────────────────

const _anchorVec = new THREE.Vector3();
const _axisVec = new THREE.Vector3();
const _toOrigin = new THREE.Matrix4();
const _fromOrigin = new THREE.Matrix4();
const _rotMat = new THREE.Matrix4();
const _transMat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _resultMat = new THREE.Matrix4();

const DEG2RAD = Math.PI / 180;

// ─── Component ─────────────────────────────────────────────────────────────

export default function MotionPreviewController() {
  const scene = useThree((s) => s.scene);

  const joints = usePhysicsStore((s) => s.joints);
  const parts = usePhysicsStore((s) => s.parts);
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId);
  const jointPreviewValue = usePhysicsStore((s) => s.jointPreviewValue);

  // Track the mesh we are currently manipulating so we can restore it
  const meshRef = useRef<THREE.Object3D | null>(null);
  const originalMatrixRef = useRef<THREE.Matrix4 | null>(null);
  const prevJointIdRef = useRef<string | null>(null);

  // Find the selected joint and its child part
  const selectedJoint = selectedJointId
    ? joints.find((j) => j.id === selectedJointId) ?? null
    : null;

  const childPart = selectedJoint
    ? parts.find((p) => p.id === selectedJoint.childPartId) ?? null
    : null;

  // ── Restore helper ─────────────────────────────────────────────────────
  function restoreMesh() {
    if (meshRef.current && originalMatrixRef.current) {
      meshRef.current.matrix.copy(originalMatrixRef.current);
      meshRef.current.matrix.decompose(
        meshRef.current.position,
        meshRef.current.quaternion,
        meshRef.current.scale,
      );
      meshRef.current.matrixAutoUpdate = true;
    }
    meshRef.current = null;
    originalMatrixRef.current = null;
  }

  // ── Handle joint change — restore previous mesh ────────────────────────
  useEffect(() => {
    if (prevJointIdRef.current !== selectedJointId) {
      restoreMesh();
      prevJointIdRef.current = selectedJointId;
    }
  }, [selectedJointId]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      restoreMesh();
    };
  }, []);

  // ── Frame loop — apply preview transforms ──────────────────────────────
  useFrame(() => {
    // If no joint or no child part, restore and bail
    if (!selectedJoint || !childPart) {
      if (meshRef.current) restoreMesh();
      return;
    }

    // Find the child mesh in the scene by name
    const meshName = childPart.name;
    let target = meshRef.current;

    if (!target || target.name !== meshName) {
      // Restore previous mesh before switching
      restoreMesh();
      target = scene.getObjectByName(meshName) ?? null;
      if (!target) return;
      // Store original matrix
      meshRef.current = target;
      originalMatrixRef.current = target.matrix.clone();
    }

    const previewVal = jointPreviewValue ?? 0;

    // If preview value is 0, restore to original
    if (previewVal === 0) {
      if (originalMatrixRef.current) {
        target.matrix.copy(originalMatrixRef.current);
        target.matrix.decompose(
          target.position,
          target.quaternion,
          target.scale,
        );
        target.matrixAutoUpdate = true;
      }
      return;
    }

    // Disable auto-update while we manually set the matrix
    target.matrixAutoUpdate = false;

    const original = originalMatrixRef.current!;

    if (selectedJoint.type === 'Revolute') {
      // Revolute: rotate around anchor + axis by angle (degrees -> radians)
      const angle = previewVal * DEG2RAD;
      _anchorVec.set(...selectedJoint.anchor);
      _axisVec.set(...selectedJoint.axis).normalize();

      // Translate to anchor origin
      _toOrigin.makeTranslation(-_anchorVec.x, -_anchorVec.y, -_anchorVec.z);
      // Rotate around axis
      _quat.setFromAxisAngle(_axisVec, angle);
      _rotMat.makeRotationFromQuaternion(_quat);
      // Translate back
      _fromOrigin.makeTranslation(_anchorVec.x, _anchorVec.y, _anchorVec.z);

      // result = fromOrigin * rotation * toOrigin * original
      _resultMat
        .copy(_fromOrigin)
        .multiply(_rotMat)
        .multiply(_toOrigin)
        .multiply(original);

      target.matrix.copy(_resultMat);
    } else if (selectedJoint.type === 'Prismatic') {
      // Prismatic: translate along axis by distance
      _axisVec.set(...selectedJoint.axis).normalize();
      const dx = _axisVec.x * previewVal;
      const dy = _axisVec.y * previewVal;
      const dz = _axisVec.z * previewVal;

      _transMat.makeTranslation(dx, dy, dz);

      // result = translation * original
      _resultMat.copy(_transMat).multiply(original);

      target.matrix.copy(_resultMat);
    }

    // Decompose for Three.js internal state consistency
    target.matrix.decompose(target.position, target.quaternion, target.scale);
  });

  // Renders nothing — pure logic component
  return null;
}
