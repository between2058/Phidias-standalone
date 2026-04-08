'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ProgressBar,
  Toggle,
  CollapsibleSection,
} from '@/components/ui/ProgressBar';
import type { ProgressUpdate, TextureRequest } from '@/lib/api/types';

interface TextureGeneratePanelProps {
  onGenerate: (params: TextureRequest) => void;
  isGenerating: boolean;
  progress: ProgressUpdate | null;
  /** Whether a model is currently loaded in the viewport */
  hasActiveModel: boolean;
  /** Preview URL of the Qwen-styled reference image */
  text2ImgPreviewUrl?: string | null;
}

const RESOLUTION_OPTIONS = [
  { value: '512', label: '512', desc: 'Fast' },
  { value: '1024', label: '1024', desc: 'Standard' },
  { value: '1536', label: '1536', desc: 'Ultra HD' },
] as const;

const TEXTURE_SIZE_OPTIONS = [1024, 2048, 3072, 4096];

interface Trellis2StageParams {
  guidance_strength: number;
  guidance_rescale: number;
  sampling_steps: number;
  rescale_t: number;
}

const DEFAULT_TEX_SLAT: Trellis2StageParams = {
  guidance_strength: 1.0,
  guidance_rescale: 0.0,
  sampling_steps: 12,
  rescale_t: 3.0,
};

