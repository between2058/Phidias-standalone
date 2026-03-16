'use client';

/**
 * PhysicsPreview — React component that wraps the SparkScene placeholder
 * for use in the Physics tab and 3D World tab.
 *
 * Renders joint axis arrows and rigid body outlines using Three.js helpers.
 * When the real SparkJS SDK is available, replace the body of `useSparkScene`
 * with real SDK calls — the component API stays the same.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { createArrowHelper } from '../three/helpers';
import {
  SparkScene,
  SparkBody,
  SparkJoint,
  SparkConfig,
  createSparkScene,
  isSparkAvailable,
} from './index';

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseSparkSceneOptions {
  config?: Partial<SparkConfig>;
  autoStep?: boolean; // advance simulation each frame (default true)
}

/**
 * Hook that creates and manages a SparkScene instance.
 * Returns helpers to add/remove bodies and joints, plus the scene itself.
 */
export function useSparkScene(options: UseSparkSceneOptions = {}) {
  const sceneRef = useRef<SparkScene | null>(null);

  if (!sceneRef.current) {
    sceneRef.current = createSparkScene(options.config);
  }

  useFrame(() => {
    if (options.autoStep !== false && sceneRef.current) {
      sceneRef.current.step();
    }
  });

  const addBody = useCallback((body: SparkBody) => {
    sceneRef.current?.addBody(body);
  }, []);

  const removeBody = useCallback((id: string) => {
    sceneRef.current?.removeBody(id);
  }, []);

  const addJoint = useCallback((joint: SparkJoint) => {
    sceneRef.current?.addJoint(joint);
  }, []);

  const removeJoint = useCallback((id: string) => {
    sceneRef.current?.removeJoint(id);
  }, []);

  const getTransform = useCallback(
    (id: string) => sceneRef.current?.getBodyTransform(id),
    [],
  );

  const exportUSD = useCallback(
    () => sceneRef.current?.exportToUSD() ?? '',
    [],
  );

  // Clean up on unmount
  useEffect(() => {
    const scene = sceneRef.current;
    return () => {
      scene?.dispose();
    };
  }, []);

  return {
    sparkScene: sceneRef.current,
    addBody,
    removeBody,
    addJoint,
    removeJoint,
    getTransform,
    exportUSD,
    isRealSDK: isSparkAvailable(),
  };
}

// ─── Joint Visualizer Component ───────────────────────────────────────────────

interface JointVisualizerProps {
  joints: SparkJoint[];
  /** Scale factor for arrow length */
  scale?: number;
}

/**
 * Renders colored ArrowHelper objects for each joint's axis.
 * Useful for debugging joint placement in the 3D viewport.
 */
export function JointVisualizer({ joints, scale = 0.3 }: JointVisualizerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Remove existing arrows
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    joints.forEach((joint) => {
      const origin = new THREE.Vector3(...joint.pivotA);
      const axis = new THREE.Vector3(...(joint.axis ?? [0, 1, 0]));

      // Color by joint type
      const colorMap: Record<SparkJoint['type'], THREE.ColorRepresentation> = {
        revolute: '#f5a623', // gold
        prismatic: '#3b82f6', // blue
        fixed: '#94a3b8', // gray
        spherical: '#22c55e', // green
        '6dof': '#a855f7', // purple
      };

      const arrow = createArrowHelper(
        origin,
        axis,
        scale,
        colorMap[joint.type],
      );
      group.add(arrow);
    });

    return () => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    };
  }, [joints, scale, scene]);

  return <group ref={groupRef} />;
}

// ─── Rigid Body Debug Outline ─────────────────────────────────────────────────

interface RigidBodyOutlineProps {
  bodies: SparkBody[];
  sparkScene: SparkScene;
}

/**
 * Renders wireframe boxes/spheres at each rigid body's position.
 * Updates transform every frame from the SparkScene (placeholder or real SDK).
 */
export function RigidBodyOutlines({
  bodies,
  sparkScene,
}: RigidBodyOutlineProps) {
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    bodies.forEach((body) => {
      const mesh = meshRefs.current.get(body.id);
      if (!mesh) return;
      const transform = sparkScene.getBodyTransform(body.id);
      mesh.position.set(...transform.position);
      mesh.rotation.set(...transform.rotation);
    });
  });

  return (
    <group ref={groupRef}>
      {bodies.map((body) => {
        const isBox = body.shape === 'box';
        const isSphere = body.shape === 'sphere';

        return (
          <mesh
            key={body.id}
            ref={(ref) => {
              if (ref) meshRefs.current.set(body.id, ref);
              else meshRefs.current.delete(body.id);
            }}
            position={body.position}
          >
            {isBox && <boxGeometry args={[0.5, 0.5, 0.5]} />}
            {isSphere && <sphereGeometry args={[0.25, 16, 16]} />}
            {!isBox && !isSphere && (
              <capsuleGeometry args={[0.15, 0.4, 4, 8]} />
            )}
            <meshBasicMaterial
              color="#22c55e"
              wireframe
              transparent
              opacity={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Physics Status Banner ────────────────────────────────────────────────────

interface PhysicsStatusBannerProps {
  className?: string;
}

/**
 * Small status indicator showing whether the real SparkJS SDK is loaded.
 * Shown as an HTML overlay outside the Canvas.
 */
export function PhysicsStatusBanner({
  className = '',
}: PhysicsStatusBannerProps) {
  const available = isSparkAvailable();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono ${className}`}
      style={{
        background: available
          ? 'rgba(34,197,94,0.15)'
          : 'rgba(245,166,35,0.12)',
        border: `1px solid ${available ? '#22c55e' : '#f5a623'}`,
        color: available ? '#22c55e' : '#f5a623',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: available ? '#22c55e' : '#f5a623',
          display: 'inline-block',
        }}
      />
      {available ? 'SparkJS Active' : 'SparkJS Placeholder'}
    </div>
  );
}
