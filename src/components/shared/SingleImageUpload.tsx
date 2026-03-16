'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePhidiasStore } from '@/store/phidias-store';

interface SingleImageUploadProps {
  /** Label shown in the empty state */
  label?: string;
  /** Callback fired when the user selects or drops a file, or undefined when cleared */
  onFile?: (f: File | undefined) => void;
  /** Optional controllable file prop for external updates */
  file?: File | null;
}

/**
 * A single-image upload dropzone with:
 * - drag-and-drop or click-to-browse
 * - preview after upload
 * - X button to clear the selected file
 * - double-click preview to open the full-screen ImageOverlay
 */
export function SingleImageUpload({
  label = 'Upload image',
  onFile,
  file,
}: SingleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const setPreviewImage = usePhidiasStore((s) => s.setPreviewImage);

  // Sync external file prop to local preview
  useEffect(() => {
    if (file === null) {
      setLocalPreview(null);
    } else if (file) {
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleFile = (f: File) => {
    if (file === undefined) {
      const url = URL.createObjectURL(f);
      setLocalPreview(url);
    }
    onFile?.(f);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file === undefined) {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    onFile?.(undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onClick={() => !localPreview && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      className="aspect-square rounded-lg bg-[#252542] border-2 border-dashed border-[#333355] hover:border-[#D5B451]/60 flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden relative"
      style={{ cursor: localPreview ? 'default' : 'pointer' }}
    >
      {localPreview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localPreview}
            alt="preview"
            className="w-full h-full object-cover"
            onDoubleClick={() => setPreviewImage(localPreview)}
            title="Double-click to enlarge"
          />
          {/* Clear button */}
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors z-10"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="text-2xl opacity-40">📷</span>
          <p className="text-[#64748b] text-xs">{label}</p>
          <p className="text-[#4b5563] text-[10px]">PNG / JPG / RGBA</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

export default SingleImageUpload;
