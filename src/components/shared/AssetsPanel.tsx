'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  LayoutGrid,
  List,
  Star,
  Filter,
  X,
  RotateCcw,
  Globe,
  Box,
  Workflow,
  Layers,
  CheckSquare,
  Trash2,
  Download,
  History,
  Network,
  Search,
  ArrowUpDown,
  MoreHorizontal,
  Upload,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-context';
import type { Asset } from '@/lib/workspace-context';
import ScenePanel from '@/components/shared/ScenePanel';
import { cn } from '@/lib/utils';
import { usePhidiasStore } from '@/store/phidias-store';
import UploadToPegaverseModal from './UploadToPegaverseModal';
import { usePathname } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────

type PanelTab = 'assets' | 'scene' | 'history';
type ActiveFilter = 'all' | 'favorites';
type ModelTypeFilter = 'all' | 'textured' | 'untextured' | 'rigged' | 'splat';
type ViewMode = 'grid' | 'list';
type SortOption = 'latest' | 'oldest' | 'az' | 'za' | 'size';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function sortAssets(assets: Asset[], sort: SortOption): Asset[] {
  return [...assets].sort((a, b) => {
    switch (sort) {
      case 'latest': return b.createdAt.getTime() - a.createdAt.getTime();
      case 'oldest': return a.createdAt.getTime() - b.createdAt.getTime();
      case 'az': return a.name.localeCompare(b.name);
      case 'za': return b.name.localeCompare(a.name);
      case 'size': return (b.fileSize ?? 0) - (a.fileSize ?? 0);
      default: return 0;
    }
  });
}

// ─── Status indicator ────────────────────────────────────────────────────────

function StatusBadge({ status, progress }: { status?: Asset['status']; progress?: number }) {
  if (!status || status === 'ready') return null;

  if (status === 'generating') {
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
        style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
      >
        <div className="w-2 h-2 rounded-full border border-[#a78bfa] border-t-transparent animate-spin" />
        {progress !== undefined ? `${Math.round(progress)}%` : 'Gen…'}
      </div>
    );
  }
  if (status === 'queued') {
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
        style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
      >
        ⏳ Queue
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
        style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}
      >
        ⚠ Failed
      </div>
    );
  }
  return null;
}

// ─── Thumbnail gradient by type ───────────────────────────────────────────────

const TYPE_GRADIENTS: Record<string, string> = {
  textured: 'linear-gradient(145deg, #0f1729 0%, #1e3a5f 40%, #2d1b69 100%)',
  untextured: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
  rigged: 'linear-gradient(145deg, #1c0a00 0%, #3d1a00 50%, #78350f 100%)',
  splat: 'linear-gradient(145deg, #001a1a 0%, #003d3d 50%, #006666 100%)',
};

const TYPE_ICONS: Record<string, string> = {
  textured: '🎨', untextured: '🧊', rigged: '🦾', splat: '✦',
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  assetId: string;
  x: number;
  y: number;
}

