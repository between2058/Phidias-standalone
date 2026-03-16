'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 2500;
const SPHERE_RADIUS = 1.2;

/**
 * SciFiLoader — animated particle sphere rendered inside the 3D Canvas.
 * Shows during AI generation to indicate processing.
 * Colors: cyan #00f3ff, purple #bd00ff, white sparkles, gold #ffd700
 */
export default function SciFiLoader() {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const scaleVal = useRef(1);
  const scaleDir = useRef(1);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    const palettes = [
      new THREE.Color('#00f3ff'), // cyan
      new THREE.Color('#bd00ff'), // purple
      new THREE.Color('#ffffff'), // white
      new THREE.Color('#ffd700'), // gold
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = SPHERE_RADIUS * (0.8 + Math.random() * 0.2);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = palettes[Math.floor(Math.random() * palettes.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, colors };
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.6;
      groupRef.current.rotation.x += delta * 0.15;
    }
    scaleVal.current += scaleDir.current * delta * 0.3;
    if (scaleVal.current > 1.08) scaleDir.current = -1;
    if (scaleVal.current < 0.92) scaleDir.current = 1;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleVal.current);
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * 1.5;
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 1.1;
    if (ring3Ref.current) ring3Ref.current.rotation.y += delta * 0.8;
  });

  return (
    <group ref={groupRef}>
      {/* Particle sphere */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.022}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Ring 1: XZ plane */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[SPHERE_RADIUS * 0.7, 0.012, 8, 64]} />
        <meshBasicMaterial
          color="#00f3ff"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ring 2: tilted */}
      <mesh ref={ring2Ref} rotation={[0, 0, Math.PI / 3]}>
        <torusGeometry args={[SPHERE_RADIUS * 0.85, 0.01, 8, 64]} />
        <meshBasicMaterial
          color="#bd00ff"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ring 3: outer gold */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[SPHERE_RADIUS, 0.008, 8, 64]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Central glow */}
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
