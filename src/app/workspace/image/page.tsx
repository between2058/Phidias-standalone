'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import ImageGeneratePanel from '@/components/image/ImageGeneratePanel';

import {
  generateText2Img,
  editImage,
  generateAngleMulti,
  blobToDataURL,
} from '@/lib/api/phidias';
import type { ProgressUpdate } from '@/lib/api/types';
import { usePhidiasStore } from '@/store/phidias-store';

interface GeneratedImage {
  url: string;
  index: number;
}

export default function ImagePage() {
  const router = useRouter();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [, setLastPrompt] = useState('');
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);
  const [, setIsLastMultiView] = useState(false);
  const setPreviewImage = usePhidiasStore((s) => s.setPreviewImage);
  const setPendingModelImage = usePhidiasStore((s) => s.setPendingModelImage);
  const setPendingMultiViewImages = usePhidiasStore(
    (s) => s.setPendingMultiViewImages,
  );

  const handleGenerate = useCallback(
    async (
      prompt: string,
      samples: number,
      aspectRatio: string,
      referenceImage: File | null,
      generateMultiview: boolean,
      steps: number = 50,
      cfgScale: number = 4.0,
      negativePrompt: string = 'low quality, bad anatomy, blurry, distorted',
      qwenSeed: number = 0,
    ) => {
      setIsGenerating(true);
      setProgress({ percent: 0, stage: 'Starting...' });
      setLastPrompt(prompt);
      setIsLastMultiView(false);

      try {
        let generatedUrls: string[] = [];
        if (prompt === '' && referenceImage && generateMultiview) {
          const results = await generateAngleMulti(referenceImage, {});
          const newUrls = results;

          // Prepend original image
          const originalDataUrl = await blobToDataURL(referenceImage);
          generatedUrls = [originalDataUrl, ...newUrls];

          setIsLastMultiView(true);
        } else if (referenceImage) {
          const result = await editImage(referenceImage, prompt, {
            num_samples: samples,
          });
          generatedUrls = result.urls || [];
        } else {
          const result = await generateText2Img(prompt, {
            num_samples: samples,
            aspect_ratio: aspectRatio,
            num_steps: steps,
            cfg_scale: cfgScale,
            negative_prompt: negativePrompt,
            seed: qwenSeed,
          });
          generatedUrls = result.urls || [];
        }

        const resultImage = generatedUrls.map((url, i) => ({ url, index: i }));
        console.log(resultImage);
        setImages(resultImage);
      } catch (err) {
        console.error('Failed to generate images:', err);
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [],
  );

  const handleToModel = (url: string) => {
    setPendingModelImage(url);
    router.push('/workspace/model');
  };

  const handleToMultiView = (urls: string[]) => {
    setPendingMultiViewImages(urls);
    router.push('/workspace/model');
  };

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: '#1a1a2e' }}
    >
      {/* Left Panel */}
      <aside
        className="w-[300px] flex-shrink-0 overflow-hidden flex flex-col border-r"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        <ImageGeneratePanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          progress={progress}
        />
      </aside>

      {/* Center — Image Grid */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div
          className="px-4 py-2.5 border-b flex items-center gap-2"
          style={{ background: '#1e1e36', borderColor: '#333355' }}
        >
          <span className="text-sm text-[#94a3b8]">
            ✨ Select image to generate 3D model
          </span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="text-6xl mb-4 opacity-20">🖼</div>
              <p className="text-[#64748b] text-sm">
                Generated images will appear here
              </p>
              <p className="text-[#4b5563] text-xs mt-1">
                Enter a prompt and click Generate
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                {images.map((img) => (
                  <div
                    key={img.index}
                    className="relative rounded-xl overflow-hidden cursor-pointer group"
                    style={{ aspectRatio: '1/1' }}
                    onMouseEnter={() => setHoveredImage(img.index)}
                    onMouseLeave={() => setHoveredImage(null)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Generated ${img.index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    <div
                      className={cn(
                        'absolute inset-0 transition-opacity duration-200 pointer-events-none',
                        hoveredImage === img.index
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                    />

                    {hoveredImage === img.index && (
                      <button
                        className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/60 text-white flex items-center justify-center text-sm z-20"
                        onClick={() => {
                          console.log(img.url);
                          setPreviewImage(img.url);
                        }}
                      >
                        🔍
                      </button>
                    )}

                    {hoveredImage === img.index && (
                      <button
                        onClick={() => handleToModel(img.url)}
                        className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg text-xs font-bold text-[#1a1a2e] flex items-center gap-1 z-20"
                        style={{ background: '#f5a623' }}
                      >
                        → to 3D
                      </button>
                    )}

                    <div
                      className={cn(
                        'absolute inset-0 rounded-xl border-2 transition-colors pointer-events-none',
                        hoveredImage === img.index
                          ? 'border-[#7c3aed]'
                          : 'border-transparent',
                      )}
                    />
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <div className="mt-4 max-w-2xl mx-auto flex">
                  <button
                    onClick={() =>
                      handleToMultiView(images.map((img) => img.url))
                    }
                    className="w-full py-3 rounded-xl text-sm font-bold text-[#1a1a2e] flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: '#f5a623' }}
                  >
                    → to multi-view
                  </button>
                </div>
              )}

              {/* {lastPrompt && (
                                <div
                                    className="mt-4 max-w-2xl mx-auto flex items-center gap-3 px-4 py-2.5 rounded-xl"
                                    style={{ background: '#252542', border: '1px solid #333355' }}
                                >
                                    <p className="flex-1 text-xs text-[#94a3b8] truncate">{lastPrompt}</p>
                                    <button
                                        className="text-xs text-[#7c3aed] hover:text-white transition-colors shrink-0"
                                        onClick={() => {}}
                                    >
                                        Reuse prompt
                                    </button>
                                </div>
                            )} */}
            </>
          )}
        </div>
      </main>

      {/* Right Panel */}
      {/* <aside
        className="w-[220px] flex-shrink-0 overflow-hidden flex flex-col border-l"
        style={{ background: '#1e1e36', borderColor: '#333355' }}
      >
        <ImageHistoryPanel />
      </aside> */}
    </div>
  );
}
