'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Box,
  Layers,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  FolderPlus,
  Group,
  Ungroup,
} from 'lucide-react';
import type { CADNode, DuplicateGroup } from '@/lib/occt-bridge';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CADHierarchyTreeProps {
  root: CADNode | null;
  duplicates: DuplicateGroup[];
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  highlightedMeshIndices: Set<number>;
  onNodeSelect: (nodeId: string, meshIndices: number[]) => void;
  onNodeMultiSelect?: (nodeId: string) => void;
  onNodeVisibilityToggle: (nodeId: string, visible: boolean) => void;
  onDeleteDuplicates: (group: DuplicateGroup) => void;
  onMoveNode?: (nodeId: string, targetParentId: string | null, insertIndex?: number) => void;
  onContextAction?: (action: 'new-group' | 'group-selected' | 'ungroup' | 'delete', nodeId: string) => void;
  showDuplicatesTab?: boolean;
}

// ─── DnD indicator position ──────────────────────────────────────────────────

type DropPosition = 'before' | 'into' | 'after';

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  hasChildren: boolean;
}

function ContextMenu({
  state,
  hasSelection,
  onAction,
  onClose,
}: {
  state: ContextMenuState;
  hasSelection: boolean;
  onAction: (action: 'new-group' | 'group-selected' | 'ungroup' | 'delete') => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-lg py-1 shadow-2xl"
      style={{
        left: state.x,
        top: state.y,
        background: '#0d0d18',
        border: '1px solid #333355',
      }}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#94a3b8] hover:bg-[#ffffff08] text-left"
        onClick={() => { onAction('new-group'); onClose(); }}
      >
        <FolderPlus size={11} /> New Group
      </button>
      {hasSelection && (
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#94a3b8] hover:bg-[#ffffff08] text-left"
          onClick={() => { onAction('group-selected'); onClose(); }}
        >
          <Group size={11} /> Group Selected
        </button>
      )}
      {state.hasChildren && (
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#94a3b8] hover:bg-[#ffffff08] text-left"
          onClick={() => { onAction('ungroup'); onClose(); }}
        >
          <Ungroup size={11} /> Ungroup
        </button>
      )}
      <div className="my-1 border-t border-[#333355]" />
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#ef4444] hover:bg-[#ef4444]/10 text-left"
        onClick={() => { onAction('delete'); onClose(); }}
      >
        <Trash2 size={11} /> Delete
      </button>
    </div>
  );
}

