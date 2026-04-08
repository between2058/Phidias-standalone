'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import TransformPanel from '@/components/shared/TransformPanel';
import type { TransformValues } from '@/components/shared/TransformPanel';
import type { Part } from '@/app/workspace/segment/page';

interface SegmentHierarchyPanelProps {
  parts: Part[];
  selectedPartId: string | null;
  selectedPartIds: string[];
  onSelectPart: (id: string | null) => void;
  onSelectPartMulti: (id: string) => void;
  onVisibilityToggle: (id: string, visible: boolean) => void;
  onColorChange: (id: string, color: string) => void;
  onRenamePart: (id: string, name: string) => void;
  transform: TransformValues | null;
  onTransformChange: (t: TransformValues) => void;
}

export default function SegmentHierarchyPanel({
  parts,
  selectedPartId,
  selectedPartIds,
  onSelectPart,
  onSelectPartMulti,
  onVisibilityToggle,
  onColorChange,
  onRenamePart,
  transform,
  onTransformChange,
}: SegmentHierarchyPanelProps) {
  const [activeTab, setActiveTab] = useState<'scene' | 'property' | 'history'>(
    'scene',
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
    // Focus input on next tick after render
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      onRenamePart(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    }
    if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowClick = (e: React.MouseEvent, partId: string) => {
    if (e.ctrlKey || e.metaKey) {
      onSelectPartMulti(partId);
    } else {
      onSelectPart(
        partId === selectedPartId && selectedPartIds.length === 1
          ? null
          : partId,
      );
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const isSelected = (id: string) => selectedPartIds.includes(id);

  // Top-level items: groups + ungrouped parts (no parentId)
  const topLevel = parts.filter((p) => !p.parentId);

  const selectedPart = parts.find((p) => p.id === selectedPartId);

  const renderPartRow = (part: Part, depth = 0) => (
    <div
      key={part.id}
      onClick={(e) => {
        if (e.detail === 2) return;
        const isMulti = e.ctrlKey || e.metaKey;
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => {
          if (isMulti) {
            onSelectPartMulti(part.id);
          } else {
            onSelectPart(part.id === selectedPartId && selectedPartIds.length === 1 ? null : part.id);
          }
          clickTimerRef.current = null;
        }, 200);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        startEditing(part.id, part.name);
      }}
      className={cn(
        'group flex items-center gap-2 py-2 cursor-pointer transition-colors select-none',
        depth === 0 ? 'px-3' : 'pr-3',
        isSelected(part.id)
          ? 'bg-[#7c3aed]/20 border-l-2 border-[#7c3aed]'
          : 'hover:bg-[#252542] border-l-2 border-transparent',
      )}
      style={depth > 0 ? { paddingLeft: `${12 + depth * 16}px` } : undefined}
    >
      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: part.color }}
      />
      {/* Name or inline rename input */}
      {editingId === part.id ? (
        <input
          ref={renameInputRef}
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-[#1a1a2e] border border-[#7c3aed] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-xs text-white truncate">{part.name}</span>
      )}
      {/* Mesh count badge for multi-mesh parts */}
      {part.meshIds.length > 1 && editingId !== part.id && (
        <span className="text-[10px] text-[#64748b] bg-[#333355] px-1.5 rounded-full flex-shrink-0">
          {part.meshIds.length}
        </span>
      )}
      {/* Eye toggle */}
      <button
        className="w-6 h-6 flex items-center justify-center text-[#64748b] hover:text-white transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onVisibilityToggle(part.id, !part.visible);
        }}
        title={part.visible ? 'Hide' : 'Show'}
      >
        {part.visible ? '👁' : '🚫'}
      </button>
    </div>
  );

  const renderGroupRow = (group: Part) => {
    const isCollapsed = collapsedGroups.has(group.id);
    const children = parts.filter((p) => p.parentId === group.id);

    return (
      <div key={group.id}>
        {/* Group header */}
        <div
          onClick={(e) => {
            if (e.detail === 2) return;
            const isMulti = e.ctrlKey || e.metaKey;
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
              if (isMulti) {
                onSelectPartMulti(group.id);
              } else {
                onSelectPart(group.id === selectedPartId && selectedPartIds.length === 1 ? null : group.id);
              }
              clickTimerRef.current = null;
            }, 200);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (clickTimerRef.current) {
              clearTimeout(clickTimerRef.current);
              clickTimerRef.current = null;
            }
            startEditing(group.id, group.name);
          }}
          className={cn(
            'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors select-none',
            isSelected(group.id)
              ? 'bg-[#7c3aed]/20 border-l-2 border-[#7c3aed]'
              : 'hover:bg-[#252542] border-l-2 border-transparent',
          )}
        >
          {/* Collapse toggle */}
          <button
            className="w-4 h-4 flex items-center justify-center text-[#64748b] hover:text-white transition-colors flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleGroup(group.id);
            }}
          >
            <span className="text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
          </button>
          {/* Folder icon */}
          <span className="text-[#94a3b8] text-xs flex-shrink-0">📁</span>
          {/* Name or inline rename input */}
          {editingId === group.id ? (
            <input
              ref={renameInputRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-[#1a1a2e] border border-[#7c3aed] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
              autoFocus
            />
          ) : (
            <span className="flex-1 text-xs text-[#94a3b8] truncate font-medium">
              {group.name}
            </span>
          )}
          {/* Child count */}
          {editingId !== group.id && (
            <span className="text-[10px] text-[#64748b] flex-shrink-0">
              {children.length}
            </span>
          )}
          {/* Eye toggle */}
          <button
            className="w-6 h-6 flex items-center justify-center text-[#64748b] hover:text-white transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onVisibilityToggle(group.id, !group.visible);
            }}
          >
            {group.visible ? '👁' : '🚫'}
          </button>
        </div>
        {/* Children */}
        {!isCollapsed && children.map((child) => renderPartRow(child, 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#333355]">
        {(['scene', 'property', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
              activeTab === tab
                ? 'text-white border-b-2 border-[#7c3aed]'
                : 'text-[#64748b] hover:text-[#94a3b8]',
            )}
          >
            {tab === 'scene'
              ? 'Scene Graph'
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {activeTab === 'scene' && (
          <div className="py-1">
            {topLevel.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-[#64748b]">No parts yet</p>
              </div>
            )}
            {topLevel.map((part) =>
              part.isGroup ? renderGroupRow(part) : renderPartRow(part),
            )}
          </div>
        )}

        {activeTab === 'property' && (
          <div className="p-3">
            {selectedPart && !selectedPart.isGroup ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Part Name</p>
                  <p className="text-sm text-white font-medium">
                    {selectedPart.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Meshes</p>
                  <p className="text-xs text-[#64748b]">
                    {selectedPart.meshIds.length} mesh
                    {selectedPart.meshIds.length !== 1 ? 'es' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Part Color</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedPart.color}
                      onChange={(e) =>
                        onColorChange(selectedPart.id, e.target.value)
                      }
                      className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs text-[#94a3b8] font-mono">
                      {selectedPart.color}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Material</p>
                  <select className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
                    <option>Standard</option>
                    <option>Metallic</option>
                    <option>Glass</option>
                    <option>Emissive</option>
                  </select>
                </div>
              </div>
            ) : selectedPartIds.length > 1 ? (
              <div className="text-center py-8">
                <p className="text-xs text-[#94a3b8] font-medium mb-1">
                  {selectedPartIds.length} parts selected
                </p>
                <p className="text-xs text-[#64748b]">
                  Use Merge or Group in the toolbar
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-[#64748b]">
                  Select a part to edit properties
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-3 space-y-2">
            {['Segmented model', 'Loaded model', 'Initialized'].map(
              (action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-1.5 border-b border-[#333355]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span className="text-xs text-[#94a3b8] flex-1">
                    {action}
                  </span>
                  <span className="text-[10px] text-[#64748b]">
                    {i === 0 ? 'Just now' : `${i * 2}m ago`}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Transform Panel - pinned bottom */}
      <div className="border-t border-[#333355]">
        <TransformPanel
          transform={transform ?? undefined}
          onChange={onTransformChange}
        />
      </div>
    </div>
  );
}
