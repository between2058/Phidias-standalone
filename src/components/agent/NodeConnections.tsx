'use client';

import React from 'react';
import type { CanvasNodeData } from './CanvasNode';

interface Connection {
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
}

interface NodeConnectionsProps {
  nodes: CanvasNodeData[];
  connections: Connection[];
  pan?: { x: number; y: number };
  zoom?: number;
}

export default function NodeConnections({
  nodes,
  connections,
}: NodeConnectionsProps) {
  const getNodeCenter = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return null;
    const width = ['scene'].includes(node.type) ? 350 : 280;
    return {
      x: node.x + width / 2,
      y: node.y + 120,
    };
  };

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {connections.map((conn, i) => {
        const from = getNodeCenter(conn.fromId);
        const to = getNodeCenter(conn.toId);
        if (!from || !to) return null;

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - 50;
        const color = conn.color ?? '#7c3aed';

        const path = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;

        return (
          <g key={i}>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6,4"
              opacity={0.6}
              strokeLinecap="round"
            />
            {conn.label && (
              <text
                x={midX}
                y={midY - 8}
                textAnchor="middle"
                fill={color}
                fontSize={10}
                opacity={0.8}
              >
                {conn.label}
              </text>
            )}
            {/* Arrow */}
            <circle cx={to.x} cy={to.y} r={4} fill={color} opacity={0.7} />
          </g>
        );
      })}
    </svg>
  );
}
