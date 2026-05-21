'use client';

import { useEffect, useState, useRef } from 'react';
import { UrdfLoader } from '@/lib/three/urdf/UrdfLoader';
import { UrdfRobot } from '@/lib/three/urdf/UrdfRobot';
import type { JointSpec } from '@/lib/three/urdf/types';

interface Props {
  recordId: string;
  urdfPath: string;
  pose: Record<string, number>;
  onJointsReady?: (joints: JointSpec[]) => void;
  onError?: (msg: string) => void;
}

export function UrdfModel({ recordId, urdfPath, pose, onJointsReady, onError }: Props) {
  const [robot, setRobot] = useState<UrdfRobot | null>(null);
  const robotRef = useRef<UrdfRobot | null>(null);

  useEffect(() => {
    let cancelled = false;
    new UrdfLoader({ baseUrl: `/api/library/records/${recordId}` })
      .load(urdfPath)
      .then((r) => {
        if (cancelled) { r.dispose(); return; }
        setRobot(r);
        robotRef.current = r;
        onJointsReady?.(r.joints);
      })
      .catch((e) => { if (!cancelled) onError?.(e.message ?? String(e)); });
    return () => {
      cancelled = true;
      robotRef.current?.dispose();
      robotRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, urdfPath]);

  useEffect(() => {
    if (!robot) return;
    for (const [name, angle] of Object.entries(pose)) {
      robot.setJointAngle(name, angle);
    }
  }, [robot, pose]);

  return robot ? <primitive object={robot.root} /> : null;
}
