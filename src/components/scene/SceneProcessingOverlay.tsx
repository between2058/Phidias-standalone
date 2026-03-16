'use client';

import React from 'react';

interface Stage {
  label: string;
  done: boolean;
  active: boolean;
}

interface SceneProcessingOverlayProps {
  stages: Stage[];
  currentStage: string;
}

export default function SceneProcessingOverlay({
  stages,
  currentStage,
}: SceneProcessingOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20"
      style={{ background: 'rgba(13,13,24,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-8 w-80 space-y-4"
        style={{ background: '#1e1e36', border: '1px solid #333355' }}
      >
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🏗</div>
          <h3 className="text-white font-semibold">Processing Scene</h3>
          <p className="text-[#94a3b8] text-xs mt-1">{currentStage}</p>
        </div>

        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                style={{
                  background: stage.done
                    ? '#22c55e'
                    : stage.active
                      ? '#7c3aed'
                      : '#252542',
                  border: stage.active
                    ? '2px solid #7c3aed'
                    : '2px solid #333355',
                }}
              >
                {stage.done ? (
                  '✓'
                ) : stage.active ? (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-xs"
                style={{
                  color: stage.done
                    ? '#22c55e'
                    : stage.active
                      ? '#ffffff'
                      : '#64748b',
                }}
              >
                {stage.label}
                {stage.active && (
                  <span className="ml-1 animate-pulse">...</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
