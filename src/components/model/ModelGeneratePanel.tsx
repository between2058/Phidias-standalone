'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Toggle,
  PillGroup,
  CollapsibleSection,
} from '@/components/ui/ProgressBar';
import type {
  ProgressUpdate,
  GenerateModelRequest,
  QwenText2ImgParams,
  GenerationParams,
} from '@/lib/api/types';
import { SingleImageUpload, BatchImageUpload } from '@/components/shared';
import { usePhidiasStore } from '@/store/phidias-store';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ModelGeneratePanelProps {
  /** Called with the fully-assembled request when the user clicks Generate */
  onGenerate: (params: GenerateModelRequest) => void;
  isGenerating: boolean;
  progress: ProgressUpdate | null;
  /** Preview URL of the Qwen-generated image, managed by the parent page */
  text2ImgPreviewUrl?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type InputMode = 'image' | 'multiview' | 'text' | 'batch';

const INPUT_MODES: { id: InputMode; icon: string; label: string }[] = [
  { id: 'image', icon: '📷', label: 'Image' },
  { id: 'multiview', icon: '🔲', label: 'Multi-view' },
  { id: 'text', icon: '✏️', label: 'Text' },
  { id: 'batch', icon: '📦', label: 'Batch' },
];

const TEXTURE_SIZE_OPTIONS = [512, 1024, 2048];

const DEFAULT_SS: GenerationParams = {
  guidance_strength: 7.5,
  sampling_steps: 12,
};
const DEFAULT_SHAPSLAT: GenerationParams = {
  guidance_strength: 3.0,
  sampling_steps: 12,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (local, no API deps)
// ─────────────────────────────────────────────────────────────────────────────

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

function StageSliders({
  label,
  params,
  onChange,
}: {
  label: string;
  params: GenerationParams;
  onChange: (p: GenerationParams) => void;
}) {
  const set = (key: keyof GenerationParams, val: number) =>
    onChange({ ...params, [key]: val });
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold text-[#D5B451] uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="space-y-2">
        <SliderRow
          label="Guidance Strength"
          value={params.guidance_strength}
          min={0.0}
          max={10.0}
          step={0.1}
          onChange={(v) => set('guidance_strength', v)}
          display={(v) => v.toFixed(1)}
        />
        <SliderRow
          label="Sampling Steps"
          value={params.sampling_steps}
          min={1}
          max={50}
          step={1}
          onChange={(v) => set('sampling_steps', v)}
          display={(v) => String(v)}
        />
      </div>
    </div>
  );
}

function SeedTooltip() {
  return (
    <span className="relative group inline-flex items-center">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#333355] text-[#94a3b8] text-[9px] font-bold cursor-help select-none leading-none">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-[#1a1a2e] border border-[#333355] px-3 py-2 text-[11px] text-[#cbd5e1] leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        Enable this to let the AI start from a new point each time for fresh,
        unpredictable results. Disable it to lock the AI&apos;s path, ensuring
        you get the same consistent response every time.
        <span className="absolute top-full left-3 border-4 border-transparent border-t-[#333355]" />
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component — UI only, no API calls
// ─────────────────────────────────────────────────────────────────────────────

export default function ModelGeneratePanel({
  onGenerate,
  isGenerating,
  progress,
  text2ImgPreviewUrl,
}: ModelGeneratePanelProps) {
  // Cross-page image routing (Zustand store only — no API)
  const setPreviewImage = usePhidiasStore((s) => s.setPreviewImage);
  const pendingModelImage = usePhidiasStore((s) => s.pendingModelImage);
  const setPendingModelImage = usePhidiasStore((s) => s.setPendingModelImage);
  const pendingMultiViewImages = usePhidiasStore(
    (s) => s.pendingMultiViewImages,
  );
  const setPendingMultiViewImages = usePhidiasStore(
    (s) => s.setPendingMultiViewImages,
  );

  // ── Mode ────────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('image');

  // ── Image mode ──────────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | undefined>();

  useEffect(() => {
    if (!pendingModelImage) return;
    setInputMode('image');
    setImageFile(undefined);
    fetch(pendingModelImage)
      .then((r) => r.blob())
      .then((blob) =>
        setImageFile(
          new File([blob], 'generated-image.png', {
            type: blob.type || 'image/png',
          }),
        ),
      )
      .catch((err) => console.error('Failed to load pending image', err))
      .finally(() => setPendingModelImage(null));
  }, [pendingModelImage, setPendingModelImage]);

  // ── Multi-view mode ─────────────────────────────────────────────────────
  const [multiViewFiles, setMultiViewFiles] = useState<File[]>([]);
  const [multiViewMode, setMultiViewMode] = useState<
    'stochastic' | 'multidiffusion'
  >('stochastic');

  useEffect(() => {
    if (!pendingMultiViewImages?.length) return;
    setInputMode('multiview');
    setMultiViewFiles([]);
    Promise.all(
      pendingMultiViewImages.map((url, i) =>
        fetch(url)
          .then((r) => r.blob())
          .then(
            (blob) =>
              new File([blob], `multiview-${i}.png`, {
                type: blob.type || 'image/png',
              }),
          ),
      ),
    )
      .then(setMultiViewFiles)
      .catch((err) =>
        console.error('Failed to load pending multiview images', err),
      )
      .finally(() => setPendingMultiViewImages(null));
  }, [pendingMultiViewImages, setPendingMultiViewImages]);

  // ── Text mode (Qwen params only — no API call) ──────────────────────────
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'low quality, bad anatomy, blurry, distorted',
  );
  const [qwenSteps, setQwenSteps] = useState(50);
  const [cfgScale, setCfgScale] = useState(4.0);
  const [qwenSeed, setQwenSeed] = useState(0);
  const [qwenRandomizeSeed, setQwenRandomizeSeed] = useState(true);

  // ── Batch mode ──────────────────────────────────────────────────────────
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  // ── TRELLIS.2 output params ─────────────────────────────────────────────
  const [resolution] = useState<'512' | '1024' | '1536'>('1024');
  const [seed, setSeed] = useState(0);
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [preprocessImage] = useState(true);
  const [decimationTarget] = useState(500000);
  const [textureSize, setTextureSize] = useState(2048);
  const [ss, setSs] = useState<GenerationParams>(DEFAULT_SS);
  const [shapSlat, setShapSlat] = useState<GenerationParams>(DEFAULT_SHAPSLAT);

  // ── Validation ──────────────────────────────────────────────────────────
  const canGenerate =
    !isGenerating &&
    (inputMode === 'text'
      ? prompt.trim().length > 0
      : inputMode === 'batch'
        ? batchFiles.length > 0
        : true);

  // ── Assemble and emit ────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!canGenerate) return;

    const common = {
      resolution,
      seed: randomizeSeed ? 0 : seed,
      randomizeSeed,
      preprocessImage,
      decimationTarget,
      textureSize,
      ss,
      shapSlat,
      texSlat: {
        guidance_strength: 1.0,
        sampling_steps: 12,
      } as GenerationParams,
    };

    if (inputMode === 'image') {
      if (!imageFile) return;
      onGenerate({ inputMode, image: imageFile, ...common });
    } else if (inputMode === 'multiview') {
      if (multiViewFiles.length === 0) return;
      onGenerate({
        inputMode,
        images: multiViewFiles,
        multiViewMode,
        ...common,
      });
    } else if (inputMode === 'text') {
      if (!prompt.trim()) return;
      const qwen: QwenText2ImgParams = {
        prompt: prompt.trim(),
        negativePrompt,
        aspectRatio: '1:1',
        numSteps: qwenSteps,
        cfgScale,
        seed: qwenRandomizeSeed ? 0 : qwenSeed,
        randomizeSeed: qwenRandomizeSeed,
      };
      onGenerate({ inputMode, qwen, ...common });
    } else if (inputMode === 'batch') {
      if (batchFiles.length === 0) return;
      onGenerate({ inputMode, batchImages: batchFiles, ...common });
    }
  };

  // ── Labels ───────────────────────────────────────────────────────────────
  const TITLES: Record<InputMode, string> = {
    image: 'Single image',
    multiview: 'Multi-view images',
    text: 'Text',
    batch: 'Batch images',
  };
  const DESCS: Record<InputMode, string> = {
    image: 'Generate a 3D model from a single image',
    multiview: 'Generate a 3D model from multi-view images of an object',
    text: 'Generate a 3D model from text',
    batch: 'Generate multiple 3D models from multiple images',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style jsx>{`
        .btn-gradient {
          position: relative;
          overflow: hidden;
        }
        .gradient-bg {
          position: absolute;
          inset: 0;
          border-radius: inherit;
        }
        .bg1 {
          background: linear-gradient(135deg, #22c55e, #f5a623);
        }
        .bg2 {
          background: linear-gradient(135deg, #f5a623, #22c55e);
          opacity: 0;
        }
        @keyframes bgFade {
          0%,
          100% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }
        .bg2.animate {
          animation: bgFade 1s ease-in-out infinite;
        }
        .btn-content {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
        }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.12);
          border-top-color: #1a1a2e;
          border-radius: 50%;
          display: inline-block;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
        <h2 className="text-sm font-semibold text-white">
          {TITLES[inputMode]}
        </h2>
        <p className="text-[10px] text-[#64748b] mt-0.5">{DESCS[inputMode]}</p>
      </div>

      {/* Mode tabs */}
      <div className="px-4 py-3 overflow-y-auto border-b border-[#333355]">
        <div className="flex gap-1.5">
          {INPUT_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setInputMode(mode.id)}
              title={mode.label}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors text-xs',
                inputMode === mode.id
                  ? 'text-white'
                  : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a] hover:text-white',
              )}
              style={
                inputMode === mode.id
                  ? { background: '#0E243E', border: '1px solid #D5B451' }
                  : {}
              }
            >
              <span className="text-sm">{mode.icon}</span>
              <span className="text-[9px]">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable settings */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {/* ── IMAGE MODE ── */}
        {inputMode === 'image' && (
          <SingleImageUpload
            label="Upload image"
            onFile={setImageFile}
            file={imageFile}
          />
        )}

        {/* ── MULTIVIEW MODE ── */}
        {inputMode === 'multiview' && (
          <div className="space-y-2">
            <BatchImageUpload
              files={multiViewFiles}
              onFiles={setMultiViewFiles}
              maxFiles={4}
            />
            <div>
              <p className="text-xs text-[#94a3b8] mb-1">Diffusion Mode</p>
              <PillGroup
                options={['stochastic', 'multidiffusion']}
                value={multiViewMode}
                onChange={(v) =>
                  setMultiViewMode(v as 'stochastic' | 'multidiffusion')
                }
              />
            </div>
          </div>
        )}

        {/* ── TEXT MODE ── */}
        {inputMode === 'text' && (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] text-[#94a3b8]"
              style={{ background: '#0E243E' }}
            >
              <span>✏️</span>
              <span className="flex-1">Text → Image generation → 3D Model</span>
            </div>

            {/* Prompt */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#94a3b8]">Prompt</label>
                <span className="text-[10px] text-[#4b5563]">
                  {prompt.length}/800
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 800))}
                placeholder="Describe the image you want to generate..."
                className="w-full h-20 bg-[#252542] border border-[#333355] rounded-lg text-xs text-white placeholder-[#4b5563] p-2.5 resize-none focus:outline-none focus:border-[#D5B451]"
              />
            </div>

            {/* Qwen preview (URL injected by page) */}
            {text2ImgPreviewUrl && (
              <div
                className="rounded-lg overflow-hidden border border-[#333355] cursor-pointer relative group"
                onClick={() => setPreviewImage(text2ImgPreviewUrl)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={text2ImgPreviewUrl}
                  alt="Generated preview"
                  className="w-full object-cover"
                  style={{ maxHeight: '160px' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-lg">
                    🔍
                  </span>
                </div>
                <div className="absolute bottom-1 left-1.5 text-[10px] text-[#94a3b8] bg-black/50 px-1.5 py-0.5 rounded">
                  Image Preview
                </div>
              </div>
            )}

            {/* Image Generation Settings */}
            <CollapsibleSection title="Image Generation Settings">
              <div className="space-y-2 pt-1">
                {/* Negative Prompt */}
                <div>
                  <p className="text-[11px] text-[#94a3b8] mb-1">
                    Negative Prompt
                  </p>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="w-full h-14 bg-[#252542] border border-[#333355] rounded-lg text-xs text-white placeholder-[#4b5563] p-2.5 resize-none focus:outline-none focus:border-[#D5B451]"
                  />
                </div>
                {/* Seed */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <span className="text-[11px] text-[#94a3b8]">Seed</span>
                      <SeedTooltip />
                    </span>
                    <Toggle
                      label="Random"
                      checked={qwenRandomizeSeed}
                      onChange={setQwenRandomizeSeed}
                    />
                  </div>
                  {!qwenRandomizeSeed && (
                    <input
                      type="number"
                      value={qwenSeed}
                      onChange={(e) =>
                        setQwenSeed(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#D5B451]"
                      min={0}
                      max={2147483647}
                    />
                  )}
                </div>
                <SliderRow
                  label="Steps"
                  value={qwenSteps}
                  min={10}
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

        {/* ── BATCH MODE ── */}
        {inputMode === 'batch' && (
          <BatchImageUpload files={batchFiles} onFiles={setBatchFiles} />
        )}

        {/* ── OUTPUT SETTINGS (all modes) ── */}
        <div className="border-t border-[#333355] pt-3 space-y-2">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
            Output Settings
          </p>

          {/* Resolution */}
          {/* <div>
                        <p className="text-xs text-[#e2e8f0] mb-1.5">Resolution</p>
                        <div className="flex gap-1">
                            {RESOLUTION_OPTIONS.map(({ value, label, desc }) => (
                                <button key={value} onClick={() => setResolution(value)}
                                    className={cn('flex-1 flex flex-col items-center py-2 rounded-lg text-xs transition-colors',
                                        resolution === value ? 'text-white' : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]')}
                                    style={resolution === value ? { background: '#0E243E', border: '1px solid #D5B451' } : {}}>
                                    <span className="font-mono font-bold">{label}</span>
                                    <span className="text-[9px] opacity-60">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div> */}

          {/* Seed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <span className="text-xs text-[#e2e8f0]">Seed</span>
                <SeedTooltip />
              </span>
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
                className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-[#D5B451]"
                min={0}
                max={2147483647}
              />
            )}
          </div>

          {/* Texture Size */}
          <div>
            <p className="text-xs text-[#e2e8f0] mb-1">Texture Size</p>
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

        {/* Advanced: per-stage TRELLIS.2 sliders */}
        <CollapsibleSection title="Advanced Settings">
          <div className="space-y-1 pt-1">
            <StageSliders
              label="Stage 1 — Sparse Structure"
              params={ss}
              onChange={setSs}
            />
            <div className="border-t border-[#333355] my-2" />
            <StageSliders
              label="Stage 2 — Shape"
              params={shapSlat}
              onChange={setShapSlat}
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* CTA */}
      <div className="p-4 border-t border-[#333355]">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate && !isGenerating}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] transition-opacity hover:opacity-90 btn-gradient',
            isGenerating ? 'generating' : '',
          )}
        >
          <span className="gradient-bg bg1" aria-hidden />
          <span
            className={`gradient-bg bg2${isGenerating ? ' animate' : ''}`}
            aria-hidden
          />
          <span className="btn-content">
            {isGenerating && progress ? (
              <>
                <span className="spinner" aria-hidden />
                <span>
                  {progress.stage || 'Generating...'}
                  {progress.percent ? ` ${progress.percent}%` : ''}
                </span>
              </>
            ) : (
              <span>
                {inputMode === 'batch'
                  ? `✨ Generate Batch (${batchFiles.length})`
                  : '✨ Generate'}
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
