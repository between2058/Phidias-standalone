'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import CanvasNode from './CanvasNode';
import NodeConnections from './NodeConnections';
import type { CanvasNodeData } from './CanvasNode';

type ToolType = 'select' | 'pan' | 'note';

interface StickyNote {
  id: string;
  x: number;
  y: number;
  content: string;
}

interface AgentCanvasProps {
  nodes: CanvasNodeData[];
  onNodesChange: (nodes: CanvasNodeData[]) => void;
  panToNodeId: string | null;
}

export default function AgentCanvas({
  nodes,
  onNodesChange,
  panToNodeId,
}: AgentCanvasProps) {
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPanning, setIsPanning] = useState(false);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [connections] = useState<
    Array<{ fromId: string; toId: string; label?: string; color?: string }>
  >([]);

  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const dragNodeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan to a specific node
  useEffect(() => {
    if (!panToNodeId) return;
    const node = nodes.find((n) => n.id === panToNodeId);
    if (!node) return;
    const containerW = containerRef.current?.clientWidth ?? 800;
    const containerH = containerRef.current?.clientHeight ?? 600;
    setPan({
      x: containerW / 2 - node.x * zoom - 150,
      y: containerH / 2 - node.y * zoom - 120,
    });
    setSelectedIds(new Set([panToNodeId]));
  }, [panToNodeId, nodes, zoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.3, Math.min(3, prev * delta)));
  }, []);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'pan' || e.button === 1) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panOffsetRef.current = { ...pan };
      }
      if (activeTool === 'select') {
        setSelectedIds(new Set());
      }
      if (activeTool === 'note') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        setStickyNotes((prev) => [
          ...prev,
          { id: `note-${Date.now()}`, x, y, content: '' },
        ]);
      }
    },
    [activeTool, pan, zoom],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({
          x: panOffsetRef.current.x + dx,
          y: panOffsetRef.current.y + dy,
        });
      }
      if (dragNodeRef.current) {
        const { id, startX, startY, nodeX, nodeY } = dragNodeRef.current;
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        onNodesChange(
          nodes.map((n) =>
            n.id === id ? { ...n, x: nodeX + dx, y: nodeY + dy } : n,
          ),
        );
      }
    },
    [isPanning, zoom, nodes, onNodesChange],
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    dragNodeRef.current = null;
  }, []);

  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      dragNodeRef.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        nodeX: node.x,
        nodeY: node.y,
      };
    },
    [nodes],
  );

  const handleNodeSelect = useCallback((id: string, multiSelect: boolean) => {
    setSelectedIds((prev) => {
      if (multiSelect) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const handleFitAll = useCallback(() => {
    if (nodes.length === 0) {
      setPan({ x: 100, y: 80 });
      setZoom(1);
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + 300));
    const maxY = Math.max(...nodes.map((n) => n.y + 300));
    const w = containerRef.current?.clientWidth ?? 800;
    const h = containerRef.current?.clientHeight ?? 600;
    const scaleX = w / (maxX - minX + 100);
    const scaleY = h / (maxY - minY + 100);
    const newZoom = Math.min(scaleX, scaleY, 1);
    setZoom(newZoom);
    setPan({
      x: (w - (maxX - minX) * newZoom) / 2 - minX * newZoom,
      y: (h - (maxY - minY) * newZoom) / 2 - minY * newZoom,
    });
  }, [nodes]);

  const handleAction = useCallback(
    (nodeId: string, action: string) => {
      if (action === 'Delete') {
        onNodesChange(nodes.filter((n) => n.id !== nodeId));
      }
      // Other actions could be implemented
    },
    [nodes, onNodesChange],
  );

  const updatedNodes = nodes.map((n) => ({
    ...n,
    isSelected: selectedIds.has(n.id),
  }));
  const selectedNodes = updatedNodes.filter((n) => n.isSelected);

  return (
    <div className="flex flex-col h-full" style={{ background: '#12121f' }}>
      {/* Canvas Toolbar */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b"
        style={{ background: 'rgba(13,13,24,0.97)', borderColor: '#333355' }}
      >
        {/* Tool buttons */}
        <div className="flex bg-[#252542] rounded-lg p-0.5 gap-0.5">
          {(
            [
              { id: 'select', icon: '↖', label: 'Select' },
              { id: 'pan', icon: '✋', label: 'Pan' },
              { id: 'note', icon: '📝', label: 'Note' },
            ] as { id: ToolType; icon: string; label: string }[]
          ).map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              className={cn(
                'w-7 h-7 rounded-md text-sm transition-colors',
                activeTool === tool.id
                  ? 'bg-[#7c3aed] text-white'
                  : 'text-[#94a3b8] hover:text-white',
              )}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-[#333355]" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
            className="w-6 h-6 rounded flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors text-sm"
          >
            −
          </button>
          <span className="text-xs text-[#94a3b8] w-12 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="w-6 h-6 rounded flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors text-sm"
          >
            +
          </button>
          <button
            onClick={handleFitAll}
            className="px-2 py-1 rounded text-xs text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors"
          >
            Fit All
          </button>
        </div>

        <div className="h-5 w-px bg-[#333355]" />

        <button className="px-2 py-1 rounded text-xs text-[#94a3b8] hover:text-white hover:bg-[#252542] transition-colors">
          Auto Layout
        </button>
        <button
          onClick={() => {
            onNodesChange([]);
            setStickyNotes([]);
          }}
          className="px-2 py-1 rounded text-xs text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
        >
          Clear Canvas
        </button>

        {/* Multi-select action */}
        {selectedNodes.length > 1 && (
          <>
            <div className="h-5 w-px bg-[#333355]" />
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: '#252542', border: '1px solid #333355' }}
            >
              <span className="text-xs text-[#94a3b8]">
                {selectedNodes.length} assets selected
              </span>
              <button
                className="px-3 py-1 rounded-lg text-xs font-bold text-[#1a1a2e] transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #f5a623)',
                }}
              >
                ✨ Create Scene from Selection
              </button>
            </div>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{
          cursor:
            activeTool === 'pan'
              ? isPanning
                ? 'grabbing'
                : 'grab'
              : 'default',
          backgroundImage:
            'radial-gradient(circle, #333355 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        {/* Transformed canvas content */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: 0,
            height: 0,
          }}
        >
          {/* SVG connections */}
          <NodeConnections
            nodes={updatedNodes}
            connections={connections}
            pan={pan}
            zoom={zoom}
          />

          {/* Canvas Nodes */}
          {updatedNodes.map((node) => (
            <CanvasNode
              key={node.id}
              node={node}
              onDragStart={handleNodeDragStart}
              onSelect={handleNodeSelect}
              onAction={handleAction}
              zoom={zoom}
            />
          ))}

          {/* Sticky Notes */}
          {stickyNotes.map((note) => (
            <div
              key={note.id}
              style={{
                position: 'absolute',
                left: note.x,
                top: note.y,
                width: 200,
                background: '#f5c842',
                borderRadius: 8,
                padding: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <textarea
                value={note.content}
                onChange={(e) => {
                  setStickyNotes((prev) =>
                    prev.map((n) =>
                      n.id === note.id ? { ...n, content: e.target.value } : n,
                    ),
                  );
                }}
                placeholder="Type a note..."
                className="w-full bg-transparent text-xs text-[#1a1a2e] placeholder-[#a0820c] resize-none focus:outline-none"
                rows={3}
              />
              <button
                className="mt-1 w-full text-[9px] text-[#1a1a2e]/60 py-0.5 rounded hover:bg-black/10 transition-colors"
                onClick={() => {
                  /* run as prompt */
                }}
              >
                ▶ Run as Prompt
              </button>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-5xl mb-4 opacity-10">🎨</div>
            <p className="text-[#333355] text-sm">
              Start chatting to create canvas nodes
            </p>
          </div>
        )}

        {/* Mini-map */}
        <div
          className="absolute bottom-4 left-4 rounded-xl overflow-hidden"
          style={{
            width: 150,
            height: 100,
            background: 'rgba(13,13,24,0.9)',
            border: '1px solid #333355',
          }}
        >
          <div className="relative w-full h-full">
            {/* Mini nodes */}
            {nodes.map((node) => (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 6,
                  borderRadius: 2,
                  background: TYPE_COLORS[node.type] ?? '#94a3b8',
                  left: `${Math.min(95, (node.x / 3000) * 100)}%`,
                  top: `${Math.min(95, (node.y / 2000) * 100)}%`,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
