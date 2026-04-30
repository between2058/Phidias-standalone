'use client';

import React, { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';

const ThreeViewport = dynamic(
  () => import('@/components/shared/ThreeViewport'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <div
          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}
        />
      </div>
    ),
  },
);

export interface CanvasNodeData {
  id: string;
  type:
    | '3d-asset'
    | 'scene'
    | 'textured-asset'
    | 'segmented-asset'
    | 'physics-config'
    | 'image'
    | 'data';
  label: string;
  modelUrl?: string;
  imageUrl?: string;
  x: number;
  y: number;
  isSelected?: boolean;
  phase?: 'normal' | 'gathering' | 'merging' | 'revealed';
}

interface CanvasNodeProps {
  node: CanvasNodeData;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  onSelect: (id: string, multiSelect: boolean) => void;
  onAction: (nodeId: string, action: string) => void;
  zoom?: number;
}

const TYPE_COLORS: Record<string, string> = {
  '3d-asset': '#7c3aed',
  scene: '#22c55e',
  'textured-asset': '#f5a623',
  'segmented-asset': '#06b6d4',
  'physics-config': '#ef4444',
  image: '#3b82f6',
  data: '#94a3b8',
};

const TYPE_BADGES: Record<string, string> = {
  '3d-asset': '🧊 3D Asset',
  scene: '🌍 Scene',
  'textured-asset': '🎨 Textured',
  'segmented-asset': '✂️ Segmented',
  'physics-config': '⚙️ Physics',
  image: '🖼 Image',
  data: '📊 Data',
};

export default function CanvasNode({
  node,
  onDragStart,
  onSelect,
  onAction,
}: CanvasNodeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const color = TYPE_COLORS[node.type] ?? '#94a3b8';
  const badge = TYPE_BADGES[node.type] ?? '📦 Node';

  const is3D = [
    '3d-asset',
    'scene',
    'textured-asset',
    'segmented-asset',
    'physics-config',
  ].includes(node.type);
  const isImage = node.type === 'image';

  const phaseStyle: React.CSSProperties = {};
  if (node.phase === 'gathering') {
    phaseStyle.opacity = 0.8;
    phaseStyle.transform = 'scale(0.95)';
    phaseStyle.boxShadow = `0 0 30px ${color}88`;
  } else if (node.phase === 'merging') {
    phaseStyle.opacity = 0.5;
    phaseStyle.transform = 'scale(0.7)';
  } else if (node.phase === 'revealed') {
    phaseStyle.transform = 'scale(1.05)';
    phaseStyle.boxShadow = `0 0 60px ${color}`;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: is3D ? 300 : isImage ? 250 : 280,
        transition:
          'transform 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease',
        ...phaseStyle,
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input, select, canvas'))
          return;
        onDragStart(e, node.id);
        onSelect(node.id, e.shiftKey);
      }}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#1e1e36',
          border: `2px solid ${node.isSelected ? color : '#333355'}`,
          boxShadow: node.isSelected
            ? `0 0 20px ${color}44`
            : '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: `${color}22`,
            borderBottom: `1px solid ${color}44`,
          }}
        >
          <span className="text-[10px] font-bold text-white truncate flex-1">
            {node.label}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${color}33`, color: '#ffffff' }}
          >
            {badge}
          </span>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-[#94a3b8] hover:text-white text-sm px-1"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-36 rounded-xl py-1.5 z-50"
                style={{ background: '#0d0d18', border: '1px solid #333355' }}
              >
                {['Rename', 'Duplicate', 'Delete', 'Export'].map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      onAction(node.id, action);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left text-[#94a3b8] hover:bg-[#252542] hover:text-white transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        {is3D && node.modelUrl && (
          <div style={{ height: 180, background: '#1a1a2e' }}>
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-[#64748b] text-xs">
                  Loading 3D...
                </div>
              }
            >
              <ThreeViewport
                modelUrl={node.modelUrl}
                showGrid={false}
                showAxes={false}
                renderMode="solid"
                className="w-full h-full"
              />
            </Suspense>
          </div>
        )}

        {isImage && node.imageUrl && (
          <div
            style={{ height: 160, overflow: 'hidden', background: '#1a1a2e' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.imageUrl}
              alt={node.label}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {node.type === 'data' && (
          <div className="p-3 space-y-1.5">
            {[
              'Density: 7800 kg/m³',
              'Static Friction: 0.6',
              'Restitution: 0.1',
              'Collider: Convex Mesh',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-[10px] text-[#94a3b8]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between px-3 py-2 border-t"
          style={{ borderColor: '#333355' }}
        >
          {is3D && (
            <div className="flex items-center gap-1">
              {['Segment', 'Texture', 'Export'].map((action) => (
                <button
                  key={action}
                  onClick={() => onAction(node.id, action)}
                  className="px-2 py-1 text-[9px] rounded-md transition-colors"
                  style={{ background: '#252542', color: '#94a3b8' }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = `${color}33`;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = '#252542';
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          {isImage && (
            <button
              onClick={() => onAction(node.id, 'to-3d')}
              className="px-3 py-1 text-[9px] rounded-md font-bold text-[#1a1a2e] transition-opacity hover:opacity-90"
              style={{ background: '#f5a623' }}
            >
              → to 3D
            </button>
          )}
          <span className="text-[9px] text-[#4b5563] ml-auto">just now</span>
        </div>
      </div>
    </div>
  );
}
