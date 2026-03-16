'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface MockAsset {
  id: string;
  name: string;
  type: 'Model' | 'Splat' | 'Scene' | 'Texture';
  color: string;
  starred: boolean;
  splatUrl?: string; // if set, drag-drop loads this into SparkViewport
  icon?: string;
}

const MOCK_ASSETS: MockAsset[] = [
  {
    id: 'benz-splat',
    name: 'Benz 9F Scan',
    type: 'Splat',
    color: '#3b82f6',
    starred: true,
    splatUrl: '/samples/benz_9f.ply',
    icon: '✦',
  },
  {
    id: 'car-parts',
    name: 'Car Parts',
    type: 'Model',
    color: '#7c3aed',
    starred: false,
  },
  {
    id: 'benz-scan',
    name: 'Benz Scan',
    type: 'Model',
    color: '#3b82f6',
    starred: false,
  },
  {
    id: 'scene-a',
    name: 'Scene A',
    type: 'Scene',
    color: '#22c55e',
    starred: false,
  },
  {
    id: 'scene-b',
    name: 'Scene B',
    type: 'Scene',
    color: '#f5a623',
    starred: false,
  },
  {
    id: 'metal-tex',
    name: 'Metal Texture',
    type: 'Texture',
    color: '#94a3b8',
    starred: false,
  },
  {
    id: 'wood-tex',
    name: 'Oak Wood',
    type: 'Texture',
    color: '#d97706',
    starred: true,
  },
];

const FILTERS = [
  'All',
  'Splats',
  'Models',
  'Scenes',
  'Textures',
  'Favorites ★',
];

const TYPE_ICON: Record<string, string> = {
  Splat: '✦',
  Model: '🚗',
  Scene: '🌍',
  Texture: '🎨',
};

interface AssetLibraryPanelProps {
  onDragStart: (assetId: string, splatUrl?: string) => void;
}

export default function AssetLibraryPanel({
  onDragStart,
}: AssetLibraryPanelProps) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Recent');

  const filteredAssets = MOCK_ASSETS.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All' ||
      (filter === 'Splats' && a.type === 'Splat') ||
      (filter === 'Models' && a.type === 'Model') ||
      (filter === 'Scenes' && a.type === 'Scene') ||
      (filter === 'Textures' && a.type === 'Texture') ||
      (filter === 'Favorites ★' && a.starred);
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          📦 Asset Library
        </h2>
      </div>

      <div className="px-3 py-2.5 border-b border-[#333355] space-y-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#7c3aed]"
        />

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded-full transition-colors',
                filter === f
                  ? 'bg-[#7c3aed] text-white'
                  : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#64748b]">
            {filteredAssets.length} assets
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-[#252542] border border-[#333355] rounded px-2 py-1 text-[10px] text-[#94a3b8] focus:outline-none"
          >
            <option>Recent</option>
            <option>Name</option>
            <option>Type</option>
          </select>
        </div>
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        <div className="grid grid-cols-2 gap-2">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={() => onDragStart(asset.id, asset.splatUrl)}
              className={cn(
                'rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all group',
                asset.splatUrl
                  ? 'hover:ring-2 hover:ring-[#D5B451]'
                  : 'hover:ring-2 hover:ring-[#7c3aed]',
              )}
              style={{
                border: `1px solid ${asset.splatUrl ? '#D5B451' : '#333355'}22`,
                background: '#252542',
              }}
            >
              {/* Thumbnail */}
              <div
                className="h-20 flex items-center justify-center text-3xl relative"
                style={{ background: `${asset.color}22` }}
              >
                {asset.splatUrl ? (
                  <>
                    {/* Splat shimmer preview */}
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        background: `radial-gradient(ellipse at center, ${asset.color}88, transparent 70%)`,
                      }}
                    />
                    <span
                      className="relative text-2xl"
                      style={{ color: asset.color }}
                    >
                      ✦
                    </span>
                  </>
                ) : (
                  <span>{TYPE_ICON[asset.type] ?? '📦'}</span>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-white font-medium truncate flex-1">
                    {asset.name}
                  </p>
                  <button
                    className="text-[#64748b] hover:text-[#f5a623] transition-colors ml-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {asset.starred ? '★' : '☆'}
                  </button>
                </div>
                <span
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded',
                    asset.splatUrl
                      ? 'bg-[#D5B451]/20 text-[#D5B451]'
                      : 'bg-[#333355] text-[#94a3b8]',
                  )}
                >
                  {asset.type}
                </span>
                {asset.splatUrl && (
                  <p className="text-[9px] text-[#64748b] mt-0.5">
                    Drag to load
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Upload card */}
          <div
            className="rounded-xl cursor-pointer hover:border-[#7c3aed] transition-colors flex flex-col items-center justify-center h-32"
            style={{ border: '2px dashed #333355', background: '#252542' }}
          >
            <div className="text-2xl mb-1 text-[#64748b]">+</div>
            <p className="text-[10px] text-[#64748b]">Upload Asset</p>
          </div>
        </div>
      </div>
    </div>
  );
}
