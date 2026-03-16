'use client';

import React, { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import TopNavBar from '@/components/shared/TopNavBar';
import AgentChatPanel from '@/components/agent/AgentChatPanel';
import type { CanvasNodeData } from '@/components/agent/CanvasNode';

const AgentCanvas = dynamic(() => import('@/components/agent/AgentCanvas'), {
  ssr: false,
  loading: () => (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ background: '#12121f' }}
    >
      <div
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}
      />
    </div>
  ),
});

// Column layout positions for auto-placing nodes
const NODE_COLS = 3;
const NODE_GAP_X = 340;
const NODE_GAP_Y = 340;
const NODE_START_X = 80;
const NODE_START_Y = 80;

export default function AgentPage() {
  const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
  const [panToNodeId, setPanToNodeId] = useState<string | null>(null);
  const [chatWidth, setChatWidth] = useState(380);
  const isDraggingDivider = useRef(false);
  const dividerStartX = useRef(0);
  const chatStartWidth = useRef(380);

  const handleNodeCreated = useCallback(
    (nodeData: {
      id: string;
      type: string;
      modelUrl: string;
      label: string;
    }) => {
      setNodes((prev) => {
        const idx = prev.length;
        const col = idx % NODE_COLS;
        const row = Math.floor(idx / NODE_COLS);
        const newNode: CanvasNodeData = {
          id: nodeData.id,
          type: nodeData.type as CanvasNodeData['type'],
          label: nodeData.label,
          modelUrl: nodeData.modelUrl,
          x: NODE_START_X + col * NODE_GAP_X,
          y: NODE_START_Y + row * NODE_GAP_Y,
          phase: 'normal',
        };
        return [...prev, newNode];
      });
      // Pan to the new node after a short delay
      setTimeout(() => setPanToNodeId(nodeData.id), 100);
      setTimeout(() => setPanToNodeId(null), 500);
    },
    [],
  );

  const handlePanToNode = useCallback((nodeId: string) => {
    setPanToNodeId(nodeId);
    setTimeout(() => setPanToNodeId(null), 500);
  }, []);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingDivider.current = true;
      dividerStartX.current = e.clientX;
      chatStartWidth.current = chatWidth;
      e.preventDefault();
    },
    [chatWidth],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingDivider.current) return;
    const dx = dividerStartX.current - e.clientX;
    const newWidth = Math.max(300, Math.min(600, chatStartWidth.current + dx));
    setChatWidth(newWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingDivider.current = false;
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: '#12121f' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* TopNavBar — this page has its own layout (no workspace sidebar) */}
      <TopNavBar />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <AgentCanvas
            nodes={nodes}
            onNodesChange={setNodes}
            panToNodeId={panToNodeId}
          />
        </div>

        {/* Resizable divider */}
        <div
          className="flex-shrink-0 relative group cursor-col-resize"
          style={{ width: 4, background: '#333355' }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[#7c3aed]/30 transition-colors" />
        </div>

        {/* Chat Panel */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: chatWidth }}
        >
          <AgentChatPanel
            onNodeCreated={handleNodeCreated}
            onPanToNode={handlePanToNode}
            width={chatWidth}
          />
        </div>
      </div>
    </div>
  );
}
