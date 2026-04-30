'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchGalleryOverlayProps {
  /** Object-URL strings for each uploaded file (created by parent) */
  previews: string[];
  /** Index to start with selected */
  initialIndex?: number;
  /** Called when the overlay should close */
  onClose: () => void;
  /** Called with the index to remove when the user clicks Remove */
  onRemove?: (index: number) => void;
}

/**
 * Full-screen gallery overlay.
 * Left: scrollable grid of thumbnails.
 * Right: enlarged preview of the selected image.
 * Clicking the dark backdrop or the X button closes the overlay.
 */
export function BatchGalleryOverlay({
  previews,
  initialIndex = 0,
  onClose,
  onRemove,
}: BatchGalleryOverlayProps) {
  const [selected, setSelected] = useState(initialIndex);

  const handleRemove = (i: number) => {
    if (!onRemove) return;
    onRemove(i);
    const next =
      previews.length - 1 === 0
        ? -1
        : Math.max(0, i <= selected ? selected - 1 : selected);
    if (next === -1) {
      onClose();
      return;
    }
    setSelected(next);
  };

  // Reset selection if previews array changes size
  useEffect(() => {
    setSelected((prev) => Math.min(prev, previews.length - 1));
  }, [previews.length]);

  // Keyboard: arrow keys to navigate, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setSelected((p) => Math.min(p + 1, previews.length - 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setSelected((p) => Math.max(p - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previews.length, onClose]);

  if (!previews.length) return null;

  const currentSrc = previews[selected];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Panel — stops click propagation */}
      <div
        className="relative flex rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        style={{
          background: '#13132a',
          border: '1px solid #333355',
          maxWidth: '90vw',
          maxHeight: '90vh',
          width: 900,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white bg-black/40 hover:bg-black/70 rounded-full z-20 backdrop-blur-sm transition-colors"
          onClick={onClose}
          aria-label="Close gallery"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Left: thumbnail grid ── */}
        <div
          className="w-56 flex-shrink-0 overflow-y-auto scrollbar-thin p-3"
          style={{ borderRight: '1px solid #333355', maxHeight: '90vh' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
            style={{ color: '#64748b' }}
          >
            {previews.length} image{previews.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative">
                <button
                  onClick={() => setSelected(i)}
                  className={cn(
                    'relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150',
                    selected === i
                      ? 'border-[#7c3aed] ring-1 ring-[#7c3aed]/40 scale-[0.97]'
                      : 'border-[#333355] hover:border-[#7c3aed]/50',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Image ${i + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  {/* Index badge */}
                  <span
                    className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#a78bfa' }}
                  >
                    {i + 1}
                  </span>
                </button>

                {/* Red × remove button */}
                {onRemove && (
                  <button
                    onClick={() => handleRemove(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-10 transition-opacity"
                    style={{
                      background: '#ef4444',
                      border: '1.5px solid #1a1a2e',
                    }}
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: enlarged preview ── */}
        <div
          className="flex-1 flex items-center justify-center p-4"
          style={{ maxHeight: '90vh' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={currentSrc}
            src={currentSrc}
            alt={`Preview ${selected + 1}`}
            className="max-w-full max-h-full object-contain rounded-xl animate-in fade-in duration-150"
            draggable={false}
          />
        </div>

        {/* Navigation hint */}
        <div
          className="absolute bottom-3 left-3 text-[10px]"
          style={{ color: '#4b5563' }}
        >
          ← → to navigate · Esc to close
        </div>
      </div>
    </div>
  );
}

export default BatchGalleryOverlay;
