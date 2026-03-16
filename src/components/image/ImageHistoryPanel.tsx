'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

const MOCK_HISTORY = [
  { id: '1', color: '#7c3aed', converted: true, date: '2h ago' },
  { id: '2', color: '#3b82f6', converted: false, date: '3h ago' },
  { id: '3', color: '#22c55e', converted: true, date: '5h ago' },
  { id: '4', color: '#f5a623', converted: false, date: '1d ago' },
  { id: '5', color: '#ef4444', converted: true, date: '2d ago' },
  { id: '6', color: '#06b6d4', converted: false, date: '3d ago' },
];

type ViewMode = 'grid' | 'list' | 'large';

export default function ImageHistoryPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-[#333355]">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#7c3aed]"
          />
          <button className="px-2.5 py-1.5 rounded-lg bg-[#7c3aed] text-white text-xs font-medium hover:bg-[#6d28d9] transition-colors">
            Upload
          </button>
        </div>
        <div className="flex gap-1">
          {(['grid', 'list', 'large'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex-1 py-1 text-[10px] rounded transition-colors',
                viewMode === mode
                  ? 'bg-[#252542] text-white'
                  : 'text-[#64748b] hover:text-[#94a3b8]',
              )}
            >
              {mode === 'grid' ? '⊞' : mode === 'list' ? '☰' : '⬛'}
            </button>
          ))}
        </div>
      </div>

      {/* History grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div
          className={cn(
            'grid gap-2',
            viewMode === 'grid'
              ? 'grid-cols-2'
              : viewMode === 'large'
                ? 'grid-cols-1'
                : 'grid-cols-1',
          )}
        >
          {MOCK_HISTORY.map((item) => (
            <div
              key={item.id}
              className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#7c3aed] transition-all group"
              style={{
                background: item.color,
                aspectRatio: viewMode === 'list' ? '3/1' : '1/1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* 3D conversion indicator */}
              {item.converted && (
                <div
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px]"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                >
                  🧊
                </div>
              )}
              <span className="text-white text-2xl opacity-30">🖼</span>
              {viewMode === 'list' && (
                <div className="absolute right-2 text-xs text-white/60">
                  {item.date}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
