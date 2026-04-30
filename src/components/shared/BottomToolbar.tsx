'use client';

import { Undo2, Redo2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import ExportDropdown from './ExportDropdown';

interface BottomToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  extraActions?: React.ReactNode;
  className?: string;
  showExport?: boolean;
}

export default function BottomToolbar({
  onUndo,
  onRedo,
  onSave,
  extraActions,
  className,
  showExport = true,
}: BottomToolbarProps) {
  return (
    <div
      className={cn('flex items-center gap-1 rounded-xl px-3 py-2', className)}
      style={{
        background: 'rgba(6, 21, 37, 0.87)',
        border: '1px solid var(--border)',
        height: 48,
      }}
    >
      {/* Undo */}
      <button
        onClick={onUndo}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
        title="Undo"
      >
        <Undo2 size={16} />
      </button>

      {/* Redo */}
      <button
        onClick={onRedo}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
        title="Redo"
      >
        <Redo2 size={16} />
      </button>

      {/* Divider */}
      {extraActions && (
        <div
          className="w-px h-5 mx-1"
          style={{ background: 'var(--border)' }}
        />
      )}

      {/* Page-specific actions */}
      {extraActions}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save */}
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
        style={{ background: '#22c55e', color: '#0d0d18' }}
        title="Save"
      >
        <Save size={14} />
        <span>Save</span>
      </button>

      {/* Export */}
      {showExport && <ExportDropdown />}
    </div>
  );
}