// ─── Tree Node ───────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  selectedNodeId,
  selectedNodeIds,
  onSelect,
  onMultiSelect,
  hiddenNodes,
  onToggleVisibility,
  onDragStart,
  onDragOver,
  onDrop,
  dropTarget,
  onContextMenu,
}: {
  node: CADNode;
  depth: number;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  onSelect: (nodeId: string, meshIndices: number[]) => void;
  onMultiSelect?: (nodeId: string) => void;
  hiddenNodes: Set<string>;
  onToggleVisibility: (nodeId: string) => void;
  onDragStart: (nodeId: string) => void;
  onDragOver: (nodeId: string, position: DropPosition) => void;
  onDrop: () => void;
  dropTarget: { nodeId: string; position: DropPosition } | null;
  onContextMenu: (e: React.MouseEvent, nodeId: string, hasChildren: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const hasMeshes = node.meshIndices.length > 0;
  const isSelected = selectedNodeId === node.id || selectedNodeIds.has(node.id);
  const isHidden = hiddenNodes.has(node.id);

  const isDropTarget = dropTarget?.nodeId === node.id;
  const dropPosition = isDropTarget ? dropTarget.position : null;

  const collectMeshIndices = useCallback((n: CADNode): number[] => {
    const indices = [...n.meshIndices];
    for (const child of n.children) {
      indices.push(...collectMeshIndices(child));
    }
    return indices;
  }, []);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let position: DropPosition;
    if (y < h * 0.25) position = 'before';
    else if (y > h * 0.75) position = 'after';
    else position = 'into';
    onDragOver(node.id, position);
  }

  function handleClick(e: React.MouseEvent) {
    if ((e.metaKey || e.ctrlKey) && onMultiSelect) {
      onMultiSelect(node.id);
    } else {
      onSelect(node.id, collectMeshIndices(node));
    }
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer group relative
          ${isSelected ? 'bg-[#D5B451]/20 text-white' : 'text-[#94a3b8] hover:bg-[#ffffff08]'}
          ${isHidden ? 'opacity-40' : ''}
        `}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node.id, hasChildren);
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(node.id);
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
      >
        {/* Drop indicators */}
        {dropPosition === 'before' && (
          <div className="absolute top-0 left-2 right-2 h-0.5 bg-[#D5B451] rounded" />
        )}
        {dropPosition === 'into' && (
          <div className="absolute inset-0 border border-[#D5B451] rounded pointer-events-none" />
        )}
        {dropPosition === 'after' && (
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#D5B451] rounded" />
        )}

        {/* Expand/collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(v => !v);
          }}
          className="w-4 h-4 flex items-center justify-center flex-shrink-0"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Icon */}
        {hasChildren ? (
          <Layers size={12} className="flex-shrink-0 text-[#D5B451]" />
        ) : (
          <Box size={12} className="flex-shrink-0 text-[#7c8db5]" />
        )}

        {/* Name */}
        <span className="text-[11px] truncate flex-1">{node.name}</span>

        {/* Mesh count badge */}
        {hasMeshes && (
          <span className="text-[9px] text-[#4b5563] font-mono mr-1">
            {node.meshIndices.length}
          </span>
        )}

        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(node.id);
          }}
          className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              onSelect={onSelect}
              onMultiSelect={onMultiSelect}
              hiddenNodes={hiddenNodes}
              onToggleVisibility={onToggleVisibility}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              dropTarget={dropTarget}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CADHierarchyTree({
  root,
  duplicates,
  selectedNodeId,
  selectedNodeIds,
  highlightedMeshIndices: _highlightedMeshIndices,
  onNodeSelect,
  onNodeMultiSelect,
  onNodeVisibilityToggle,
  onDeleteDuplicates,
  onMoveNode,
  onContextAction,
}: CADHierarchyTreeProps) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'duplicates'>('hierarchy');
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ nodeId: string; position: DropPosition } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const selectedIdsSet = new Set(selectedNodeIds ?? []);

  const handleToggleVisibility = useCallback(
    (nodeId: string) => {
      setHiddenNodes(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
          onNodeVisibilityToggle(nodeId, true);
        } else {
          next.add(nodeId);
          onNodeVisibilityToggle(nodeId, false);
        }
        return next;
      });
    },
    [onNodeVisibilityToggle],
  );

  // DnD handlers
  const handleDragStart = useCallback((nodeId: string) => {
    setDraggedNodeId(nodeId);
  }, []);

  const handleDragOver = useCallback((nodeId: string, position: DropPosition) => {
    setDropTarget({ nodeId, position });
  }, []);

  const handleDrop = useCallback(() => {
    if (draggedNodeId && dropTarget && onMoveNode) {
      const targetParentId = dropTarget.position === 'into' ? dropTarget.nodeId : null;
      onMoveNode(draggedNodeId, targetParentId);
    }
    setDraggedNodeId(null);
    setDropTarget(null);
  }, [draggedNodeId, dropTarget, onMoveNode]);

  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string, hasChildren: boolean) => {
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId, hasChildren });
  }, []);

  const handleContextAction = useCallback((action: 'new-group' | 'group-selected' | 'ungroup' | 'delete') => {
    if (contextMenu && onContextAction) {
      onContextAction(action, contextMenu.nodeId);
    }
  }, [contextMenu, onContextAction]);

  // Count total parts
  const countParts = useCallback((node: CADNode): number => {
    let count = node.meshIndices.length;
    for (const child of node.children) {
      count += countParts(child);
    }
    return count;
  }, []);

  const totalParts = root ? countParts(root) : 0;
  const totalDuplicates = duplicates.reduce((sum, g) => sum + g.count - 1, 0);

  return (
    <div
      className="flex flex-col h-full"
      onDragEnd={() => { setDraggedNodeId(null); setDropTarget(null); }}
    >
      {/* Tabs */}
      <div className="flex border-b border-[#333355]">
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
            activeTab === 'hierarchy'
              ? 'text-white border-b-2 border-[#D5B451]'
              : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
        >
          Hierarchy ({totalParts})
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
            activeTab === 'duplicates'
              ? 'text-white border-b-2 border-[#D5B451]'
              : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
        >
          Duplicates
          {totalDuplicates > 0 && (
            <span className="ml-1 px-1 py-0.5 rounded-full text-[9px] bg-[#f5a623]/20 text-[#f5a623]">
              {totalDuplicates}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {activeTab === 'hierarchy' && root && (
          <TreeNode
            node={root}
            depth={0}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedIdsSet}
            onSelect={onNodeSelect}
            onMultiSelect={onNodeMultiSelect}
            hiddenNodes={hiddenNodes}
            onToggleVisibility={handleToggleVisibility}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            dropTarget={dropTarget}
            onContextMenu={handleContextMenu}
          />
        )}

        {activeTab === 'hierarchy' && !root && (
          <div className="flex flex-col items-center justify-center h-full text-[#4b5563]">
            <Layers size={24} className="mb-2 opacity-30" />
            <p className="text-[10px]">Import a CAD file to see hierarchy</p>
          </div>
        )}

        {activeTab === 'duplicates' && (
          <div className="px-2 py-1 space-y-1">
            {duplicates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#4b5563]">
                <Copy size={24} className="mb-2 opacity-30" />
                <p className="text-[10px]">
                  {root ? 'No duplicate parts detected' : 'Import a file first'}
                </p>
              </div>
            ) : (
              duplicates.map((group) => (
                <div
                  key={group.hash}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-[#13132a] border border-[#333355] group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Copy size={12} className="text-[#f5a623] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#94a3b8] truncate">{group.name}</p>
                      <p className="text-[9px] text-[#4b5563]">
                        {group.count} identical copies
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteDuplicates(group)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[#ef4444] hover:bg-[#ef4444]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove duplicates (keep one)"
                  >
                    <Trash2 size={10} />
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          hasSelection={selectedIdsSet.size > 1}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