function AssetContextMenu({
  menu,
  hostApp,
  onClose,
  onDelete,
  onDownload,
  onDuplicate,
  onUploadToPegaverse,
  onSetActive,
  onRename,
}: {
  menu: ContextMenuState;
  hostApp: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUploadToPegaverse: (id: string) => void;
  onSetActive: (id: string) => void;
  onRename: (id: string) => void;
}) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  const items = [
    { label: 'Set as Active', icon: '◎', action: () => { onSetActive(menu.assetId); onClose(); } },
    { label: 'Rename', icon: '✏', action: () => { onRename(menu.assetId); onClose(); } },
    { label: 'Duplicate', icon: '⧉', action: () => { onDuplicate(menu.assetId); onClose(); } },
    { label: 'Download', icon: '↓', action: () => { onDownload(menu.assetId); onClose(); } },
    null, // divider
    { label: 'Delete', icon: '🗑', action: () => { onDelete(menu.assetId); onClose(); }, danger: true },
  ];

  return (
    <div
      className="fixed z-[200] rounded-xl overflow-hidden py-1"
      style={{
        left: Math.min(menu.x, window.innerWidth - 168),
        top: Math.min(menu.y, window.innerHeight - 220),
        background: '#1a1a2e',
        border: '1px solid #2d2d4a',
        boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
        width: 156,
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 h-px mx-2" style={{ background: '#1e1e36' }} />
        ) : (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors hover:bg-[#252542]"
            style={{ color: item.danger ? '#f87171' : '#94a3b8' }}
          >
            <span style={{ fontSize: 11 }}>{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ─── Sort Dropdown ────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'latest', label: 'Latest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'Name A→Z' },
  { value: 'za', label: 'Name Z→A' },
  { value: 'size', label: 'File size' },
];

function SortDropdown({
  current,
  onChange,
  onClose,
}: {
  current: SortOption;
  onChange: (s: SortOption) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 py-1"
      style={{
        background: '#1a1a2e',
        border: '1px solid #2d2d4a',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        width: 140,
      }}
    >
      {SORT_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => { onChange(opt.value); onClose(); }}
          className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#252542] flex items-center justify-between"
          style={{ color: current === opt.value ? '#a78bfa' : '#64748b' }}
        >
          {opt.label}
          {current === opt.value && <span style={{ color: '#7c3aed' }}>✓</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  modelType,
  onChangeModelType,
  onClose,
  onReset,
}: {
  modelType: ModelTypeFilter;
  onChangeModelType: (t: ModelTypeFilter) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const MODEL_TYPES: { value: ModelTypeFilter; label: string; Icon: LucideIcon }[] = [
    { value: 'all', label: 'All', Icon: Globe },
    { value: 'textured', label: 'Textured', Icon: Layers },
    { value: 'untextured', label: 'Untextured', Icon: Box },
    { value: 'rigged', label: 'Rigged', Icon: Workflow },
    { value: 'splat', label: 'Splat', Icon: Sparkles },
  ];

  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 rounded-xl border p-3 z-50"
      style={{
        background: '#1a1a2e',
        borderColor: '#333355',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">Filter</span>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="text-[#64748b] hover:text-white transition-colors" title="Reset">
            <RotateCcw size={12} />
          </button>
          <button onClick={onClose} className="text-[#64748b] hover:text-white transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#64748b] mb-2">Model Type</p>
      <div className="flex flex-wrap gap-2">
        {MODEL_TYPES.map(({ value, label, Icon }) => {
          const active = modelType === value;
          return (
            <button
              key={value}
              onClick={() => onChangeModelType(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
              style={{
                border: `1.5px solid ${active ? '#7c3aed' : '#2d2d4a'}`,
                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: active ? '#a78bfa' : '#64748b',
              }}
            >
              <Icon size={11} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Grid Asset Card ──────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: Asset;
  isActive: boolean;
  isManageMode: boolean;
  isChecked: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onFavoriteToggle: () => void;
  onCheckToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
}

function AssetCard({
  asset,
  isActive,
  isManageMode,
  isChecked,
  isRenaming,
  onSelect,
  onFavoriteToggle,
  onCheckToggle,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
}: AssetCardProps) {
  const [hovered, setHovered] = useState(false);
  const [renameValue, setRenameValue] = useState(asset.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const status = asset.status ?? 'ready';

  // Focus input when rename mode activates
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(asset.name);
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [isRenaming, asset.name]);

  return (
    <button
      onClick={() => (isManageMode ? onCheckToggle() : onSelect())}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative aspect-square rounded-xl overflow-hidden transition-all focus:outline-none group"
      style={{
        border: `2px solid ${isManageMode
          ? isChecked ? '#7c3aed' : 'transparent'
          : isActive ? '#3b82f6' : 'transparent'
          }`,
        boxShadow: isActive && !isManageMode ? '0 0 0 1px #1d4ed8' : undefined,
      }}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: asset.thumbnail ? undefined : TYPE_GRADIENTS[asset.type] ?? TYPE_GRADIENTS.textured,
        }}
      >
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/10 font-black select-none" style={{ fontSize: 48 }}>
              {asset.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Generating overlay */}
      {status === 'generating' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'rgba(13,13,24,0.75)' }}>
          <div className="w-6 h-6 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin mb-1.5" />
          {asset.progress !== undefined && (
            <span className="text-[10px] font-mono" style={{ color: '#a78bfa' }}>
              {Math.round(asset.progress)}%
            </span>
          )}
        </div>
      )}

      {/* Failed overlay */}
      {status === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.15)' }}>
          <span style={{ fontSize: 24 }}>⚠</span>
        </div>
      )}

      {/* Queued badge */}
      {status === 'queued' && (
        <div className="absolute top-1.5 left-2">
          <StatusBadge status="queued" />
        </div>
      )}

      {/* Bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

      {/* Bottom row */}
      <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between pointer-events-none">
        {isRenaming ? (
          // Inline rename input
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => { if (renameValue.trim()) onRenameSubmit(renameValue.trim()); else onRenameCancel(); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.currentTarget.blur(); }
              if (e.key === 'Escape') { onRenameCancel(); }
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-[10px] text-white font-medium bg-transparent border-b border-[#f5a623] outline-none pointer-events-auto mr-1 leading-tight"
            style={{ minWidth: 0 }}
          />
        ) : (
          <p className="text-[10px] text-white/80 truncate mr-1 leading-tight font-medium">
            {asset.name}
          </p>
        )}
        {!isManageMode && !isRenaming && (
          <button
            className="flex-shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center pointer-events-auto cursor-pointer hover:bg-white/20 transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#94a3b8', fontSize: 10, fontStyle: 'italic', fontWeight: 700 }}
            onClick={e => { e.stopPropagation(); onContextMenu(e); }}
            title="More options"
          >
            ···
          </button>
        )}
      </div>

      {/* Favorite star */}
      {!isManageMode && (hovered || asset.isFavorite) && (
        <button
          onClick={e => { e.stopPropagation(); onFavoriteToggle(); }}
          className="absolute top-1.5 left-2 transition-colors"
          title={asset.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={13} className={asset.isFavorite ? 'fill-[#f5a623] text-[#f5a623]' : 'text-white/40 hover:text-white/80'} />
        </button>
      )}

      {/* Armature (SkinnedMesh) badge */}
      {asset.hasSkinnedMesh && !isManageMode && (
        <div
          className="absolute top-1.5 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold pointer-events-none"
          style={{ background: 'rgba(120,53,15,0.85)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' }}
          title="Contains SkinnedMesh — bone-driven model"
        >
          🦴 Armature
        </div>
      )}

      {/* Type badge */}
      {/* {!isManageMode && hovered && (
                <div
                    className="absolute top-1.5 right-2 px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#94a3b8' }}
                >
                    {TYPE_ICONS[asset.type] ?? ''} {asset.type}
                </div>
            )} */}

      {/* Checkbox */}
      {isManageMode && (
        <div className="absolute top-1.5 right-1.5">
          <div
            className="w-4 h-4 rounded border-2 flex items-center justify-center"
            style={{
              borderColor: isChecked ? '#7c3aed' : 'rgba(255,255,255,0.5)',
              background: isChecked ? '#7c3aed' : 'rgba(0,0,0,0.5)',
            }}
          >
            {isChecked && <span className="text-white font-bold" style={{ fontSize: 8 }}>✓</span>}
          </div>
        </div>
      )}
    </button>
  );
}

// ─── List Asset Row ───────────────────────────────────────────────────────────

function AssetListRow({
  asset,
  isActive,
  isManageMode,
  isChecked,
  isRenaming,
  onSelect,
  onFavoriteToggle,
  onCheckToggle,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
}: AssetCardProps) {
  const [hovered, setHovered] = useState(false);
  const [renameValue, setRenameValue] = useState(asset.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(asset.name);
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [isRenaming, asset.name]);
  const status = asset.status ?? 'ready';

  return (
    <button
      onClick={() => (isManageMode ? onCheckToggle() : onSelect())}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-colors group text-left"
      style={{
        background: isActive && !isManageMode ? 'rgba(59,130,246,0.1)' : hovered ? '#252542' : 'transparent',
        borderLeft: `2px solid ${isActive && !isManageMode ? '#3b82f6' : 'transparent'}`,
      }}
    >
      {/* Checkbox (manage mode) */}
      {isManageMode && (
        <div
          className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center"
          style={{
            borderColor: isChecked ? '#7c3aed' : 'rgba(255,255,255,0.4)',
            background: isChecked ? '#7c3aed' : 'rgba(0,0,0,0.3)',
          }}
        >
          {isChecked && <span className="text-white font-bold" style={{ fontSize: 7 }}>✓</span>}
        </div>
      )}

      {/* Thumbnail */}
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden relative"
        style={{
          background: asset.thumbnail ? undefined : TYPE_GRADIENTS[asset.type] ?? TYPE_GRADIENTS.textured,
        }}
      >
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-white/20 font-black text-lg">
            {asset.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {status === 'generating' && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-3 h-3 rounded-full border border-[#7c3aed] border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => { if (renameValue.trim()) onRenameSubmit(renameValue.trim()); else onRenameCancel(); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.currentTarget.blur(); }
              if (e.key === 'Escape') { onRenameCancel(); }
            }}
            onClick={e => e.stopPropagation()}
            className="w-full text-xs text-white font-medium bg-transparent border-b border-[#f5a623] outline-none leading-tight"
          />
        ) : (
          <p className="text-xs text-white truncate font-medium leading-tight">
            {asset.name}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px]" style={{ color: '#4b5563' }}>
            {TYPE_ICONS[asset.type]} {asset.type}
          </span>
          {asset.hasSkinnedMesh && (
            <span
              className="px-1 py-0.5 rounded-full text-[8px] font-semibold"
              style={{ background: 'rgba(120,53,15,0.7)', color: '#fcd34d' }}
              title="Contains SkinnedMesh — bone-driven model"
            >
              🦴
            </span>
          )}
          {asset.faces ? (
            <span className="text-[9px]" style={{ color: '#4b5563' }}>
              · {(asset.faces / 1000).toFixed(0)}K
            </span>
          ) : asset.fileSize !== undefined ? (
            <span className="text-[9px]" style={{ color: '#4b5563' }}>
              · {formatFileSize(asset.fileSize)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Status + date */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <StatusBadge status={status} progress={asset.progress} />
        <span className="text-[9px]" style={{ color: '#4b5563' }}>
          {formatDate(asset.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isManageMode && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onFavoriteToggle(); }}
              className="w-5 h-5 flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100"
              style={{ color: asset.isFavorite ? '#f5a623' : '#4b5563' }}
            >
              <Star size={10} className={asset.isFavorite ? 'fill-[#f5a623]' : ''} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onContextMenu(e); }}
              className="w-5 h-5 flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-[#333355]"
              style={{ color: '#64748b' }}
            >
              <MoreHorizontal size={11} />
            </button>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Upload / Drop Zone ────────────────────────────────────────────────────────

function UploadCard({ onClick, viewMode }: { onClick: () => void; viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 transition-colors"
        style={{ borderLeft: '2px solid transparent', color: '#4b5563' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border border-dashed"
          style={{ borderColor: '#2d2d4a' }}
        >
          <span className="text-[#4b5563] text-lg leading-none">+</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs text-[#4b5563] font-medium">Upload Model</p>
          <p className="text-[9px]" style={{ color: '#3d3d5c' }}>GLB, OBJ, FBX, STL</p>
        </div>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all focus:outline-none group"
      style={{ borderColor: '#2d2d4a', background: 'rgba(37,37,66,0.4)' }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center mb-0.5 transition-colors group-hover:bg-[#7c3aed]/20"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <span className="text-[#64748b] text-lg leading-none group-hover:text-[#7c3aed] transition-colors">+</span>
      </div>
      <span className="text-[#64748b] text-[10px] font-semibold group-hover:text-[#94a3b8] transition-colors text-center px-1">
        Upload 3D Model
      </span>
      <span className="text-[#3d3d5c] text-[9px] text-center leading-tight px-2">
        GLB, OBJ, FBX, STL
        <br />≤100MB
      </span>
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{ background: '#1e1e36' }}
        >
          <Filter size={16} style={{ color: '#4b5563' }} />
        </div>
        <p className="text-xs font-medium" style={{ color: '#64748b' }}>No matching assets</p>
        <button onClick={onClear} className="mt-2 text-[11px] hover:underline" style={{ color: '#7c3aed' }}>
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: 'linear-gradient(135deg, #0E243E, #1e3a5f)' }}
      >
        <Sparkles size={20} style={{ color: '#D5B451' }} />
      </div>
      <p className="text-xs font-semibold text-white mb-1">No assets yet</p>
      <p className="text-[11px] leading-relaxed mb-3" style={{ color: '#4b5563' }}>
        Generate a 3D model from the Model tab, or upload a file above.
      </p>
      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#3d3d5c' }}>
        <span>Supports</span>
        <span className="px-1.5 py-0.5 rounded" style={{ background: '#1e1e36' }}>GLB</span>
        <span className="px-1.5 py-0.5 rounded" style={{ background: '#1e1e36' }}>USDZ</span>
        {/* <span className="px-1.5 py-0.5 rounded" style={{ background: '#1e1e36' }}>PLY</span> */}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { assets, activeAssetId } = useWorkspace();
  const activeAsset = assets.find(a => a.id === activeAssetId);

  const entries = activeAsset
    ? [
      { label: `Loaded "${activeAsset.name}"`, time: 'Now', color: '#22c55e' },
      { label: 'Asset selected', time: '1m ago', color: '#3b82f6' },
      { label: 'Session started', time: '5m ago', color: '#94a3b8' },
    ]
    : [{ label: 'Session started', time: 'Now', color: '#94a3b8' }];

  return (
    <div className="p-3 space-y-1">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2 border-b last:border-0" style={{ borderColor: '#1e1e36' }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-xs text-[#94a3b8] flex-1">{entry.label}</span>
          <span className="text-[10px] text-[#4b5563] flex-shrink-0">{entry.time}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AssetsPanel({ defaultTab = 'assets' }: { defaultTab?: PanelTab }) {
  const hostApp = usePhidiasStore((state) => state.hostApp);

  const {
    assets,
    activeAssetId,
    setActiveAssetId,
    removeAssets,
    toggleFavorite,
    addAsset,
    updateAsset,
    sceneGraph,
    segmentHierarchy,
  } = useWorkspace();

  const [panelTab, setPanelTab] = useState<PanelTab>(defaultTab);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [modelTypeFilter, setModelTypeFilter] = useState<ModelTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showManageDropdown, setShowManageDropdown] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadModalAssetId, setUploadModalAssetId] = useState<string | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Automatically switch tabs based on route
  useEffect(() => {
    if (pathname?.includes('/workspace/segment')) {
      setPanelTab('scene');
    } else if (pathname?.includes('/workspace/model') || pathname?.includes('/workspace/image')) {
      setPanelTab('assets');
    }
  }, [pathname]);

  // Close dropdowns when clicking elsewhere
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        setShowFilterDropdown(false);
        setShowSortDropdown(false);
        setShowManageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fall back from scene tab if no graph
  useEffect(() => {
    const isSegmentMode = pathname?.includes('/workspace/segment');
    if (!sceneGraph && !segmentHierarchy && panelTab === 'scene' && !isSegmentMode) {
      setPanelTab('assets');
    }
  }, [sceneGraph, segmentHierarchy, panelTab, pathname]);

  // Listen for external tab-switch requests (e.g. from segment/page.tsx on part click)
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail as PanelTab;
      if (tab && (tab === 'assets' || tab === 'scene' || tab === 'history')) {
        setPanelTab(tab);
      }
    };
    window.addEventListener('phidias:switch-panel-tab', handler);
    return () => window.removeEventListener('phidias:switch-panel-tab', handler);
  }, [setPanelTab]);

  // ── Filtering & sorting ──────────────────────────────────────────────────

  const filteredAssets = sortAssets(
    assets.filter(a => {
      if (activeFilter === 'favorites' && !a.isFavorite) return false;
      if (modelTypeFilter !== 'all' && a.type !== modelTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!a.name.toLowerCase().includes(q)) return false;
      }
      return true;
    }),
    sortBy
  );

  const hasActiveFilter = modelTypeFilter !== 'all' || searchQuery.trim() !== '';

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCheckToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const exitManageMode = () => {
    setIsManageMode(false);
    setSelectedIds(new Set());
    setShowManageDropdown(false);
  };

  const handleBatchExport = () => {
    if (selectedIds.size === 0) return;
    const selected = assets.filter(a => selectedIds.has(a.id) && a.modelUrl && a.status === 'ready');
    if (selected.length === 0) return;
    for (const asset of selected) {
      const a = document.createElement('a');
      a.href = asset.modelUrl!;
      a.download = `${asset.name.replace(/\.[^/.]+$/, '')}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    exitManageMode();
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    removeAssets(Array.from(selectedIds));
    setSelectedIds(new Set());
    exitManageMode();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const id = addAsset({
      name: file.name.replace(/\.[^.]+$/, ''),
      modelUrl: url,
      type: 'untextured',
      status: 'ready',
      fileSize: file.size,
      pipelineUsed: 'uploaded',
    });
    setActiveAssetId(id);
    e.target.value = '';
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!panelRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const allowed = ['.glb', '.gltf', '.obj', '.fbx', '.stl', '.ply', '.usdz', '.stp', '.step', '.iges', '.igs', '.brep', '.brp'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) return;

    // CAD files need special handling via the CAD page's import pipeline
    const cadExts = ['.stp', '.step', '.iges', '.igs', '.brep', '.brp'];
    if (cadExts.includes(ext)) {
      window.dispatchEvent(new CustomEvent('phidias:cad-file-upload', { detail: file }));
      return;
    }

    const url = URL.createObjectURL(file);
    const id = addAsset({
      name: file.name.replace(/\.[^.]+$/, ''),
      modelUrl: url,
      type: 'untextured',
      status: 'ready',
      fileSize: file.size,
      pipelineUsed: 'uploaded',
    });
    setActiveAssetId(id);
  }, [addAsset, setActiveAssetId]);

  // ── Context Menu Actions ──────────────────────────────────────────────────

  const openContextMenu = (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu({ assetId, x: e.clientX, y: e.clientY });
  };

  const handleContextDelete = (id: string) => removeAssets([id]);
  const handleContextDownload = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    const a = document.createElement('a');
    a.href = asset.modelUrl;
    a.download = `${asset.name}.glb`;
    a.click();
  };
  const handleContextDuplicate = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    addAsset({ ...asset, name: `${asset.name} (copy)` });
  };
  const handleContextUploadToPegaverse = (id: string) => {
    setUploadModalAssetId(id);
  };
  const handleContextSetActive = (id: string) => setActiveAssetId(id);
  const handleContextRename = (id: string) => {
    setRenamingId(id);
  };
  const handleRenameSubmit = (id: string, newName: string) => {
    updateAsset(id, { name: newName });
    setRenamingId(null);
  };
  const handleRenameCancel = () => setRenamingId(null);

  // ── Tabs ─────────────────────────────────────────────────────────────────

  type TabDef = { id: PanelTab; Icon: LucideIcon; label: string };
  const tabs: TabDef[] = [
    { id: 'assets', Icon: LayoutGrid, label: 'Assets' },
    ...(sceneGraph || segmentHierarchy || pathname?.includes('/workspace/segment')
      ? [{ id: 'scene' as PanelTab, Icon: Network, label: 'Scene Graph' }]
      : []),
    // { id: 'history', Icon: History, label: 'History' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={panelRef}
      className="flex flex-col h-full border-l overflow-hidden flex-shrink-0 relative"
      style={{
        width: 280,
        background: isDragOver ? '#1a2036' : '#141428',
        borderColor: '#1e1e36',
        transition: 'background 0.2s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag-over overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.08)', border: '2px dashed #7c3aed', borderRadius: 0 }}>
          <Upload size={24} style={{ color: '#7c3aed' }} className="mb-2" />
          <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Drop to upload</p>
          <p className="text-[11px] mt-1" style={{ color: '#7c3aed' }}>GLB, OBJ, FBX, PLY, STL, USDZ</p>
        </div>
      )}

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center border-b"
        style={{ borderColor: '#1e1e36', background: '#1a1a2e' }}
      >
        {tabs.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setPanelTab(id)}
            title={label}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2',
              panelTab === id
                ? 'border-[#7c3aed] text-white'
                : 'border-transparent text-[#4b5563] hover:text-[#64748b]'
            )}
          >
            <Icon size={13} />
            {(id === 'assets' || (id === 'scene' && tabs.length <= 2)) && (
              <span className="hidden sm:inline">{label}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Assets Tab ──────────────────────────────────────────────────── */}
      {panelTab === 'assets' && (
        <>
          {/* Search bar */}
          <div
            className="flex-shrink-0 flex items-center gap-2 px-2.5 py-2 border-b"
            style={{ borderColor: '#1e1e36', background: '#1a1a2e' }}
          >
            <div
              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ background: '#252542', border: '1px solid #333355' }}
            >
              <Search size={11} style={{ color: '#4b5563', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search assets…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-white placeholder-[#4b5563] focus:outline-none min-w-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ color: '#4b5563' }}>
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Filter & View Bar */}
          <div
            className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b relative"
            style={{ borderColor: '#1e1e36', background: '#1a1a2e' }}
          >
            {/* All / Favorites */}
            <button
              onClick={() => { setActiveFilter('all'); setShowFilterDropdown(false); }}
              title="All assets"
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: activeFilter === 'all' && !hasActiveFilter ? '#7c3aed' : 'rgba(37,37,66,0.6)',
                color: activeFilter === 'all' && !hasActiveFilter ? 'white' : '#64748b',
              }}
            >
              <LayoutGrid size={12} />
            </button>
            <button
              onClick={() => { setActiveFilter(v => v === 'favorites' ? 'all' : 'favorites'); setShowFilterDropdown(false); }}
              title="Favorites"
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: activeFilter === 'favorites' ? '#7c3aed' : 'rgba(37,37,66,0.6)',
                color: activeFilter === 'favorites' ? 'white' : '#64748b',
              }}
            >
              <Star size={12} className={activeFilter === 'favorites' ? 'fill-white' : ''} />
            </button>
            {/* <button
                            onClick={() => { setShowFilterDropdown(v => !v); setShowSortDropdown(false); setShowManageDropdown(false); }}
                            title="Filter by type"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{
                                background: showFilterDropdown || hasActiveFilter ? '#7c3aed' : 'rgba(37,37,66,0.6)',
                                color: showFilterDropdown || hasActiveFilter ? 'white' : '#64748b',
                            }}
                        >
                            <Filter size={12} />
                        </button> */}

            <div className="flex-1" />

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => { setShowSortDropdown(v => !v); setShowFilterDropdown(false); setShowManageDropdown(false); }}
                title="Sort"
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  background: showSortDropdown ? '#7c3aed' : 'rgba(37,37,66,0.6)',
                  color: showSortDropdown ? 'white' : '#64748b',
                }}
              >
                <ArrowUpDown size={12} />
              </button>
              {showSortDropdown && (
                <SortDropdown
                  current={sortBy}
                  onChange={setSortBy}
                  onClose={() => setShowSortDropdown(false)}
                />
              )}
            </div>

            {/* View toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ background: 'rgba(37,37,66,0.6)', border: '1px solid #333355' }}
            >
              <button
                onClick={() => setViewMode('grid')}
                className="p-1.5 transition-colors"
                style={{ background: viewMode === 'grid' ? '#7c3aed' : 'transparent', color: viewMode === 'grid' ? 'white' : '#64748b' }}
                title="Grid view"
              >
                <LayoutGrid size={12} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="p-1.5 transition-colors"
                style={{ background: viewMode === 'list' ? '#7c3aed' : 'transparent', color: viewMode === 'list' ? 'white' : '#64748b' }}
                title="List view"
              >
                <List size={12} />
              </button>
            </div>

            {/* Manage */}
            <div className="relative">
              <button
                onClick={() => { setShowManageDropdown(v => !v); setShowFilterDropdown(false); setShowSortDropdown(false); }}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isManageMode ? 'bg-[#7c3aed] text-white' : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#252542]'
                )}
              >
                <CheckSquare size={11} />
              </button>
              {showManageDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl border overflow-hidden z-50"
                  style={{ background: '#1a1a2e', borderColor: '#2d2d4a', width: 148, boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}
                >
                  <button
                    onClick={() => { setIsManageMode(true); setShowManageDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs text-[#94a3b8] hover:bg-[#252542] transition-colors flex items-center gap-2"
                  >
                    <Download size={11} />
                    Batch Export
                  </button>
                  <div className="h-px" style={{ background: '#1e1e36' }} />
                  <button
                    onClick={() => { setIsManageMode(true); setShowManageDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs text-[#ef4444] hover:bg-[#252542] transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={11} />
                    Batch Delete
                  </button>
                </div>
              )}
            </div>

            {/* Filter dropdown */}
            {showFilterDropdown && (
              <FilterDropdown
                modelType={modelTypeFilter}
                onChangeModelType={setModelTypeFilter}
                onClose={() => setShowFilterDropdown(false)}
                onReset={() => { setModelTypeFilter('all'); setActiveFilter('all'); setSearchQuery(''); }}
              />
            )}
          </div>

          {/* Manage action bar */}
          {isManageMode && (
            <div
              className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b"
              style={{ background: '#252542', borderColor: '#1e1e36' }}
            >
              <span className="text-xs text-[#64748b]">{selectedIds.size} selected</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedIds(new Set(filteredAssets.map(a => a.id)))}
                  className="px-2 py-1 rounded text-xs text-[#94a3b8] hover:bg-[#2a2a4a] transition-colors"
                >
                  All
                </button>
                <button
                  onClick={handleBatchExport}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#94a3b8] hover:bg-[#2a2a4a] transition-colors disabled:opacity-40"
                >
                  <Download size={10} />
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#ef4444] hover:bg-[#2a2a4a] transition-colors disabled:opacity-40"
                >
                  <Trash2 size={10} />
                </button>
                <button onClick={exitManageMode} className="p-1 rounded text-[#4b5563] hover:text-[#94a3b8]">
                  <X size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Asset Grid / List */}
          {viewMode === 'grid' ? (
            <div className="flex-1 overflow-y-auto p-2.5" style={{ background: '#141428' }}>
              <div className="grid grid-cols-2 gap-2">
                {!isManageMode && <UploadCard onClick={() => fileInputRef.current?.click()} viewMode="grid" />}
                {filteredAssets.map(asset => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isActive={asset.id === activeAssetId}
                    isManageMode={isManageMode}
                    isChecked={selectedIds.has(asset.id)}
                    isRenaming={renamingId === asset.id}
                    onSelect={() => setActiveAssetId(asset.id)}
                    onFavoriteToggle={() => toggleFavorite(asset.id)}
                    onCheckToggle={() => handleCheckToggle(asset.id)}
                    onContextMenu={e => openContextMenu(asset.id, e)}
                    onRenameSubmit={name => handleRenameSubmit(asset.id, name)}
                    onRenameCancel={handleRenameCancel}
                  />
                ))}
                {filteredAssets.length === 0 && (
                  <div className="col-span-2">
                    <EmptyState
                      hasFilter={hasActiveFilter || activeFilter === 'favorites'}
                      onClear={() => { setModelTypeFilter('all'); setActiveFilter('all'); setSearchQuery(''); }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto" style={{ background: '#141428' }}>
              {/* Column headers */}
              <div
                className="flex items-center px-2.5 py-1.5 border-b sticky top-0 z-10"
                style={{ background: '#141428', borderColor: '#1e1e36' }}
              >
                <span className="flex-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                  Name
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#4b5563', width: 60, textAlign: 'right' }}>
                  Modified
                </span>
              </div>
              {!isManageMode && <UploadCard onClick={() => fileInputRef.current?.click()} viewMode="list" />}
              {filteredAssets.map(asset => (
                <AssetListRow
                  key={asset.id}
                  asset={asset}
                  isActive={asset.id === activeAssetId}
                  isManageMode={isManageMode}
                  isChecked={selectedIds.has(asset.id)}
                  isRenaming={renamingId === asset.id}
                  onSelect={() => setActiveAssetId(asset.id)}
                  onFavoriteToggle={() => toggleFavorite(asset.id)}
                  onCheckToggle={() => handleCheckToggle(asset.id)}
                  onContextMenu={e => openContextMenu(asset.id, e)}
                  onRenameSubmit={name => handleRenameSubmit(asset.id, name)}
                  onRenameCancel={handleRenameCancel}
                />
              ))}
              {filteredAssets.length === 0 && (
                <EmptyState
                  hasFilter={hasActiveFilter || activeFilter === 'favorites'}
                  onClear={() => { setModelTypeFilter('all'); setActiveFilter('all'); setSearchQuery(''); }}
                />
              )}
            </div>
          )}

          {/* Asset count footer */}
          {filteredAssets.length > 0 && (
            <div
              className="flex-shrink-0 px-3 py-1.5 flex items-center justify-between border-t"
              style={{ borderColor: '#1e1e36', background: '#1a1a2e' }}
            >
              <span className="text-[10px]" style={{ color: '#4b5563' }}>
                {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
                {hasActiveFilter && ` (filtered)`}
              </span>
              {hasActiveFilter && (
                <button
                  onClick={() => { setModelTypeFilter('all'); setActiveFilter('all'); setSearchQuery(''); }}
                  className="text-[10px] flex items-center gap-1 transition-colors hover:text-[#94a3b8]"
                  style={{ color: '#4b5563' }}
                >
                  <RotateCcw size={9} />
                  Reset
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Scene Graph Tab ──────────────────────────────────────────────── */}
      {panelTab === 'scene' && (sceneGraph || segmentHierarchy) && (
        <ScenePanel />
      )}

      {/* ── History Tab ──────────────────────────────────────────────────── */}
      {panelTab === 'history' && (
        <div className="flex-1 overflow-y-auto" style={{ background: '#141428' }}>
          <HistoryTab />
        </div>
      )}

      {/* Context Menu (portal-style fixed positioning) */}
      {contextMenu && (
        <AssetContextMenu
          menu={contextMenu}
          hostApp={hostApp}
          onClose={() => setContextMenu(null)}
          onDelete={handleContextDelete}
          onDownload={handleContextDownload}
          onDuplicate={handleContextDuplicate}
          onUploadToPegaverse={handleContextUploadToPegaverse}
          onSetActive={handleContextSetActive}
          onRename={handleContextRename}
        />
      )}

      {/* Upload to Pegaverse Modal */}
      {uploadModalAssetId && (
        <UploadToPegaverseModal
          asset={assets.find((a) => a.id === uploadModalAssetId)!}
          onClose={() => setUploadModalAssetId(null)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
