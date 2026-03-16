'use client';

import {
    ApiResponse,
    ProgressUpdate,
    GenerateModelRequest,
    GenerateModelResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    SegmentResult,
    RetopologyRequest,
    RetopologyResult,
    TextureResult,
    TextureRequest,
    SceneReconstructResult,
    PhysicsMaterial,
    HierarchyItem,
    BatchItem,
} from './types';

// Helper: simulate async progress
export async function simulateProgress(
    onProgress: (update: ProgressUpdate) => void,
    stages: string[],
    totalDurationMs: number = 3000,
): Promise<void> {
    const stageMs = totalDurationMs / stages.length;
    for (let i = 0; i < stages.length; i++) {
        onProgress({
            percent: Math.round((i / stages.length) * 100),
            stage: stages[i],
        });
        await new Promise<void>((r) => setTimeout(r, stageMs));
    }
    onProgress({ percent: 100, stage: 'Done ✓' });
}

// SAMPLE ASSET PATHS (relative to Next.js public folder)
export const SAMPLE_GLB = '/samples/sky_car_sam3d_parts.glb';
export const SAMPLE_USDZ = '/samples/phidias_model.usdz';
export const SAMPLE_PLY = '/samples/benz_9f.ply';
export const SAMPLE_HDR = '/samples/qwantani_moonrise_puresky_2k.hdr';

// Shared TRELLIS.2 stages (image already in hand)
const TRELLIS_STAGES = [
    'Preprocessing image...',
    'Stage 1: Generating sparse structure...',
    'Stage 2: Generating 3D shape...',
    'Stage 3: Generating materials...',
    'Extracting GLB...',
];

