'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { BatchGalleryOverlay } from './BatchGalleryOverlay';

interface BatchUploadProps {
  /** Currently queued files */
  files: File[];
  /** Called whenever the file list changes */
  onFiles: (fs: File[]) => void;
  /** Max number of files allowed (default 20) */
  maxFiles?: number;
}

/**
 * Multi-image batch upload dropzone.
 * Supports drag-and-drop and click-to-browse.
 * Uploaded images are shown as rounded thumbnail pill buttons.
 * Clicking any pill opens a BatchGalleryOverlay with a grid + enlarged preview.
 */
export function BatchImageUpload({
  files,
  onFiles,
  maxFiles = 20,
}: BatchUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Stable object-URL list — revoked when files are removed or component unmounts
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    // Build new object URLs
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)].slice(0, maxFiles);
    onFiles(next);
  };

  const remove = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onFiles(files.filter((_, idx) => idx !== i));
  };

  const openGallery = (i: number) => {
    setGalleryStart(i);
    setGalleryOpen(true);
  };

  return (
    <div className="space-y-2">
      {/* ── Dropzone ── */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="w-full rounded-lg bg-[#252542] border-2 border-dashed border-[#333355] hover:border-[#D5B451]/60 flex flex-col items-center justify-center gap-1 py-5 cursor-pointer transition-colors"
      >
        <span className="text-xl opacity-40">📦</span>
        <p className="text-[#64748b] text-xs">Drop images here</p>
        <p className="text-[#4b5563] text-[10px]">Up to {maxFiles} images</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* ── Thumbnail pill buttons ── */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <button
              key={i}
              onClick={() => openGallery(i)}
              className="relative group flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full transition-colors"
              style={{
                background: '#1e1e36',
                border: '1px solid #333355',
              }}
              title={files[i]?.name ?? `Image ${i + 1}`}
            >
              {/* Thumbnail */}
              <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Thumbnail ${i + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </span>

              {/* Index */}
              <span
                className="text-[10px] font-mono"
                style={{ color: '#94a3b8' }}
              >
                {i + 1}
              </span>

              {/* Remove × */}
              <span
                onClick={(e) => remove(i, e)}
                className="flex items-center justify-center w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#ef4444]/20"
                style={{ color: '#ef4444' }}
                role="button"
                aria-label={`Remove image ${i + 1}`}
              >
                <X className="w-2.5 h-2.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Count line */}
      {previews.length > 0 && (
        <p className="text-[10px] text-[#64748b] text-right">
          {files.length} image{files.length !== 1 ? 's' : ''} queued
          {files.length < maxFiles && (
            <span className="ml-1 text-[#4b5563]">
              · {maxFiles - files.length} remaining
            </span>
          )}
        </p>
      )}

      {/* ── Gallery Overlay ── */}
      {galleryOpen && (
        <BatchGalleryOverlay
          previews={previews}
          initialIndex={galleryStart}
          onClose={() => setGalleryOpen(false)}
          onRemove={(i) => {
            const next = files.filter((_, idx) => idx !== i);
            onFiles(next);
            if (next.length === 0) setGalleryOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default BatchImageUpload;
