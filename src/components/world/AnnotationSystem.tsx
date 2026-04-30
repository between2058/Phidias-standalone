'use client';

import React, { useState } from 'react';
import type { AnnotationPin } from '@/lib/api/types';
import { triggerDownload } from '@/lib/three/loaders';

interface AnnotationSystemProps {
  pins: AnnotationPin[];
  onAddPin: (pin: Omit<AnnotationPin, 'id' | 'number'>) => void;
  onDeletePin: (id: string) => void;
  onUpdatePin: (id: string, updates: Partial<AnnotationPin>) => void;
  onPlayTour: () => void;
}

export default function AnnotationSystem({
  pins,
  onDeletePin,
  onUpdatePin,
  onPlayTour,
}: AnnotationSystemProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#333355] flex items-center justify-between">
        <p className="text-xs font-semibold text-white">📌 Annotations</p>
        <span className="text-[10px] text-[#64748b]">{pins.length} pins</span>
      </div>

      {/* Tour playback */}
      <div className="px-3 py-2 border-b border-[#333355]">
        <button
          onClick={onPlayTour}
          disabled={pins.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          style={{ background: '#7c3aed', color: 'white' }}
        >
          ▶ Play Tour
        </button>
      </div>

      {/* Pin list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
        {pins.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-[#64748b]">No annotations yet</p>
            <p className="text-[10px] text-[#4b5563] mt-1">
              Enable annotate mode and click the viewport
            </p>
          </div>
        ) : (
          pins.map((pin, index) => (
            <div
              key={pin.id}
              className="rounded-lg p-2 transition-colors"
              style={{ background: '#252542', border: '1px solid #333355' }}
            >
              <div className="flex items-center gap-2">
                {/* Number badge */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                  style={{ background: pin.color }}
                >
                  {index + 1}
                </div>
                {/* Title */}
                {editingId === pin.id ? (
                  <input
                    type="text"
                    value={pin.title}
                    onChange={(e) =>
                      onUpdatePin(pin.id, { title: e.target.value })
                    }
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    className="flex-1 bg-[#333355] rounded px-2 py-1 text-xs text-white focus:outline-none"
                  />
                ) : (
                  <span
                    className="flex-1 text-xs text-white cursor-pointer hover:text-[#7c3aed]"
                    onClick={() => setEditingId(pin.id)}
                  >
                    {pin.title || 'Untitled Pin'}
                  </span>
                )}
                <button className="text-[#64748b] hover:text-white text-xs px-1 transition-colors">
                  View
                </button>
                <button
                  onClick={() => onDeletePin(pin.id)}
                  className="text-[#ef4444] hover:text-red-300 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
              {pin.description && (
                <p className="text-[10px] text-[#64748b] mt-1 pl-8">
                  {pin.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Export */}
      <div className="px-3 py-2 border-t border-[#333355]">
        <button
          onClick={() => {
            const json = JSON.stringify(pins, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            triggerDownload(url, 'annotations.json');
            setTimeout(() => URL.revokeObjectURL(url), 5_000);
          }}
          className="w-full py-1.5 text-xs text-[#94a3b8] hover:text-white border border-[#333355] rounded-lg transition-colors hover:border-[#7c3aed]"
        >
          Export as JSON
        </button>
      </div>
    </div>
  );
}
