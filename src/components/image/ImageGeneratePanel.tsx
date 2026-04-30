'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Toggle,
  CollapsibleSection,
} from '@/components/ui/ProgressBar';
import type { ProgressUpdate } from '@/lib/api/types';
import { SingleImageUpload } from '@/components/shared';

// Local slider row (mirrors GeneratePanel's SliderRow)
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

interface ImageGeneratePanelProps {
  onGenerate: (
    prompt: string,
    samples: number,
    aspectRatio: string,
    referenceImage: File | null,
    generateMultiview: boolean,
    steps: number,
    cfgScale: number,
    negativePrompt: string,
    qwenSeed: number,
  ) => void;
  isGenerating: boolean;
  progress: ProgressUpdate | null;
  /** Whether the Qwen service has available connection slots */
  isConnectionAvailable?: boolean;
  /** Number of remaining connection slots (0–2) */
  remainingSlots?: number;
}

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
// const HASHTAGS = ['#3D model', '#character', '#robot', '#vehicle', '#creature'];

export default function ImageGeneratePanel({
  onGenerate,
  isGenerating,
  progress,
  isConnectionAvailable = true,
  remainingSlots = 2,
}: ImageGeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [generateMultiview, setGenerateMultiview] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [negativePrompt, setNegativePrompt] = useState(
    'low quality, bad anatomy, blurry, distorted',
  );
  const [qwenSteps, setQwenSteps] = useState(50);
  const [cfgScale, setCfgScale] = useState(4.0);
  const [qwenSeed, setQwenSeed] = useState(0);
  const [qwenRandomizeSeed, setQwenRandomizeSeed] = useState(true);

  // Determine what API will be called so the button label reflects the actual action
  // When generateMultiview is enabled with a reference image, submit as angle-multi
  const jobType: 'text2img' | 'edit' | 'angle-multi' =
    referenceImage && generateMultiview
      ? 'angle-multi'
      : referenceImage
        ? 'edit'
        : 'text2img';

  const JOB_LABELS: Record<typeof jobType, string> = {
    'text2img': 'Submit Image Generation',
    'edit': 'Submit Image Edit',
    'angle-multi': 'Submit Multi-view',
  };

  const submitLabel = JOB_LABELS[jobType];

  return (
    <div className="flex flex-col h-full">
      {/* Gradient swap animation style + spinner */}
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

        /* Smooth crossfade: 0 -> 1 in 0.5s, then back to 0 in next 0.5s */
        @keyframes bgFade {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
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

        /* Spinner */
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

        /* keep button text readable when disabled */
        button[disabled] .btn-content {
          opacity: 0.9;
        }
      `}</style>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
          <h2 className="text-sm font-semibold text-white">New Image</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Prompt */}
          <div>
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#94a3b8]">Prompt</label>
                <span className="text-[10px] text-[#4b5563]">
                  {prompt.length}/800
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={generateMultiview ? "Prompt disabled for multi-view generation" : "Describe the image you want to generate..."}
                maxLength={800}
                disabled={generateMultiview}
                className={cn(
                  "w-full h-28 bg-[#252542] border border-[#333355] rounded-lg text-sm placeholder-[#64748b] p-3 resize-none pr-16",
                  generateMultiview
                    ? "text-[#64748b] cursor-not-allowed opacity-60"
                    : "text-white focus:outline-none focus:border-[#7c3aed]"
                )}
              />
            </div>
            {generateMultiview && (
              <p className="text-[10px] text-[#f5a623] mt-1">
                Prompt is disabled for multi-view generation — the model will generate views based on your reference image only.
              </p>
            )}
            <div className="flex items-center justify-between mt-1">
              <div className="flex flex-wrap gap-1">
                {/* {HASHTAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleHashtag(tag)}
                  className="px-2 py-0.5 text-[10px] rounded-full bg-[#252542] text-[#94a3b8] hover:bg-[#7c3aed] hover:text-white transition-colors"
                >
                  {tag}
                </button>
              ))} */}
              </div>
              {/* <span className="text-[10px] text-[#64748b] ml-2 shrink-0">{prompt.length}/800</span> */}
            </div>
          </div>

          {/* AI Model */}
          {/* <div>
                    <p className="text-xs text-[#94a3b8] mb-1.5">AI Model</p>
                    <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7c3aed]"
                    >
                        <option value="Flux">Flux</option>
                        <option value="Nano Banana">Nano Banana</option>
                    </select>
                    <div className="mt-1.5 p-2 rounded-lg bg-[#252542]/50 border border-[#333355]">
                        <p className="text-[10px] text-[#64748b]">
                            {aiModel === 'Flux' ? '⚡ Fast generation with excellent quality' : '🍌 Fun creative style, great for characters'}
                        </p>
                    </div>
                </div> */}

          {/* Reference Image */}
          <div>
            <p className="text-xs text-[#94a3b8] mb-1.5">
              Reference Image (optional)
            </p>
            <SingleImageUpload
              label="Drop image or click to upload"
              onFile={(f) => setReferenceImage(f ?? null)}
            />

            {/* Generate Multi-view toggle - only show when image is attached */}
            {referenceImage && (
              <div className="mt-3">
                <Toggle
                  id="generate-multiview-toggle"
                  label="Generate Multi-view"
                  checked={generateMultiview}
                  onChange={setGenerateMultiview}
                />
              </div>
            )}
          </div>

          {/* Aspect Ratio */}
          <div>
            <p className="text-xs text-[#94a3b8] mb-1.5">Aspect Ratio</p>
            <div className="flex gap-1 flex-wrap">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg transition-colors',
                    aspectRatio === ar
                      ? 'bg-[#7c3aed] text-white'
                      : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                  )}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

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
                    <span className="relative group inline-flex items-center">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#333355] text-[#94a3b8] text-[9px] font-bold cursor-help select-none leading-none">
                        ?
                      </span>
                      <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-[#1a1a2e] border border-[#333355] px-3 py-2 text-[11px] text-[#cbd5e1] leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Enable this to let the AI start from a new point each
                        time for fresh, unpredictable results. Disable it to
                        lock the AI&apos;s path, ensuring you get the same
                        consistent response every time.
                        <span className="absolute top-full left-3 border-4 border-transparent border-t-[#333355]" />
                      </span>
                    </span>
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

              {/* num_steps: ge=1 le=100 */}
              <SliderRow
                label="Steps"
                value={qwenSteps}
                min={1}
                max={100}
                step={1}
                onChange={setQwenSteps}
                display={(v) => String(v)}
              />
              {/* cfg_scale: ge=0 le=20 */}
              <SliderRow
                label="CFG Scale"
                value={cfgScale}
                min={0}
                max={20}
                step={0.1}
                onChange={setCfgScale}
                display={(v) => v.toFixed(1)}
              />
            </div>
          </CollapsibleSection>
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-[#333355]">
          <button
            onClick={() =>
              onGenerate(
                prompt,
                1,
                aspectRatio,
                referenceImage,
                generateMultiview,
                qwenSteps,
                cfgScale,
                negativePrompt,
                qwenRandomizeSeed ? 0 : qwenSeed,
              )
            }
            disabled={isGenerating || !isConnectionAvailable || (!prompt && !(referenceImage && generateMultiview))}
            className="w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] transition-opacity hover:opacity-90 disabled:opacity-60 btn-gradient"
          >
            {/* Layered gradients for smooth crossfade */}
            <span className="gradient-bg bg1" aria-hidden />
            <span
              className={`gradient-bg bg2${isGenerating && progress ? ' animate' : ''}`}
              aria-hidden
            />

            <span className="btn-content">
              {isGenerating && progress ? (
                <>
                  <span className="spinner" aria-hidden />
                  <span>Generating...</span>
                </>
              ) : !isConnectionAvailable ? (
                <span>🔒 Queue Full — Please Wait</span>
              ) : (
                <span>✨ {submitLabel} · {remainingSlots} available</span>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