// ── Slider row ────────────────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-[#94a3b8]">{label}</span>
        <span className="text-[11px] text-white font-mono">
          {display(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-[#333355] accent-[#D5B451]"
      />
    </div>
  );
}

// ── Image upload drop-zone ────────────────────────────────────────────────────
function ImageUpload({
  onFile,
  label,
}: {
  file?: File;
  onFile: (f: File) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handle = (f: File) => {
    setPreview(URL.createObjectURL(f));
    onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handle(f);
      }}
      className="aspect-square rounded-lg border-2 border-dashed border-[#333355] hover:border-[#D5B451]/60 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[#252542] overflow-hidden relative"
    >
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="reference"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-[#94a3b8] text-center py-1">
            click to replace
          </div>
        </>
      ) : (
        <>
          <span className="text-2xl opacity-40">🖼</span>
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
          if (f) handle(f);
        }}
      />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function TextureGeneratePanel({
  onGenerate,
  isGenerating,
  progress,
  hasActiveModel,
  text2ImgPreviewUrl,
}: TextureGeneratePanelProps) {
  const [mode, setMode] = useState<'image' | 'text'>('image');

  // image mode
  const [referenceImage, setReferenceImage] = useState<File | undefined>();

  // text mode (Qwen /edit)
  const [prompt, setPrompt] = useState('');
  const [qwenSteps, setQwenSteps] = useState(40);
  const [cfgScale, setCfgScale] = useState(4.0);

  // TRELLIS.2 common
  const [resolution, setResolution] = useState<'512' | '1024' | '1536'>('1024');
  const [seed, setSeed] = useState(0);
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [textureSize, setTextureSize] = useState(2048);
  const [texSlat, setTexSlat] = useState<Trellis2StageParams>(DEFAULT_TEX_SLAT);

  const canGenerate =
    !isGenerating &&
    hasActiveModel &&
    (mode === 'image' ? !!referenceImage : prompt.trim().length > 0);

  const handleGenerate = () => {
    if (!canGenerate) return;
    onGenerate({
      mode,
      referenceImage: mode === 'image' ? referenceImage : undefined,
      prompt: mode === 'text' ? prompt : undefined,
      qwenSteps: mode === 'text' ? qwenSteps : undefined,
      cfgScale: mode === 'text' ? cfgScale : undefined,
      resolution,
      seed,
      randomizeSeed,
      textureSize,
      texSlat,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
        <h2 className="text-sm font-semibold text-white">Texture Mesh</h2>
        <p className="text-[10px] text-[#64748b] mt-0.5">
          TRELLIS.2 Texturing Pipeline
        </p>
      </div>

      {/* Mode tabs */}
      <div className="px-4 py-3 border-b border-[#333355]">
        <div className="flex bg-[#1a1a2e] rounded-lg p-1 gap-1">
          {(
            [
              ['image', '🖼', 'Image'],
              ['text', '✏️', 'Text'],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn(
                'flex-1 py-2 text-xs rounded-md transition-colors flex items-center justify-center gap-1.5',
                mode === id ? 'text-white' : 'text-[#94a3b8] hover:text-white',
              )}
              style={
                mode === id
                  ? { background: '#0E243E', border: '1px solid #D5B451' }
                  : {}
              }
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
        {/* Active model indicator */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{
            background: hasActiveModel ? '#0E243E' : '#2a1a1a',
            borderLeft: `3px solid ${hasActiveModel ? '#D5B451' : '#ef4444'}`,
          }}
        >
          <span>{hasActiveModel ? '✅' : '⚠️'}</span>
          <span
            className={hasActiveModel ? 'text-[#94a3b8]' : 'text-[#ef4444]'}
          >
            {hasActiveModel
              ? 'Current model will be textured'
              : 'No model loaded — generate one first'}
          </span>
        </div>

        {/* ── IMAGE MODE ── */}
        {mode === 'image' && (
          <div className="space-y-2">
            <p className="text-xs text-[#94a3b8]">Reference Image</p>
            <ImageUpload
              file={referenceImage}
              onFile={setReferenceImage}
              label="Upload reference image"
            />
            <p className="text-[10px] text-[#4b5563]">
              Image will be auto-preprocessed before texturing.
            </p>
          </div>
        )}

        {/* ── TEXT MODE ── */}
        {mode === 'text' && (
          <div className="space-y-3">
            {/* Pipeline explanation */}
            <div
              className="rounded-lg px-3 py-2.5 text-[11px] text-[#94a3b8] space-y-1"
              style={{ background: '#0E243E' }}
            >
              <div className="flex items-center gap-2 font-medium text-[#D5B451]">
                <span>✏️</span> Viewport Screenshot → Qwen Edit → TRELLIS.2
              </div>
              <p className="leading-relaxed">
                A screenshot of the current viewport will be captured and styled by Qwen based on your prompt, then used as reference for texturing.
              </p>
            </div>

            {/* Qwen preview */}
            {text2ImgPreviewUrl && (
              <div className="rounded-lg overflow-hidden border border-[#333355]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={text2ImgPreviewUrl}
                  alt="Styled reference"
                  className="w-full object-cover"
                  style={{ maxHeight: '160px' }}
                />
                <div className="text-[10px] text-[#94a3b8] bg-black/50 px-2 py-1 text-center">
                  Styled Reference Image
                </div>
              </div>
            )}

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#94a3b8]">Texture Prompt</label>
                <span className="text-[10px] text-[#4b5563]">
                  {prompt.length}/400
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
                placeholder="Rusted iron with oxidized surface... sci-fi metallic panels... worn leather..."
                className="w-full h-20 bg-[#252542] border border-[#333355] rounded-lg text-xs text-white placeholder-[#4b5563] p-2.5 resize-none focus:outline-none focus:border-[#D5B451]"
              />
            </div>

            {/* Qwen edit settings */}
            <CollapsibleSection title="Qwen Style Transfer Settings">
              <div className="space-y-2 pt-1">
                <SliderRow
                  label="Steps"
                  value={qwenSteps}
                  min={4}
                  max={50}
                  step={1}
                  onChange={setQwenSteps}
                  display={(v) => String(v)}
                />
                <SliderRow
                  label="CFG Scale"
                  value={cfgScale}
                  min={1.0}
                  max={8.0}
                  step={0.1}
                  onChange={setCfgScale}
                  display={(v) => v.toFixed(1)}
                />
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[#333355]" />

        {/* TRELLIS.2 settings */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
            TRELLIS.2 Settings
          </p>

          {/* Resolution */}
          <div>
            <p className="text-xs text-[#e2e8f0] mb-1.5">Resolution</p>
            <div className="flex gap-1">
              {RESOLUTION_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setResolution(value)}
                  className={cn(
                    'flex-1 flex flex-col items-center py-2 rounded-lg text-xs transition-colors',
                    resolution === value
                      ? 'text-white'
                      : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                  )}
                  style={
                    resolution === value
                      ? { background: '#0E243E', border: '1px solid #D5B451' }
                      : {}
                  }
                >
                  <span className="font-mono font-bold">{label}</span>
                  <span className="text-[9px] opacity-60">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#e2e8f0]">Seed</span>
              <Toggle
                label="Random"
                checked={randomizeSeed}
                onChange={setRandomizeSeed}
              />
            </div>
            {!randomizeSeed && (
              <input
                type="number"
                value={seed}
                onChange={(e) =>
                  setSeed(Math.max(0, parseInt(e.target.value) || 0))
                }
                min={0}
                max={2147483647}
                className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-[#D5B451]"
              />
            )}
          </div>

          {/* Texture Size */}
          <div>
            <p className="text-xs text-[#e2e8f0] mb-1.5">Texture Size</p>
            <div className="flex gap-1">
              {TEXTURE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => setTextureSize(size)}
                  className={cn(
                    'flex-1 py-1.5 text-[11px] rounded-lg transition-colors font-mono',
                    textureSize === size
                      ? 'text-white'
                      : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                  )}
                  style={
                    textureSize === size
                      ? { background: '#0E243E', border: '1px solid #D5B451' }
                      : {}
                  }
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced settings removed — Trellis.2 /texture only exposes seed, resolution, texture_size */}
      </div>

      {/* CTA */}
      <div className="p-4 border-t border-[#333355]">
        {isGenerating && progress ? (
          <ProgressBar
            percent={progress.percent}
            stage={progress.stage}
            color="gold"
          />
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #D5B451, #f5c842)',
              color: '#0E243E',
            }}
          >
            Generate Texture
          </button>
        )}
      </div>
    </div>
  );
}
