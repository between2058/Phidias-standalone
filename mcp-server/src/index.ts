#!/usr/bin/env node
/**
 * Phidias MCP Server
 *
 * Exposes Phidias 3D asset pipeline as MCP tools for Claude Code.
 * Tools: generate_image, generate_3d, load_model, capture_screenshot, list_generated_assets
 *
 * Also starts a bridge server (WebSocket + HTTP) on port 9800
 * for real-time communication with the Phidias frontend.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import {
  generateImage,
  generate3D,
  segment3D,
  getSessionAssets,
  getOutputDir,
  findAssetById,
} from './phidias-client.js';
import {
  startBridge,
  sendToFrontend,
  requestFromFrontend,
  isFrontendConnected,
  getFileUrl,
} from './bridge.js';

const server = new McpServer({
  name: 'phidias',
  version: '0.2.0',
  description: 'Phidias 3D asset creation pipeline — generate images and 3D models from text, with live viewport integration',
});

// ---------------------------------------------------------------------------
// Tool: generate_image
// ---------------------------------------------------------------------------

server.tool(
  'generate_image',
  'Generate a reference image from a text prompt using Qwen AI. Returns the file path of the generated image. Use this as the first step to create a 3D model — generate a concept image, then pass it to generate_3d.',
  {
    prompt: z.string().describe('Text description of the image to generate (English recommended). Be specific about the subject, style, and viewing angle. For 3D model creation, include "front view" or "3/4 view" for best results.'),
    negative_prompt: z.string().optional().describe('Things to exclude from the image (e.g. "blurry, low quality, distorted")'),
    seed: z.number().int().optional().describe('Random seed for reproducibility. Omit for random results.'),
    num_steps: z.number().int().min(1).max(100).optional().describe('Number of diffusion steps (default: 50). Higher = better quality but slower.'),
    cfg_scale: z.number().min(0).max(20).optional().describe('CFG scale controlling prompt adherence (default: 4.0). Higher = more literal.'),
    aspect_ratio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().describe('Image aspect ratio (default: 1:1). Use 1:1 for 3D model reference images.'),
  },
  async (params) => {
    try {
      const asset = await generateImage(params.prompt, {
        seed: params.seed,
        num_steps: params.num_steps,
        cfg_scale: params.cfg_scale,
        negative_prompt: params.negative_prompt,
        aspect_ratio: params.aspect_ratio,
      });

      const base64 = fs.readFileSync(asset.filePath).toString('base64');
      const url = getFileUrl(asset.filePath);
      const textLines = [
        'Image generated successfully.',
        '',
        `File: ${asset.filePath}`,
        `URL: ${url}`,
        `Prompt: "${params.prompt}"`,
        `Asset ID: ${asset.id}`,
        '',
        'Next step: Use generate_3d with this image path or URL to create a 3D model.',
      ];

      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/png' },
          { type: 'text' as const, text: textLines.join('\n') },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error generating image: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: generate_3d
// ---------------------------------------------------------------------------

server.tool(
  'generate_3d',
  `Generate a textured 3D model (GLB) from a reference image. Two backends available:
- trellis2 (default): HIGH QUALITY, detailed topology, high face count. Slower (~3min). Use for final assets or when quality matters.
- reconviagen: FAST (~1min), lower detail. Use for quick previews or rapid iteration.
If the user hasn't specified which backend to use, ask them. After generation, use load_model to display it in the Phidias viewport.`,
  {
    image_path: z.string().describe('Absolute file path to the reference image (PNG/JPG). Can be a path from generate_image output or any local image file.'),
    backend: z.enum(['trellis2', 'reconviagen']).default('trellis2').describe('Which 3D generation backend to use. trellis2 = high quality/slow, reconviagen = fast/preview.'),
    seed: z.number().int().optional().describe('Random seed for reproducibility. Omit for random results.'),
    texture_size: z.number().int().optional().describe('Texture resolution (default: 1024). Options: 512, 1024, 2048. Higher = more detailed textures but larger file.'),
    ss_guidance_strength: z.number().optional().describe('Structure guidance strength (default: 7.5). Controls how closely the 3D shape follows the image.'),
    ss_sampling_steps: z.number().int().optional().describe('Structure sampling steps (default: 12).'),
    slat_guidance_strength: z.number().optional().describe('Texture guidance strength (default: 3.0). Controls texture fidelity.'),
    slat_sampling_steps: z.number().int().optional().describe('Texture sampling steps (default: 12).'),
  },
  async (params) => {
    try {
      const asset = await generate3D(params.image_path, {
        backend: params.backend,
        seed: params.seed,
        texture_size: params.texture_size,
        ss_guidance_strength: params.ss_guidance_strength,
        ss_sampling_steps: params.ss_sampling_steps,
        slat_guidance_strength: params.slat_guidance_strength,
        slat_sampling_steps: params.slat_sampling_steps,
      });

      // Auto-load into viewport if frontend is connected
      let viewportStatus = '';
      if (isFrontendConnected()) {
        try {
          const fileUrl = getFileUrl(asset.filePath);
          sendToFrontend({
            type: 'load_model',
            url: fileUrl,
            name: asset.prompt || `model-${Date.now()}`,
          });
          viewportStatus = '\n\nModel has been sent to the Phidias viewport for display.';
        } catch {
          viewportStatus = '\n\nNote: Could not auto-load into viewport. Use load_model tool manually.';
        }
      }

      const url = getFileUrl(asset.filePath);
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `3D model generated successfully (${params.backend}).`,
              ``,
              `File: ${asset.filePath}`,
              `URL: ${url}`,
              `Source image: ${asset.sourceImagePath}`,
              `Asset ID: ${asset.id}`,
              viewportStatus,
            ].join('\n'),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error generating 3D model: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: load_model
// ---------------------------------------------------------------------------

server.tool(
  'load_model',
  'Load a 3D model (GLB) into the Phidias viewport in the browser. The model appears immediately in the 3D viewer. Requires the Phidias web app to be running at http://localhost:3000.',
  {
    file_path: z.string().describe('Absolute path to a GLB file on disk (from generate_3d output or any local GLB).'),
    name: z.string().optional().describe('Display name for the asset in the Phidias asset panel.'),
  },
  async (params) => {
    try {
      if (!isFrontendConnected()) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Frontend not connected. Make sure Phidias is running at http://localhost:3000 and the page is loaded.',
          }],
          isError: true,
        };
      }

      const fileUrl = getFileUrl(params.file_path);
      sendToFrontend({
        type: 'load_model',
        url: fileUrl,
        name: params.name || `model-${Date.now()}`,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Model loaded into Phidias viewport.\n\nURL: ${fileUrl}\nName: ${params.name || 'model'}`,
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error loading model: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: get_viewport_state
// ---------------------------------------------------------------------------

server.tool(
  'get_viewport_state',
  'Get information about the model currently loaded in the Phidias viewport. Returns the active asset name, model URL, face/vertex counts, segmentation status, etc. Use this to understand what the user is currently looking at before performing operations like segment_model.',
  {},
  async () => {
    try {
      if (!isFrontendConnected()) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Frontend not connected. Make sure Phidias is running at http://localhost:3000.',
          }],
          isError: true,
        };
      }

      const response = await requestFromFrontend(
        { type: 'get_viewport_state' },
        10_000,
      ) as {
        activeAsset?: {
          id: string;
          name: string;
          modelUrl: string;
          type: string;
          status?: string;
          faces?: number;
          vertices?: number;
          segmentation?: { numParts: number };
          isOrganized?: boolean;
        } | null;
        totalAssets?: number;
      };

      if (!response.activeAsset) {
        return {
          content: [{
            type: 'text' as const,
            text: `No model loaded in the viewport. (${response.totalAssets ?? 0} assets in panel)\n\nUse generate_3d or load_model to load a model first.`,
          }],
        };
      }

      const a = response.activeAsset;
      const lines = [
        `Current viewport model:`,
        `  Name: ${a.name}`,
        `  URL: ${a.modelUrl}`,
        `  Type: ${a.type}`,
        `  Status: ${a.status ?? 'ready'}`,
      ];
      if (a.faces) lines.push(`  Faces: ${a.faces.toLocaleString()}`);
      if (a.vertices) lines.push(`  Vertices: ${a.vertices.toLocaleString()}`);
      if (a.segmentation) lines.push(`  Segmented: ${a.segmentation.numParts} parts`);
      if (a.isOrganized) lines.push(`  Organized: yes`);
      lines.push(`  Asset ID: ${a.id}`);
      lines.push(`\nTotal assets in panel: ${response.totalAssets ?? 0}`);

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error getting viewport state: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: capture_screenshot
// ---------------------------------------------------------------------------

server.tool(
  'capture_screenshot',
  'Capture a screenshot of the current Phidias 3D viewport. Returns the image as base64 PNG. Use this to visually inspect the current state of the model — helpful for verifying generation results or planning next steps. Requires the Phidias web app to be running.',
  {},
  async () => {
    try {
      if (!isFrontendConnected()) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Frontend not connected. Make sure Phidias is running at http://localhost:3000 and the page is loaded.',
          }],
          isError: true,
        };
      }

      const response = await requestFromFrontend(
        { type: 'capture_screenshot' },
        30_000,
      ) as { type: string; screenshot?: string };

      if (!response.screenshot) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Frontend returned no screenshot data. Make sure a model is loaded in the viewport.',
          }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'image' as const,
            data: response.screenshot,
            mimeType: 'image/png',
          },
          {
            type: 'text' as const,
            text: 'Viewport screenshot captured. You can analyze the image above to assess the current model state.',
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error capturing screenshot: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: segment_model
// ---------------------------------------------------------------------------

server.tool(
  'segment_model',
  `Segment a 3D model (GLB) into individual parts using P3-SAM AI. This splits a single mesh into meaningful parts (e.g. head, body, legs, arms). Takes 1-3 minutes. After segmentation, the segmented model is automatically loaded into the viewport.

You can pass a file path OR use "viewport" to segment whatever model is currently displayed in the Phidias viewport. When using "viewport", the model is downloaded from the frontend first.`,
  {
    glb_path: z.string().default('viewport').describe('Absolute path to a GLB file, OR "viewport" to segment the model currently loaded in the Phidias viewer.'),
    point_num: z.number().int().min(1000).max(20000).optional().describe('Number of sample points (P3-SAM backend requires >= 1000; default: backend default).'),
    prompt_num: z.number().int().min(10).max(200).optional().describe('Number of prompts for segmentation (P3-SAM backend requires >= 10; default: backend default).'),
    threshold: z.number().min(0).max(1).optional().describe('Segmentation threshold (default: 0.5). Lower = more parts, higher = fewer parts.'),
    seed: z.number().int().optional().describe('Random seed for reproducibility.'),
  },
  async (params) => {
    try {
      let glbPath = params.glb_path;

      // If "viewport", fetch the model URL from the frontend and download it
      if (glbPath === 'viewport') {
        if (!isFrontendConnected()) {
          return {
            content: [{ type: 'text' as const, text: 'Frontend not connected. Cannot get viewport model.' }],
            isError: true,
          };
        }

        const state = await requestFromFrontend({ type: 'get_viewport_state' }, 10_000) as {
          activeAsset?: { modelUrl: string; name: string } | null;
        };

        if (!state.activeAsset?.modelUrl) {
          return {
            content: [{ type: 'text' as const, text: 'No model loaded in the viewport. Load a model first.' }],
            isError: true,
          };
        }

        // Download the model from the URL to a local file
        const modelUrl = state.activeAsset.modelUrl;
        const dlRes = await fetch(modelUrl);
        if (!dlRes.ok) {
          return {
            content: [{ type: 'text' as const, text: `Failed to download viewport model (${dlRes.status}): ${modelUrl}` }],
            isError: true,
          };
        }
        const buf = Buffer.from(await dlRes.arrayBuffer());
        const { default: fs } = await import('node:fs');
        const { default: path } = await import('node:path');
        const tmpPath = path.join(getOutputDir(), `viewport_${Date.now()}.glb`);
        fs.writeFileSync(tmpPath, buf);
        glbPath = tmpPath;
      }

      const result = await segment3D(glbPath, {
        point_num: params.point_num,
        prompt_num: params.prompt_num,
        threshold: params.threshold,
        seed: params.seed,
      });

      // Auto-load into viewport if frontend is connected
      let viewportStatus = '';
      if (isFrontendConnected()) {
        try {
          const fileUrl = getFileUrl(result.filePath);
          sendToFrontend({
            type: 'load_model',
            url: fileUrl,
            name: `segmented-model (${result.numParts} parts)`,
          });
          viewportStatus = '\nModel has been loaded into the Phidias viewport.';
        } catch { /* viewport optional */ }
      }

      const publicUrl = getFileUrl(result.filePath);
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Model segmented successfully into ${result.numParts} parts.`,
            ``,
            `File: ${result.filePath}`,
            `URL: ${publicUrl}`,
            `Parts: ${result.numParts}`,
            `Source: ${params.glb_path}`,
            viewportStatus,
            ``,
            `Next step: Use smart_organize to name and group the parts.`,
          ].join('\n'),
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error segmenting model: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: smart_organize
// ---------------------------------------------------------------------------

server.tool(
  'smart_organize',
  `Trigger Smart Organize on the currently loaded segmented model in the Phidias viewport. This uses a Vision Language Model (VLM) to analyze multi-angle screenshots of the model and suggest names and groups for each segmented part.

