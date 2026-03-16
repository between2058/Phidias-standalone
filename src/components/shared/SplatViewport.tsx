'use client';

import React from 'react';
import { Application, Entity } from '@playcanvas/react';
import { Camera, GSplat, Script } from '@playcanvas/react/components';
import { useSplat } from '@playcanvas/react/hooks';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

// ─── Inner scene — must be rendered inside <Application> ─────────────────────

interface SplatSceneProps {
  url: string;
}

function SplatScene({ url }: SplatSceneProps) {
  const { asset, loading, error } = useSplat(url);

  if (loading || !asset) return null;
  if (error) {
    console.error('[SplatViewport] Failed to load splat:', error);
    return null;
  }

  // COLMAP-based 3DGS: X-right, Y-down, Z-forward.
  // PlayCanvas:        X-right, Y-up,   Z-backward.
  // Rotating 180° around X negates Y and Z → fixes up-down without mirroring X.
  return (
    <Entity name="splat" rotation={[180, 0, 0]}>
      <GSplat asset={asset} />
    </Entity>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface SplatViewportProps {
  /** URL to the Gaussian Splat file (.ply, .spz, .splat, .ksplat) */
  url: string;
  className?: string;
}

export default function SplatViewport({ url, className }: SplatViewportProps) {
  return (
    <Application
      className={className}
      graphicsDeviceOptions={{ antialias: false }}
      style={{ width: '100%', height: '100%' }}
    >
      {/*
        CameraControls (PlayCanvas built-in) supports both modes automatically:
        - Left-drag / scroll  → orbit
        - WASD / right-drag   → fly (camera moves through the scene)
        - Shift = fast, Ctrl = slow
      */}
      <Entity name="camera" position={[0, 0, 3]}>
        <Camera />
        <Script script={CameraControls} />
      </Entity>

      <SplatScene url={url} />
    </Application>
  );
}
