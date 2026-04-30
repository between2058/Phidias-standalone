'use client';

import React from 'react';
import { X } from 'lucide-react';
import { usePhidiasStore } from '@/store/phidias-store';

/**
 * Full-screen image overlay that displays the previewImage from the Phidias zustand store.
 * Clicking the backdrop or the X button dismisses it.
 * Mount this once at a high level in the layout so it is always available.
 */
export function ImageOverlay() {
  const previewImage = usePhidiasStore((s) => s.previewImage);
  const setPreviewImage = usePhidiasStore((s) => s.setPreviewImage);
  if (!previewImage) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setPreviewImage(null)}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] shadow-2xl rounded-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-white bg-black/30 hover:bg-black/50 rounded-full z-10 backdrop-blur-sm transition-colors"
          onClick={() => setPreviewImage(null)}
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewImage}
          alt="Preview"
          className="w-full h-full object-contain max-h-[90vh]"
        />
      </div>
    </div>
  );
}

export default ImageOverlay;
