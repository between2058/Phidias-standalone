'use client';

import { useState, useRef, useEffect } from 'react';
import { Boxes, Eye, EyeOff, MoreHorizontal, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HierarchyItem {
  id: string;
  name: string;
  visible: boolean;
  children?: HierarchyItem[];
  type?: 'mesh' | 'group' | 'light' | 'camera';
}

interface HierarchyPanelProps {
  items: HierarchyItem[];
  selectedId?: string;
  selectedIds?: string[]; // Added for multi-selection
  onSelect?: (id: string) => void;
  /** Called on Ctrl/Cmd+click — parent handles toggle logic */
  onMultiSelect?: (id: string) => void;
  onVisibilityToggle?: (id: string, visible: boolean) => void;
  onRename?: (id: string, name: string) => void;
  onMenuOpen?: (id: string) => void;
  className?: string;
}

interface HierarchyRowProps {
  item: HierarchyItem;
  depth: number;
  selectedId?: string;
  selectedIds?: string[]; // Added for multi-selection
  onSelect?: (id: string) => void;
  onMultiSelect?: (id: string) => void;
  onVisibilityToggle?: (id: string, visible: boolean) => void;
  onRename?: (id: string, name: string) => void;
  onMenuOpen?: (id: string) => void;
  editingId: string | null;
  onStartEditing: (id: string, name: string) => void;
  onCommitRename: () => void;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onCancelEditing: () => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
}

function HierarchyRow({
  item,
  depth,
  selectedId,
  selectedIds,
  onSelect,
  onMultiSelect,
  onVisibilityToggle,
  onRename,
  onMenuOpen,
  editingId,
  onStartEditing,
  onCommitRename,
  editingName,
  onEditingNameChange,
  onCancelEditing,
  renameInputRef,
}: HierarchyRowProps) {
  const [expanded, setExpanded] = useState(true);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelected = selectedIds
    ? selectedIds.includes(item.id)
    : selectedId === item.id;
  const hasChildren = item.children && item.children.length > 0;
  const isEditing = editingId === item.id;

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors rounded-md mx-1',
          isEditing ? 'select-text' : 'select-none',
          isSelected
            ? 'bg-accent-purple/20 text-text-primary'
            : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={(e) => {
          if (e.detail === 2) return;
          if (onRename) {
            const isMulti = e.ctrlKey || e.metaKey;
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
              if (isMulti && onMultiSelect) {
                onMultiSelect(item.id);
              } else {
                onSelect?.(item.id);
              }
              clickTimerRef.current = null;
            }, 200);
          } else {
            if ((e.ctrlKey || e.metaKey) && onMultiSelect) {
              onMultiSelect(item.id);
            } else {
              onSelect?.(item.id);
            }
          }
        }}
        onDoubleClick={onRename ? (e) => {
          e.stopPropagation();
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
          }
          onStartEditing(item.id, item.name);
        } : undefined}
      >
        {/* Expand/Collapse */}
        <button
          className={cn(
            'transition-transform shrink-0',
            hasChildren ? 'opacity-100' : 'opacity-0 pointer-events-none',
            expanded ? 'rotate-90' : '',
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight size={12} className="text-text-tertiary" />
        </button>

        {/* Mesh Icon */}
        <Boxes
          size={14}
          className={cn(
            'shrink-0 transition-colors',
            isSelected ? 'text-accent-purple-light' : 'text-text-tertiary',
          )}
        />

        {/* Name */}
        {isEditing ? (
          <input
            ref={renameInputRef}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); }
              if (e.key === 'Escape') onCancelEditing();
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-[#1a1a2e] border border-[#7c3aed] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            autoFocus
          />
        ) : (
          <span className="flex-1 text-xs truncate min-w-0">{item.name}</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onVisibilityToggle?.(item.id, !item.visible);
            }}
          >
            {item.visible ? (
              <Eye size={12} className="text-text-tertiary" />
            ) : (
              <EyeOff size={12} className="text-text-muted" />
            )}
          </button>
          <button
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMenuOpen?.(item.id);
            }}
          >
            <MoreHorizontal size={12} className="text-text-tertiary" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <HierarchyRow
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onMultiSelect={onMultiSelect}
              onVisibilityToggle={onVisibilityToggle}
              onRename={onRename}
              onMenuOpen={onMenuOpen}
              editingId={editingId}
              onStartEditing={onStartEditing}
              onCommitRename={onCommitRename}
              editingName={editingName}
              onEditingNameChange={onEditingNameChange}
              onCancelEditing={onCancelEditing}
              renameInputRef={renameInputRef}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function HierarchyPanel({
  items,
  selectedId,
  selectedIds,
  onSelect,
  onMultiSelect,
  onVisibilityToggle,
  onRename,
  onMenuOpen,
  className,
}: HierarchyPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleStartEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleCommitRename = () => {
    if (editingId && editingName.trim() && onRename) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleCancelEditing = () => setEditingId(null);

  // Focus input after it renders
  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
            <Boxes size={24} className="mb-2 opacity-40" />
            <p className="text-xs">No objects in scene</p>
          </div>
        ) : (
          items.map((item) => (
            <HierarchyRow
              key={item.id}
              item={item}
              depth={0}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onMultiSelect={onMultiSelect}
              onVisibilityToggle={onVisibilityToggle}
              onRename={onRename}
              onMenuOpen={onMenuOpen}
              editingId={editingId}
              onStartEditing={handleStartEditing}
              onCommitRename={handleCommitRename}
              editingName={editingName}
              onEditingNameChange={setEditingName}
              onCancelEditing={handleCancelEditing}
              renameInputRef={renameInputRef}
            />
          ))
        )}
      </div>
    </div>
  );
}
