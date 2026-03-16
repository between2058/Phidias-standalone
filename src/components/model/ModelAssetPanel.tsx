'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import HierarchyPanel from '@/components/shared/HierarchyPanel';
import { mockGetHierarchy } from '@/lib/api/mock';

const MOCK_ASSETS = [
  {
    id: '1',
    name: 'Car Model v1',
    type: 'Textured',
    date: '2h ago',
    color: '#7c3aed',
  },
  {
    id: '2',
    name: 'Car Untextured',
    type: 'Untextured',
    date: '5h ago',
    color: '#3b82f6',
  },
  {
    id: '3',
    name: 'Benz Scan',
    type: 'Textured',
    date: '1d ago',
    color: '#06b6d4',
  },
];

const MOCK_HISTORY = [
  {
    id: '1',
    prompt: 'Blue sports car',
    date: '2h ago',
    status: 'Done',
    color: '#7c3aed',
  },
  {
    id: '2',
    prompt: 'Classic sedan',
    date: '5h ago',
    status: 'Done',
    color: '#3b82f6',
  },
  {
    id: '3',
    prompt: 'Racing vehicle',
    date: '1d ago',
    status: 'Done',
    color: '#22c55e',
  },
];

interface ModelAssetPanelProps {
  onSelectAsset?: (modelUrl: string) => void;
}

export default function ModelAssetPanel({
  onSelectAsset,
}: ModelAssetPanelProps) {
  const [activeTab, setActiveTab] = useState<'assets' | 'scene' | 'history'>(
    'assets',
  );
  const [assetFilter, setAssetFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string>('');
  const [hierarchy] = useState(mockGetHierarchy());

  const filteredAssets = MOCK_ASSETS.filter((a) => {
    if (assetFilter === 'All') return true;
    if (assetFilter === 'Textured') return a.type === 'Textured';
    if (assetFilter === 'Untextured') return a.type === 'Untextured';
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#333355]">
        {(['assets', 'scene', 'history'] as const).map((tab) => (
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'assets' && (
          <div>
            {/* Filter chips */}
            <div className="flex gap-1 px-3 py-2">
              {['All', 'Textured', 'Untextured'].map((f) => (
                <button
                  key={f}
                  onClick={() => setAssetFilter(f)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-full transition-colors',
                    assetFilter === f
                      ? 'bg-[#7c3aed] text-white'
                      : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* Asset cards */}
            <div className="px-3 pb-3 space-y-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() =>
                    onSelectAsset?.('/samples/sky_car_sam3d_parts.glb')
                  }
                  className="flex gap-3 p-2 rounded-lg bg-[#252542] hover:bg-[#2a2a4a] cursor-pointer transition-colors border border-[#333355]"
                >
                  <div
                    className="w-14 h-14 rounded-md flex-shrink-0 flex items-center justify-center text-white text-xl"
                    style={{ background: asset.color }}
                  >
                    🚗
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {asset.name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full',
                          asset.type === 'Textured'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-[#333355] text-[#94a3b8]',
                        )}
                      >
                        {asset.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#64748b] mt-1">
                      {asset.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'scene' && (
          <div className="py-2">
            <HierarchyPanel
              items={hierarchy}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="px-3 py-2 space-y-2">
            {MOCK_HISTORY.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-2 rounded-lg bg-[#252542] border border-[#333355]"
              >
                <div
                  className="w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center"
                  style={{ background: item.color }}
                >
                  <span className="text-white text-lg">🚗</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{item.prompt}</p>
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    {item.date}
                  </p>
                  <span className="text-[10px] text-green-400">
                    ✓ {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
