'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PhysicsPart } from '@/app/workspace/_physics/page';

const TYPE_ICONS: Record<string, string> = {
  link: '🔗',
  joint: '⚙️',
  base: '🏠',
  tool: '🔧',
};

const TYPE_COLORS: Record<string, string> = {
  base: '#f5a623',
  link: '#3b82f6',
  tool: '#22c55e',
  joint: '#a855f7',
};

interface PhysicsPartsPanelProps {
  parts: PhysicsPart[];
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
}

export default function PhysicsPartsPanel({
  parts,
  selectedPartId,
  onSelectPart,
}: PhysicsPartsPanelProps) {
  const [search, setSearch] = useState('');

  const filteredParts = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">
          PARTS
        </h2>
        <p className="text-[10px] text-[#64748b] mt-0.5">
          {parts.length} parts loaded
        </p>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#333355]">
        <input
          type="text"
          placeholder="Search parts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#7c3aed]"
        />
      </div>

      {/* Parts list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredParts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-xs text-[#64748b]">No parts found</p>
          </div>
        )}
        {filteredParts.map((part) => (
          <div
            key={part.id}
            onClick={() =>
              onSelectPart(part.id === selectedPartId ? null : part.id)
            }
            className={cn(
              'flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-b-[#333355]/50',
              part.id === selectedPartId
                ? 'bg-[#7c3aed]/15 border-l-2 border-l-[#7c3aed]'
                : 'hover:bg-[#252542]',
            )}
          >
            {/* Type icon */}
            <span className="text-sm flex-shrink-0">
              {TYPE_ICONS[part.type] ?? '📦'}
            </span>

            {/* Part info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">
                {part.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background: `${TYPE_COLORS[part.type] ?? '#64748b'}22`,
                    color: TYPE_COLORS[part.type] ?? '#64748b',
                  }}
                >
                  {part.type}
                </span>
                <span className="text-[10px] text-[#64748b]">
                  {part.vertexCount.toLocaleString()} verts
                </span>
              </div>
            </div>

            {/* Color dot */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
              style={{ background: part.color }}
            />
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-3 border-t border-[#333355] flex items-center justify-between">
        <span className="text-[10px] text-[#64748b]">
          {parts.filter((p) => p.type === 'base').length} base ·{' '}
          {parts.filter((p) => p.type === 'link').length} link ·{' '}
          {parts.filter((p) => p.type === 'tool').length} tool
        </span>
      </div>
    </div>
  );
}