// Mock: Generate 3D model — routes by inputMode
export async function mockGenerateModel(
    request: GenerateModelRequest,
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<GenerateModelResponse>> {
    const report = onProgress ?? (() => { });

    if (request.inputMode === 'text') {
        // Phase 1: Qwen text → image
        await simulateProgress(
            report,
            [
                'Sending prompt to Qwen...',
                'Qwen generating image...',
                'Image ready ✓',
            ],
            3000,
        );
        // Phase 2: TRELLIS.2 image → mesh
        await simulateProgress(report, TRELLIS_STAGES, 5000);
    } else if (request.inputMode === 'batch') {
        const count = request.batchImages?.length ?? 1;
        for (let i = 0; i < count; i++) {
            report({
                percent: Math.round((i / count) * 100),
                stage: `Image ${i + 1}/${count}: Preprocessing...`,
            });
            await new Promise<void>((r) => setTimeout(r, 800));
            report({
                percent: Math.round((i / count) * 100) + 10,
                stage: `Image ${i + 1}/${count}: Generating mesh...`,
            });
            await new Promise<void>((r) => setTimeout(r, 2500));
        }
        report({ percent: 100, stage: `Batch done ✓ (${count} models)` });
        await new Promise<void>((r) => setTimeout(r, 500));
    } else {
        await simulateProgress(report, TRELLIS_STAGES, 5000);
    }

    return {
        success: true,
        data: {
            modelUrl: SAMPLE_GLB,
            faces: 1935274,
            vertices: 992828,
            processingTimeMs: 5000,
            topology: 'triangle',
        },
    };
}

// Mock: batch generate — returns per-item results
export async function mockBatchGenerate(
    fileNames: string[],
    onItemUpdate: (item: BatchItem) => void,
): Promise<void> {
    for (let i = 0; i < fileNames.length; i++) {
        const id = `batch-${i}`;
        onItemUpdate({
            id,
            fileName: fileNames[i],
            status: 'processing',
            progress: 0,
        });
        await new Promise<void>((r) => setTimeout(r, 600));
        onItemUpdate({
            id,
            fileName: fileNames[i],
            status: 'processing',
            progress: 55,
        });
        await new Promise<void>((r) => setTimeout(r, 1800));
        onItemUpdate({
            id,
            fileName: fileNames[i],
            status: 'done',
            progress: 100,
            modelUrl: SAMPLE_GLB,
        });
    }
}

// Mock: Generate images from prompt
export async function mockGenerateImages(
    request: GenerateImageRequest,
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<GenerateImageResponse>> {
    if (onProgress) {
        await simulateProgress(
            onProgress,
            ['Creating prompt...', 'Generating images...'],
            2500,
        );
    } else {
        await new Promise<void>((r) => setTimeout(r, 2500));
    }
    // Return placeholder colored image URLs (SVG data URLs)
    //   const images = colors.slice(0, count).map(
    //     (color, i) =>
    //       `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${encodeURIComponent(color)}"/><text x="200" y="210" text-anchor="middle" fill="white" font-size="24" font-family="sans-serif">Variation ${i + 1}</text></svg>`
    //   );
    const images = [
        '/phidias_logo.jpg',
        '/phidias_logo.jpg',
        '/phidias_logo.jpg',
        '/phidias_logo.jpg',
    ];
    return { success: true, data: { images } };
}

// Mock: Segment model into parts
export async function mockSegmentModel(
    _modelUrl: string,
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<SegmentResult>> {
    if (onProgress) {
        await simulateProgress(
            onProgress,
            ['Loading model...', 'Detecting parts...', 'Segmenting...'],
            2000,
        );
    } else {
        await new Promise<void>((r) => setTimeout(r, 2000));
    }
    return {
        success: true,
        data: {
            parts: [
                { name: 'Body', color: '#06b6d4', meshIndex: 0 },
                { name: 'Left Front Leg', color: '#3b82f6', meshIndex: 1 },
                { name: 'Right Front Leg', color: '#ef4444', meshIndex: 2 },
                { name: 'Left Back Leg', color: '#f97316', meshIndex: 3 },
                { name: 'Right Back Leg', color: '#ec4899', meshIndex: 4 },
                { name: 'Head', color: '#22c55e', meshIndex: 5 },
                { name: 'Tail', color: '#a855f7', meshIndex: 6 },
            ],
            modelUrl: SAMPLE_GLB,
        },
    };
}

// Mock: Retopology
export async function mockRetopology(
    request: RetopologyRequest,
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<RetopologyResult>> {
    if (onProgress) {
        await simulateProgress(
            onProgress,
            [
                'Analyzing topology...',
                'Computing optimal flow...',
                'Generating quads...',
                'Preserving UVs...',
            ],
            3000,
        );
    } else {
        await new Promise<void>((r) => setTimeout(r, 3000));
    }
    return {
        success: true,
        data: {
            modelUrl: SAMPLE_GLB,
            originalFaces: 1935274,
            newFaces: request.targetFaces,
        },
    };
}

// Mock: Generate texture (TRELLIS.2 Trellis2TexturingPipeline)
export async function mockGenerateTexture(
    request?: TextureRequest,
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<TextureResult>> {
    const report = onProgress ?? (() => { });

    if (request?.mode === 'text') {
        // Phase 1: capture render or use source image
        await simulateProgress(report, ['Capturing model render...'], 800);
        // Phase 2: Qwen style transfer
        await simulateProgress(
            report,
            [
                'Sending to Qwen for style transfer...',
                'Qwen generating reference image...',
                'Reference image ready ✓',
            ],
            2500,
        );
        // Phase 3: TRELLIS.2 texturing
        await simulateProgress(
            report,
            ['Stage 3: Generating material textures...', 'Exporting GLB...'],
            2500,
        );
    } else {
        await simulateProgress(
            report,
            [
                'Preprocessing reference image...',
                'Stage 3: Generating material textures...',
                'Exporting GLB...',
            ],
            4000,
        );
    }

    return {
        success: true,
        data: {
            modelUrl: SAMPLE_GLB,
            textureUrls: { albedo: SAMPLE_GLB },
        },
    };
}

// Mock: Scene reconstruction from video/images
export async function mockReconstructScene(
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<SceneReconstructResult>> {
    if (onProgress) {
        await simulateProgress(
            onProgress,
            [
                'Extracting frames...',
                'Computing point cloud...',
                'Estimating depth...',
                'Building mesh...',
                'Texturing surface...',
            ],
            5000,
        );
    } else {
        await new Promise<void>((r) => setTimeout(r, 5000));
    }
    return {
        success: true,
        data: {
            pointCloudUrl: SAMPLE_PLY,
            meshUrl: SAMPLE_GLB,
            faces: 845392,
            pointCount: 2340000,
        },
    };
}

// Mock: Generate scene from text/image
export async function mockGenerateScene(
    onProgress?: (update: ProgressUpdate) => void,
): Promise<ApiResponse<{ modelUrl: string }>> {
    if (onProgress) {
        await simulateProgress(
            onProgress,
            [
                'Generating environment...',
                'Placing objects...',
                'Adding lighting...',
                'Rendering...',
            ],
            4000,
        );
    } else {
        await new Promise<void>((r) => setTimeout(r, 4000));
    }
    return { success: true, data: { modelUrl: SAMPLE_GLB } };
}

// Mock: Physics material library
export function mockGetPhysicsMaterials(): PhysicsMaterial[] {
    return [
        {
            id: 'steel',
            name: 'Steel (Brushed)',
            density: 7800,
            staticFriction: 0.6,
            dynamicFriction: 0.4,
            restitution: 0.1,
            color: '#94a3b8',
        },
        {
            id: 'aluminum',
            name: 'Aluminum',
            density: 2700,
            staticFriction: 0.5,
            dynamicFriction: 0.35,
            restitution: 0.15,
            color: '#cbd5e1',
        },
        {
            id: 'titanium',
            name: 'Titanium Alloy',
            density: 4500,
            staticFriction: 0.55,
            dynamicFriction: 0.38,
            restitution: 0.12,
            color: '#e2e8f0',
        },
        {
            id: 'abs',
            name: 'ABS Plastic',
            density: 1050,
            staticFriction: 0.4,
            dynamicFriction: 0.3,
            restitution: 0.2,
            color: '#fbbf24',
        },
        {
            id: 'nylon',
            name: 'Nylon',
            density: 1140,
            staticFriction: 0.35,
            dynamicFriction: 0.25,
            restitution: 0.25,
            color: '#a78bfa',
        },
        {
            id: 'acrylic',
            name: 'Acrylic (Clear)',
            density: 1180,
            staticFriction: 0.45,
            dynamicFriction: 0.32,
            restitution: 0.3,
            color: '#7dd3fc',
        },
        {
            id: 'rubber-tire',
            name: 'Rubber (Tire)',
            density: 1100,
            staticFriction: 0.9,
            dynamicFriction: 0.7,
            restitution: 0.6,
            color: '#374151',
        },
        {
            id: 'rubber-bouncy',
            name: 'Rubber (Bouncy)',
            density: 1100,
            staticFriction: 0.8,
            dynamicFriction: 0.65,
            restitution: 0.85,
            color: '#f87171',
        },
        {
            id: 'silicone',
            name: 'Silicone',
            density: 1300,
            staticFriction: 0.7,
            dynamicFriction: 0.55,
            restitution: 0.5,
            color: '#86efac',
        },
        {
            id: 'wood',
            name: 'Wood (Oak)',
            density: 700,
            staticFriction: 0.5,
            dynamicFriction: 0.35,
            restitution: 0.2,
            color: '#d97706',
        },
        {
            id: 'concrete',
            name: 'Concrete',
            density: 2400,
            staticFriction: 0.7,
            dynamicFriction: 0.55,
            restitution: 0.05,
            color: '#9ca3af',
        },
        {
            id: 'ice',
            name: 'Ice',
            density: 917,
            staticFriction: 0.05,
            dynamicFriction: 0.03,
            restitution: 0.1,
            color: '#bae6fd',
        },
    ];
}

// Mock: Export file download
export function mockExportFile(format: 'ply' | 'usdz' | 'glb'): void {
    const urls: Record<string, string> = {
        ply: SAMPLE_PLY,
        usdz: SAMPLE_USDZ,
        glb: SAMPLE_GLB,
    };
    const filenames: Record<string, string> = {
        ply: 'world-export.ply',
        usdz: 'world-export.usdz',
        glb: 'collider-mesh.glb',
    };
    const link = document.createElement('a');
    link.href = urls[format];
    link.download = filenames[format];
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Mock: Publish to Pegaverse
export async function mockPublishToPegaverse(): Promise<
    ApiResponse<{ url: string }>
> {
    await new Promise<void>((r) => setTimeout(r, 1500));
    return {
        success: true,
        data: { url: 'https://pegaverse.app/scene/phidias-123456' },
    };
}

// Mock: Agent message types
export interface AgentMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    type: 'text' | 'progress' | 'canvas-ref' | 'pipeline-summary';
    progress?: number;
    canvasNodeId?: string;
}

// Mock: Agent command processing
export async function mockAgentCommand(
    message: string,
    onProgress?: (update: ProgressUpdate) => void,
    _onMessage?: (msg: AgentMessage) => void,
): Promise<{ canvasNodeType: string; modelUrl: string }> {
    const lower = message.toLowerCase();

    if (
        lower.includes('generate') ||
        lower.includes('create') ||
        lower.includes('model')
    ) {
        if (onProgress)
            await simulateProgress(
                onProgress,
                ['Generating 3D model...', 'Applying texture...', 'Finalizing...'],
                3000,
            );
        return { canvasNodeType: '3d-asset', modelUrl: SAMPLE_GLB };
    }
    if (lower.includes('segment')) {
        if (onProgress)
            await simulateProgress(
                onProgress,
                ['Loading model...', 'Segmenting parts...'],
                2000,
            );
        return { canvasNodeType: 'segmented-asset', modelUrl: SAMPLE_GLB };
    }
    if (lower.includes('texture')) {
        if (onProgress)
            await simulateProgress(
                onProgress,
                ['Analyzing model...', 'Generating texture...'],
                2500,
            );
        return { canvasNodeType: 'textured-asset', modelUrl: SAMPLE_GLB };
    }
    if (lower.includes('physics') || lower.includes('joint')) {
        if (onProgress)
            await simulateProgress(
                onProgress,
                ['Analyzing structure...', 'Configuring physics...'],
                1500,
            );
        return { canvasNodeType: 'physics-config', modelUrl: SAMPLE_GLB };
    }
    if (
        lower.includes('scene') ||
        lower.includes('room') ||
        lower.includes('place') ||
        lower.includes('world')
    ) {
        if (onProgress)
            await simulateProgress(
                onProgress,
                [
                    'Generating environment...',
                    'Placing assets...',
                    'Adding lighting...',
                ],
                4000,
            );
        return { canvasNodeType: 'scene', modelUrl: SAMPLE_GLB };
    }

    // Default: generate a model
    if (onProgress)
        await simulateProgress(
            onProgress,
            ['Processing...', 'Generating...'],
            2000,
        );
    return { canvasNodeType: '3d-asset', modelUrl: SAMPLE_GLB };
}

// Mock hierarchy data for a loaded model
export function mockGetHierarchy(): HierarchyItem[] {
    return [
        {
            id: 'root',
            name: 'Scene Root',
            visible: true,
            children: [
                { id: 'body', name: 'Body', visible: true },
                { id: 'left-front', name: 'Left Front Leg', visible: true },
                { id: 'right-front', name: 'Right Front Leg', visible: true },
                { id: 'left-back', name: 'Left Back Leg', visible: true },
                { id: 'right-back', name: 'Right Back Leg', visible: true },
                { id: 'head', name: 'Head', visible: true },
            ],
        },
    ];
}
