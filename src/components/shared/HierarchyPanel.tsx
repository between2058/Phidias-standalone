'use client';

import { useState } from 'react';
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
  onMenuOpen?: (id: string) => void;
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
}: HierarchyRowProps) {
  const [expanded, setExpanded] = useState(true);
  // Determine if the item is selected, prioritizing multi-selection if available
  const isSelected = selectedIds
    ? selectedIds.includes(item.id)
    : selectedId === item.id;
  const hasChildren = item.children && item.children.length > 0;

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

        {/* Name */}
        <span className="flex-1 text-xs truncate min-w-0">{item.name}</span>

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
              selectedIds={selectedIds} // Pass down
              onSelect={onSelect}
              onMultiSelect={onMultiSelect} // Pass down
              onVisibilityToggle={onVisibilityToggle}
              onMenuOpen={onMenuOpen}
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
            />
          ))
        )}
      </div>
    </div>
  );
}