The results are returned as a list of ALL part naming/grouping suggestions. Present these to the user for review — they may want to correct some names or adjust groupings. This is a collaborative process: review the suggestions together, discuss any corrections, then apply the final result.

Requires: a segmented model loaded in the Phidias viewport (use segment_model + load_model first).`,
  {},
  async () => {
    try {
      if (!isFrontendConnected()) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Frontend not connected. Make sure Phidias is running at http://localhost:3000 with a segmented model loaded.',
          }],
          isError: true,
        };
      }

      // Ask the frontend to run the smart_organize workflow:
      // 1. Capture multi-angle screenshots (original + color-coded)
      // 2. Call /api/phidias/smart-organize with the screenshots
      // 3. Return the VLM naming suggestions
      const response = await requestFromFrontend(
        { type: 'smart_organize' },
        120_000, // 2 min timeout — VLM calls can be slow
      ) as {
        type: string;
        success?: boolean;
        parts?: Array<{ id: string; name: string; group: string }>;
        error?: string;
      };

      if (!response.success || !response.parts) {
        return {
          content: [{
            type: 'text' as const,
            text: `Smart organize failed: ${response.error || 'No results returned'}. Make sure a segmented model is loaded in the viewport.`,
          }],
          isError: true,
        };
      }

      // Format results as a reviewable table
      const grouped = new Map<string, Array<{ id: string; name: string }>>();
      for (const p of response.parts) {
        const group = p.group || 'Ungrouped';
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group)!.push({ id: p.id, name: p.name });
      }

      const lines: string[] = [
        `Smart Organize complete — ${response.parts.length} parts identified.`,
        ``,
        `VLM Naming Suggestions:`,
        `${'─'.repeat(50)}`,
      ];

      for (const [group, parts] of Array.from(grouped.entries())) {
        lines.push(`  ${group}`);
        for (const p of parts) {
          lines.push(`   • ${p.name} (${p.id})`);
        }
        lines.push('');
      }

      lines.push(`${'─'.repeat(50)}`);
      lines.push(`Review the suggestions above with the user.`);
      lines.push(`If any names or groups should be changed, discuss with the user and note the corrections.`);

      return {
        content: [{
          type: 'text' as const,
          text: lines.join('\n'),
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error running smart organize: ${msg}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: download_asset
// ---------------------------------------------------------------------------

server.tool(
  'download_asset',
  'Retrieve a previously generated asset by its asset ID. For images, returns the image inline so Claude can see (and save) it. For 3D models, returns a bridge URL the client can fetch.',
  {
    asset_id: z.string().describe('Asset ID from list_generated_assets or a previous generation tool, e.g. "img_1776913747916".'),
  },
  async ({ asset_id }) => {
    const asset = findAssetById(asset_id);
    if (!asset) {
      return {
        content: [{ type: 'text' as const, text: `Asset not found: ${asset_id}. Use list_generated_assets to see available assets.` }],
        isError: true,
      };
    }

    if (asset.type === 'image') {
      const base64 = fs.readFileSync(asset.filePath).toString('base64');
      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/png' },
          { type: 'text' as const, text: `Asset ${asset.id} (image)\nFile: ${asset.filePath}\nURL: ${getFileUrl(asset.filePath)}` },
        ],
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Asset ${asset.id} (3d model)`,
          `File: ${asset.filePath}`,
          `Download: ${getFileUrl(asset.filePath)}`,
        ].join('\n'),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_generated_assets
