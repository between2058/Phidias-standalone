'use client';

import { useState, useRef, useEffect } from 'react';
import { Boxes, Eye, EyeOff, MoreHorizontal, ChevronRight, Pencil } from 'lucide-react';
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
  onMenuOpen?: (id: string) => void;
  /** Rename a node */
  onRename?: (id: string, newName: string) => void;
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
  onMenuOpen?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
}

function HierarchyRow({
  item,
  depth,
  selectedId,
  selectedIds, // Added
  onSelect,
  onMultiSelect, // Added
  onVisibilityToggle,
  onMenuOpen,
  onRename,
}: HierarchyRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync renameValue with item.name when it changes (e.g., after rename)
  useEffect(() => {
    setRenameValue(item.name);
  }, [item.name]);

  // Determine if the item is selected, prioritizing multi-selection if available
  const isSelected = selectedIds
    ? selectedIds.includes(item.id)
    : selectedId === item.id;
  const hasChildren = item.children && item.children.length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== item.name) {
      onRename?.(item.id, trimmed);
    }
    setIsRenaming(false);
    setShowDropdown(false);
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors rounded-md mx-1',
          isSelected
            ? 'bg-accent-purple/20 text-text-primary'
            : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={(e) => {
          if (isRenaming) return;
          if ((e.ctrlKey || e.metaKey) && onMultiSelect) {
            onMultiSelect(item.id);
          } else {
            onSelect?.(item.id);
          }
        }}
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

        {/* Name - show input when renaming */}
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') {
                setIsRenaming(false);
                setRenameValue(item.name);
              }
            }}
            onBlur={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 text-xs bg-[#1e1e36] border border-[#7c3aed] rounded px-1 py-0.5 text-text-primary outline-none"
          />
        ) : (
          <span className="flex-1 text-xs truncate min-w-0">{item.name}</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity relative" ref={dropdownRef}>
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
              setShowDropdown(!showDropdown);
            }}
          >
            <MoreHorizontal size={12} className="text-text-tertiary" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div
              className="absolute right-0 top-full mt-1 w-32 py-1 rounded-md shadow-lg z-50"
              style={{ background: '#1e1e36', border: '1px solid #333355' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-[#252542] transition-colors"
                style={{ color: '#e2e8f0' }}
                onClick={() => {
                  setRenameValue(item.name);
                  setIsRenaming(true);
                  setShowDropdown(false);
                }}
              >
                <Pencil size={12} />
                Rename
              </button>
            </div>
          )}
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
              selectedIds={selectedIds} // Pass down
              onSelect={onSelect}
              onMultiSelect={onMultiSelect} // Pass down
              onVisibilityToggle={onVisibilityToggle}
              onMenuOpen={onMenuOpen}
              onRename={onRename}
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
  selectedIds, // Added
  onSelect,
  onMultiSelect, // Added
  onVisibilityToggle,
  onMenuOpen,
  onRename,
  className,
}: HierarchyPanelProps) {
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
              selectedIds={selectedIds} // Pass down
              onSelect={onSelect}
              onMultiSelect={onMultiSelect} // Pass down
              onVisibilityToggle={onVisibilityToggle}
              onMenuOpen={onMenuOpen}
              onRename={onRename}
            />
          ))
        )}
      </div>
    </div>
  );
}
