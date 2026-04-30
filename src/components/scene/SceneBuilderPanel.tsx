'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ProgressBar, Toggle, PillGroup } from '@/components/ui/ProgressBar';
import type { ProgressUpdate } from '@/lib/api/types';

// ─── Sample splat scenes ──────────────────────────────────────────────────────

interface SampleScene {
  id: string;
  name: string;
  description: string;
  splatUrl: string;
  thumbGradient: string;
}

const SAMPLE_SCENES: SampleScene[] = [
  {
    id: 'benz',
    name: 'Benz 9F Scan',
    description: 'Point cloud · benz_9f.ply',
    splatUrl: '/samples/benz_9f.ply',
    thumbGradient: 'linear-gradient(135deg,#0E243E,#3b82f6)',
  },
  {
    id: 'bedroom',
    name: 'Painted Bedroom',
    description: 'Indoor · 2.1M splats',
    splatUrl: '/scenes/painted_bedroom.spz',
    thumbGradient: 'linear-gradient(135deg,#1e3a5f,#7c3aed)',
  },
  {
    id: 'garden',
    name: 'Garden',
    description: 'Outdoor · 3.8M splats',
    splatUrl: '/scenes/garden.spz',
    thumbGradient: 'linear-gradient(135deg,#14532d,#86efac)',
  },
  {
    id: 'studio',
    name: 'Photo Studio',
    description: 'Studio · 1.4M splats',
    splatUrl: '/scenes/studio.spz',
    thumbGradient: 'linear-gradient(135deg,#1c1c1c,#737373)',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SceneBuilderPanelProps {
  activeSplatUrl: string | null;
  onLoadScene: (url: string) => void;
  onReconstruct: (file?: File, fps?: number) => void;
  onGenerate: () => void;
  isProcessing: boolean;
  progress: ProgressUpdate | null;
  processingStage: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SceneBuilderPanel({
  activeSplatUrl,
  onLoadScene,
  onReconstruct,
  onGenerate,
  isProcessing,
  progress,
  processingStage,
}: SceneBuilderPanelProps) {
  const [mode, setMode] = useState<'library' | 'reconstruct' | 'generate'>(
    'library',
  );
  const [generateInputMode, setGenerateInputMode] = useState<'image' | 'text'>(
    'text',
  );
  const [scenePrompt, setScenePrompt] = useState('');
  const [quality, setQuality] = useState('Balanced');
  const [sceneStyle, setSceneStyle] = useState('Realistic');
  const [sceneSize, setSceneSize] = useState('Medium (20m²)');
  const [populateObjects, setPopulateObjects] = useState(true);
  const [autoScale, setAutoScale] = useState(true);
  const [fps, setFps] = useState(2);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splatInputRef = useRef<HTMLInputElement>(null);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleSplatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onLoadScene(url);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#333355]">
        <h2 className="text-sm font-semibold text-white">Scene Builder</h2>
        <p className="text-[10px] text-[#64748b] mt-0.5">
          Gaussian Splatting · Photorealistic 3D
        </p>
      </div>

      {/* Mode tabs */}
      <div className="px-4 py-3 border-b border-[#333355]">
        <div className="flex bg-[#252542] rounded-lg p-1 gap-1">
          <button
            onClick={() => setMode('library')}
            className={cn(
              'flex-1 py-2 text-xs rounded-md transition-colors',
              mode === 'library'
                ? 'bg-[#D5B451] text-[#1a1a2e] font-semibold'
                : 'text-[#94a3b8] hover:text-white',
            )}
          >
            Library
          </button>
          <button
            onClick={() => setMode('reconstruct')}
            className={cn(
              'flex-1 py-2 text-xs rounded-md transition-colors',
              mode === 'reconstruct'
                ? 'bg-[#7c3aed] text-white'
                : 'text-[#94a3b8] hover:text-white',
            )}
          >
            📷 Capture
          </button>
          <button
            onClick={() => setMode('generate')}
            className={cn(
              'flex-1 py-2 text-xs rounded-md transition-colors',
              mode === 'generate'
                ? 'bg-[#7c3aed] text-white'
                : 'text-[#94a3b8] hover:text-white',
            )}
          >
            ✨ Generate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
        {/* ── LIBRARY MODE ──────────────────────────────────────────────────── */}
        {mode === 'library' && (
          <>
            {/* Open splat file */}
            <button
              onClick={() => splatInputRef.current?.click()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-[#333355] text-left hover:border-[#D5B451] hover:bg-[#D5B451]/5 transition-colors group"
            >
              <span className="text-xl opacity-60 group-hover:opacity-100">
                📂
              </span>
              <div>
                <p className="text-xs font-medium text-[#94a3b8] group-hover:text-white">
                  Open Splat File…
                </p>
                <p className="text-[10px] text-[#4b5563]">
                  .spz · .ply · .splat · .ksplat
                </p>
              </div>
            </button>
            <input
              ref={splatInputRef}
              type="file"
              accept=".spz,.ply,.splat,.ksplat,.pcsogs"
              className="hidden"
              onChange={handleSplatFileChange}
            />

            {/* Sample scenes */}
            <div>
              <p className="text-[10px] font-semibold text-[#4b5563] uppercase tracking-wider mb-2">
                Sample Scenes
              </p>
              <div className="space-y-2">
                {SAMPLE_SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => onLoadScene(scene.splatUrl)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left',
                      activeSplatUrl === scene.splatUrl
                        ? 'border-[#D5B451] bg-[#D5B451]/10'
                        : 'border-[#333355] hover:border-[#7c3aed] hover:bg-[#252542]',
                    )}
                  >
                    <div
                      className="w-14 h-10 rounded-md flex-shrink-0"
                      style={{ background: scene.thumbGradient }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">
                        {scene.name}
                      </p>
                      <p className="text-[10px] text-[#64748b]">
                        {scene.description}
                      </p>
                    </div>
                    {activeSplatUrl === scene.splatUrl && (
                      <span className="text-[#D5B451] text-xs flex-shrink-0">
                        ●
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation hint */}
            <div className="rounded-lg bg-[#13131f] border border-[#333355] p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-[#4b5563] uppercase tracking-wider">
                Navigation
              </p>
              {[
                ['WASD', 'Move'],
                ['Mouse drag', 'Look around'],
                ['Scroll', 'Move forward/back'],
                ['Shift', 'Sprint'],
              ].map(([key, action]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[10px] text-white font-mono bg-[#252542] px-1.5 py-0.5 rounded">
                    {key}
                  </span>
                  <span className="text-[10px] text-[#64748b]">{action}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── RECONSTRUCT MODE ──────────────────────────────────────────────── */}
        {mode === 'reconstruct' && (
          <>
            {/* Upload zone */}
            <div>
              <p className="text-xs text-[#94a3b8] mb-1.5">
                Upload Video or Images
              </p>
              <label
                className="block cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="border border-dashed border-[#333355] rounded-xl p-5 text-center hover:border-[#7c3aed] transition-colors bg-[#252542]/30">
                  {uploadedFile ? (
                    <div>
                      <p className="text-xs text-green-400">
                        ✓ {uploadedFile.name}
                      </p>
                      <p className="text-[10px] text-[#64748b] mt-1">
                        {(uploadedFile.size / 1024 / 1024).toFixed(1)}MB
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl mb-2">🎬</div>
                      <p className="text-[#64748b] text-xs">
                        Drop MP4, MOV, JPG, PNG
                      </p>
                      <p className="text-[#4b5563] text-[10px] mt-1">≤500MB</p>
                    </>
                  )}
                </div>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,image/jpeg,image/png"
                className="hidden"
                onChange={handleVideoFileChange}
              />
            </div>

            {/* Video preview */}
            {uploadedFile && uploadedFile.type.startsWith('video/') && (
              <div
                className="rounded-xl overflow-hidden bg-black"
                style={{ aspectRatio: '16/9' }}
              >
                <video
                  controls
                  className="w-full h-full"
                  src={URL.createObjectURL(uploadedFile)}
                />
              </div>
            )}

            {/* Frame extraction */}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-[#94a3b8]">Extract at</p>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value) || 1)}
                  className="w-14 bg-[#252542] border border-[#333355] rounded px-2 py-1 text-xs text-white text-center focus:outline-none"
                />
                <p className="text-xs text-[#94a3b8]">fps</p>
              </div>
            </div>

            {/* Quality */}
            <div>
              <p className="text-xs text-[#94a3b8] mb-1.5">Quality</p>
              <PillGroup
                options={['Fast', 'Balanced', 'Ultra']}
                value={quality}
                onChange={setQuality}
              />
            </div>

            <Toggle
              label="Auto-detect scale"
              checked={autoScale}
              onChange={setAutoScale}
            />
          </>
        )}

        {/* ── GENERATE MODE ────────────────────────────────────────────────── */}
        {mode === 'generate' && (
          <>
            <div className="flex bg-[#252542] rounded-lg p-1 gap-1">
              <button
                onClick={() => setGenerateInputMode('image')}
                className={cn(
                  'flex-1 py-2 text-xs rounded-md transition-colors',
                  generateInputMode === 'image'
                    ? 'bg-[#7c3aed] text-white'
                    : 'text-[#94a3b8] hover:text-white',
                )}
              >
                🖼 Image
              </button>
              <button
                onClick={() => setGenerateInputMode('text')}
                className={cn(
                  'flex-1 py-2 text-xs rounded-md transition-colors',
                  generateInputMode === 'text'
                    ? 'bg-[#7c3aed] text-white'
                    : 'text-[#94a3b8] hover:text-white',
                )}
              >
                ✏️ Text
              </button>
            </div>

            {generateInputMode === 'image' && (
              <label className="block cursor-pointer">
                <div className="border border-dashed border-[#333355] rounded-xl p-5 text-center hover:border-[#7c3aed] transition-colors bg-[#252542]/30">
                  <div className="text-3xl mb-2">🖼</div>
                  <p className="text-[#64748b] text-xs">
                    Upload scene reference image
                  </p>
                  <p className="text-[#4b5563] text-[10px] mt-1">
                    JPG / PNG / WEBP ≤20MB
                  </p>
                </div>
                <input type="file" accept="image/*" className="hidden" />
              </label>
            )}

            {generateInputMode === 'text' && (
              <div>
                <textarea
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  placeholder="Describe your scene..."
                  maxLength={800}
                  className="w-full h-28 bg-[#252542] border border-[#333355] rounded-lg text-sm text-white placeholder-[#64748b] p-3 resize-none focus:outline-none focus:border-[#7c3aed]"
                />
                <p className="text-[#64748b] text-xs text-right mt-1">
                  {scenePrompt.length}/800
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-[#94a3b8] mb-1.5">Scene Style</p>
              <select
                value={sceneStyle}
                onChange={(e) => setSceneStyle(e.target.value)}
                className="w-full bg-[#252542] border border-[#333355] rounded-lg px-3 py-2 text-sm text-[#94a3b8] focus:outline-none"
              >
                {[
                  'Realistic',
                  'Low Poly',
                  'Industrial',
                  'Indoor',
                  'Outdoor',
                  'Custom',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-[#94a3b8] mb-1.5">Scene Size</p>
              <div className="flex gap-1 flex-col">
                {['Small (5m²)', 'Medium (20m²)', 'Large (100m²)'].map(
                  (size) => (
                    <button
                      key={size}
                      onClick={() => setSceneSize(size)}
                      className={cn(
                        'py-2 px-3 text-xs rounded-lg text-left transition-colors',
                        sceneSize === size
                          ? 'bg-[#7c3aed] text-white'
                          : 'bg-[#252542] text-[#94a3b8] hover:bg-[#2a2a4a]',
                      )}
                    >
                      {size}
                    </button>
                  ),
                )}
              </div>
            </div>

            <Toggle
              label="Populate Objects"
              checked={populateObjects}
              onChange={setPopulateObjects}
            />
          </>
        )}
      </div>

      {/* CTA */}
      {mode !== 'library' && (
        <div className="p-4 border-t border-[#333355]">
          {isProcessing && progress ? (
            <div className="space-y-2">
              <ProgressBar
                percent={progress.percent}
                stage={progress.stage}
                color={mode === 'reconstruct' ? 'blue' : 'green'}
              />
              <p className="text-[10px] text-center text-[#64748b]">
                {processingStage}
              </p>
            </div>
          ) : (
            <button
              onClick={
                mode === 'reconstruct'
                  ? () => onReconstruct(uploadedFile ?? undefined, fps)
                  : onGenerate
              }
              disabled={isProcessing}
              className="w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                background:
                  mode === 'reconstruct'
                    ? 'linear-gradient(135deg, #3b82f6, #7c3aed)'
                    : 'linear-gradient(135deg, #22c55e, #f5a623)',
              }}
            >
              {mode === 'reconstruct'
                ? '🔨 Reconstruct Scene ⚡ 50'
                : '✨ Generate Scene ⚡ 80'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