// ---------------------------------------------------------------------------

server.tool(
  'list_generated_assets',
  'List all images and 3D models generated in the current session. Shows file paths, types, prompts, and creation times.',
  {},
  async () => {
    const assets = getSessionAssets();

    if (assets.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No assets generated yet in this session.\n\nOutput directory: ${getOutputDir()}\n\nUse generate_image to create a reference image, then generate_3d to create a 3D model.`,
          },
        ],
      };
    }

    const lines = assets.map((a, i) => {
      const parts = [
        `${i + 1}. [${a.type.toUpperCase()}] ${a.filePath}`,
        `   URL: ${getFileUrl(a.filePath)}`,
        `   Asset ID: ${a.id}`,
      ];
      if (a.prompt) parts.push(`   Prompt: "${a.prompt}"`);
      if (a.sourceImagePath) parts.push(`   Source: ${a.sourceImagePath}`);
      parts.push(`   Created: ${a.createdAt}`);
      return parts.join('\n');
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: [
            `Generated assets (${assets.length}):`,
            `Output directory: ${getOutputDir()}`,
            ``,
            ...lines,
          ].join('\n'),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  // Start the bridge server for frontend communication
  startBridge();

  // Start the MCP server for Claude Code communication
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Phidias MCP server failed to start:', err);
  process.exit(1);
});
