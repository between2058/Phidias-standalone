'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { UrdfModel } from './UrdfModel';
import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  recordId: string;
  urdfPath: string;
  pose: Record<string, number>;
  onJointsReady: (joints: JointSpec[]) => void;
}

export function CADViewer({ recordId, urdfPath, pose, onJointsReady }: Props) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [1.5, 1.2, 1.5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment files="/hdri/qwantani_moonrise_puresky_2k.hdr" />
        <OrbitControls makeDefault />
        <UrdfModel
          recordId={recordId}
          urdfPath={urdfPath}
          pose={pose}
          onJointsReady={onJointsReady}
          onError={setErr}
        />
      </Canvas>
      {err && (
        <div className="absolute inset-x-3 top-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}
    </div>
  );
}
