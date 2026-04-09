'use client';

/**
 * MotionPreviewController — Pure-logic R3F component (renders null) that
 * applies temporary transforms to child-part meshes based on either:
 *   1. Manual preview: `jointPreviewValue` for the selected joint
 *   2. Auto-play: time-based oscillation for ALL joints simultaneously
 */

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsJoint, PhysicsPart } from '@/store/physics-store';

// ─── Reusable math objects (avoid per-frame allocation) ─────────────────────

const _anchorVec = new THREE.Vector3();
const _axisVec = new THREE.Vector3();
const _toOrigin = new THREE.Matrix4();
const _fromOrigin = new THREE.Matrix4();
const _rotMat = new THREE.Matrix4();
const _transMat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _resultMat = new THREE.Matrix4();

const DEG2RAD = Math.PI / 180;

// ─── Helpers ────────────────────────────────────────────────────────────────

function applyJointTransform(
  target: THREE.Object3D,
  original: THREE.Matrix4,
  joint: PhysicsJoint,
  value: number,
) {
  target.matrixAutoUpdate = false;

  if (joint.type === 'Revolute') {
    const angle = value * DEG2RAD;
    _anchorVec.set(...joint.anchor);
    _axisVec.set(...joint.axis).normalize();
    _toOrigin.makeTranslation(-_anchorVec.x, -_anchorVec.y, -_anchorVec.z);
    _quat.setFromAxisAngle(_axisVec, angle);
    _rotMat.makeRotationFromQuaternion(_quat);
    _fromOrigin.makeTranslation(_anchorVec.x, _anchorVec.y, _anchorVec.z);
    _resultMat.copy(_fromOrigin).multiply(_rotMat).multiply(_toOrigin).multiply(original);
    target.matrix.copy(_resultMat);
  } else if (joint.type === 'Prismatic') {
    _axisVec.set(...joint.axis).normalize();
    _transMat.makeTranslation(
      _axisVec.x * value,
      _axisVec.y * value,
      _axisVec.z * value,
    );
    _resultMat.copy(_transMat).multiply(original);
    target.matrix.copy(_resultMat);
  }

  target.matrix.decompose(target.position, target.quaternion, target.scale);
}

function restoreObject(obj: THREE.Object3D, original: THREE.Matrix4) {
  obj.matrix.copy(original);
  obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
  obj.matrixAutoUpdate = true;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MotionPreviewController() {
  const scene = useThree((s) => s.scene);

  const joints = usePhysicsStore((s) => s.joints);
  const parts = usePhysicsStore((s) => s.parts);
  const selectedJointId = usePhysicsStore((s) => s.selectedJointId);
  const jointPreviewValue = usePhysicsStore((s) => s.jointPreviewValue);
  const isAutoPlaying = usePhysicsStore((s) => s.isAutoPlaying);

  // Manual mode: track single mesh
  const meshRef = useRef<THREE.Object3D | null>(null);
  const originalMatrixRef = useRef<THREE.Matrix4 | null>(null);
  const prevJointIdRef = useRef<string | null>(null);

  // Auto-play mode: track all animated meshes
  const autoMeshes = useRef<Map<string, { obj: THREE.Object3D; original: THREE.Matrix4 }>>(new Map());

  // ── Restore helpers ─────────────────────────────────────────────────────

  function restoreManualMesh() {
    if (meshRef.current && originalMatrixRef.current) {
      restoreObject(meshRef.current, originalMatrixRef.current);
    }
    meshRef.current = null;
    originalMatrixRef.current = null;
  }

  function restoreAllAutoMeshes() {
    for (const [, entry] of Array.from(autoMeshes.current.entries())) {
      restoreObject(entry.obj, entry.original);
    }
    autoMeshes.current.clear();
  }

  // ── Handle mode/joint changes ─────────────────────────────────────────

  useEffect(() => {
    if (isAutoPlaying) {
      restoreManualMesh();
    } else {
      restoreAllAutoMeshes();
    }
  }, [isAutoPlaying]);

  useEffect(() => {
    if (!isAutoPlaying && prevJointIdRef.current !== selectedJointId) {
      restoreManualMesh();
      prevJointIdRef.current = selectedJointId;
    }
  }, [selectedJointId, isAutoPlaying]);

  useEffect(() => () => { restoreManualMesh(); restoreAllAutoMeshes(); }, []);

  // ── Frame loop ────────────────────────────────────────────────────────

  useFrame(({ clock }) => {
    if (isAutoPlaying) {
      // ── Auto-play: animate ALL joints simultaneously ──────────────
      const animatableJoints = joints.filter(
        (j) => j.type === 'Revolute' || j.type === 'Prismatic',
      );

      if (animatableJoints.length === 0) {
        if (autoMeshes.current.size > 0) restoreAllAutoMeshes();
        return;
      }

      // Track which meshes are still active this frame
      const activeIds = new Set<string>();

      for (const joint of animatableJoints) {
        const childPart = parts.find((p) => p.id === joint.childPartId);
        if (!childPart) continue;

        const meshName = childPart.id;
        activeIds.add(meshName);

        // Find or cache the mesh
        let entry = autoMeshes.current.get(meshName);
        if (!entry) {
          const obj = scene.getObjectByName(meshName);
          if (!obj) continue;
          entry = { obj, original: obj.matrix.clone() };
          autoMeshes.current.set(meshName, entry);
        }

        // Oscillate: sine wave between limits, each joint offset by index for variety
        const idx = animatableJoints.indexOf(joint);
        const speed = 1.2; // cycles per second (shared base)
        const phase = (idx * Math.PI * 0.5); // stagger joints
        const t = Math.sin(clock.elapsedTime * speed * Math.PI + phase); // -1 to 1

        const lo = joint.limitsEnabled ? joint.limitLower : (joint.type === 'Revolute' ? -45 : -0.1);
        const hi = joint.limitsEnabled ? joint.limitUpper : (joint.type === 'Revolute' ? 45 : 0.1);
        const value = lo + (t + 1) * 0.5 * (hi - lo); // map -1..1 → lo..hi

        applyJointTransform(entry.obj, entry.original, joint, value);
      }

      // Restore meshes that are no longer needed (joint removed etc.)
      for (const [name, entry] of Array.from(autoMeshes.current.entries())) {
        if (!activeIds.has(name)) {
          restoreObject(entry.obj, entry.original);
          autoMeshes.current.delete(name);
        }
      }

      return;
    }

    // ── Manual mode: animate selected joint only ─────────────────────

    const selectedJoint = selectedJointId
      ? joints.find((j) => j.id === selectedJointId) ?? null
      : null;
    const childPart = selectedJoint
      ? parts.find((p) => p.id === selectedJoint.childPartId) ?? null
      : null;

    if (!selectedJoint || !childPart) {
      if (meshRef.current) restoreManualMesh();
      return;
    }

    const meshName = childPart.id;
    let target = meshRef.current;

    if (!target || target.name !== meshName) {
      restoreManualMesh();
      target = scene.getObjectByName(meshName) ?? null;
      if (!target) return;
      meshRef.current = target;
      originalMatrixRef.current = target.matrix.clone();
    }

    const previewVal = jointPreviewValue ?? 0;

    if (previewVal === 0) {
      if (originalMatrixRef.current) {
        restoreObject(target, originalMatrixRef.current);
      }
      return;
    }

    applyJointTransform(target, originalMatrixRef.current!, selectedJoint, previewVal);
  });

  return null;
}
