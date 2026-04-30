# phidias-mcp-headless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new standalone git repo at `/Users/between2058/Documents/gitlab_code/phidias-mcp/` containing only the headless MCP tools (`generate_image`, `generate_3d`, `segment_model`, `list_generated_assets`) extracted from `phidias-standalone/mcp-server/`, so colleagues on the same network can `git clone` and use it directly in their Claude Code.

**Architecture:** stdio-based Node MCP server, ESM/TypeScript, two source files (`index.ts` with tool definitions, `phidias-client.ts` with fetch calls to 4 internal backend APIs). No WebSocket bridge, no frontend dependency. Distribution via local git clone + `pnpm install && pnpm build`, referenced from Claude Code's `~/.claude.json`.

**Tech Stack:** Node 18+, TypeScript, `@modelcontextprotocol/sdk`, `zod`, `tsx` (dev), `pnpm`.

**Source spec:** `docs/superpowers/specs/2026-04-22-phidias-mcp-headless-design.md`

**Working directory for this plan:** Commands are run from `/Users/between2058/Documents/gitlab_code/` unless stated otherwise.

---

## Task 1: Scaffold the new repo directory + static config files

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/.gitignore`
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/.env.example`
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/tsconfig.json`
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/` (empty dir for now)

- [ ] **Step 1.1: Create the directory tree**

Run:
```bash
mkdir -p /Users/between2058/Documents/gitlab_code/phidias-mcp/src
```
Expected: Command exits 0, directory exists.

- [ ] **Step 1.2: Write `.gitignore`**

Create `/Users/between2058/Documents/gitlab_code/phidias-mcp/.gitignore`:
```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 1.3: Write `.env.example`**

Create `/Users/between2058/Documents/gitlab_code/phidias-mcp/.env.example`:
```
# Phidias backend API URLs.
# Leave empty to use the built-in defaults (172.18.245.177 internal network).
# Override these if you are running backends at different hosts.

QWEN_API_URL=
TRELLIS2_API_URL=
RECONVIAGEN_API_URL=
P3SAM_API_URL=
```

- [ ] **Step 1.4: Write `tsconfig.json`**

Create `/Users/between2058/Documents/gitlab_code/phidias-mcp/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 1.5: Verify files exist**

Run:
```bash
ls -la /Users/between2058/Documents/gitlab_code/phidias-mcp/
```
Expected: sees `.gitignore`, `.env.example`, `tsconfig.json`, `src/`.

---

## Task 2: Write `package.json`

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/package.json`

- [ ] **Step 2.1: Create `package.json`**

Create `/Users/between2058/Documents/gitlab_code/phidias-mcp/package.json`:
```json
{
  "name": "phidias-mcp-headless",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Headless Phidias MCP server — text/image to 3D asset pipeline exposed as MCP tools for Claude Code. No browser frontend required.",
  "bin": {
    "phidias-mcp-headless": "dist/index.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

Notes:
- `private: true` — we do NOT publish to npm; this field prevents accidental publish.
- `ws` dep from the original `mcp-server/package.json` is intentionally omitted — no WebSocket bridge in headless mode.
- `zod` is explicitly declared (the MCP SDK uses it; better as a direct dep).

---

## Task 3: Copy `phidias-client.ts` verbatim

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/phidias-client.ts`
- Source: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/phidias-client.ts`

- [ ] **Step 3.1: Copy the file verbatim**

Run:
```bash
cp /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/phidias-client.ts \
   /Users/between2058/Documents/gitlab_code/phidias-mcp/src/phidias-client.ts
```
Expected: exit 0.

No edits needed. The file already reads backend URLs from `process.env.QWEN_API_URL` etc. with the internal IP defaults (`172.18.245.177:...`) baked in, which matches the spec ("keep hardcoded defaults").

- [ ] **Step 3.2: Verify the copy**

Run:
```bash
head -20 /Users/between2058/Documents/gitlab_code/phidias-mcp/src/phidias-client.ts
```
Expected: sees the file header and the 4 `const ..._API_URL = process.env.... ?? 'http://172.18.245.177:...';` lines.

---

## Task 4: Create the headless `src/index.ts`

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts`

This is NOT a verbatim copy. It is a reduced-and-modified version of the original `mcp-server/src/index.ts` that:
- Removes the `import ... from './bridge.js'` block
- Removes the `startBridge()` call from `main()`
- Removes the `load_model`, `get_viewport_state`, `capture_screenshot`, `smart_organize` tool definitions
- Removes the `"viewport"` branch and the auto-load branch inside `segment_model`
- Removes the auto-load-into-viewport block inside `generate_3d`
- Updates the server name/version/description + header comment

- [ ] **Step 4.1: Write the full headless `index.ts`**

Create `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts` with exactly this content:

```typescript
#!/usr/bin/env node
/**
 * Phidias MCP Server (Headless)
 *
 * Exposes the Phidias 3D asset pipeline as MCP tools for Claude Code.
 * Tools: generate_image, generate_3d, segment_model, list_generated_assets
 *
 * Headless variant — no browser frontend, no WebSocket bridge.
 * All tools are pure backend operations that return file paths on disk.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  generateImage,
  generate3D,
  segment3D,
  getSessionAssets,
  getOutputDir,
} from './phidias-client.js';

const server = new McpServer({
  name: 'phidias-headless',
  version: '0.1.0',
  description: 'Phidias 3D asset creation pipeline (headless) — generate images, 3D models, and segment meshes from the command line',
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

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `Image generated successfully.`,
              ``,
              `File: ${asset.filePath}`,
              `Prompt: "${params.prompt}"`,
              `Asset ID: ${asset.id}`,
              ``,
              `Next step: Use generate_3d with this image path to create a 3D model.`,
            ].join('\n'),
          },
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
If the user hasn't specified which backend to use, ask them. Returns the file path of the generated GLB.`,
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

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `3D model generated successfully (${params.backend}).`,
              ``,
              `File: ${asset.filePath}`,
              `Source image: ${asset.sourceImagePath}`,
              `Asset ID: ${asset.id}`,
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
// Tool: segment_model
// ---------------------------------------------------------------------------

server.tool(
  'segment_model',
  'Segment a 3D model (GLB) into individual parts using P3-SAM AI. Splits a single mesh into meaningful parts (e.g. head, body, legs, arms). Takes 1-3 minutes. Returns the file path of the segmented GLB and the number of parts.',
  {
    glb_path: z.string().describe('Absolute path to a GLB file to segment.'),
    point_num: z.number().int().min(1).max(50).optional().describe('Number of sample points per part (default: 10). Higher = finer segmentation but slower.'),
    prompt_num: z.number().int().min(1).max(20).optional().describe('Number of prompts for segmentation (default: 6).'),
    threshold: z.number().min(0).max(1).optional().describe('Segmentation threshold (default: 0.5). Lower = more parts, higher = fewer parts.'),
    seed: z.number().int().optional().describe('Random seed for reproducibility.'),
  },
  async (params) => {
    try {
      const result = await segment3D(params.glb_path, {
        point_num: params.point_num,
        prompt_num: params.prompt_num,
        threshold: params.threshold,
        seed: params.seed,
      });

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Model segmented successfully into ${result.numParts} parts.`,
            ``,
            `File: ${result.filePath}`,
            `Parts: ${result.numParts}`,
            `Source: ${params.glb_path}`,
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Phidias MCP server failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 4.2: Quick visual verification**

Run:
```bash
grep -c "server.tool(" /Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts
```
Expected: `4` (one per tool).

Run:
```bash
grep -E "bridge|load_model|get_viewport_state|capture_screenshot|smart_organize|isFrontendConnected|sendToFrontend|startBridge" /Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts || echo "clean"
```
Expected: `clean` — none of those symbols should appear.

---

## Task 5: Install dependencies and verify the build

**Files:**
- Generated: `/Users/between2058/Documents/gitlab_code/phidias-mcp/node_modules/`
- Generated: `/Users/between2058/Documents/gitlab_code/phidias-mcp/pnpm-lock.yaml`
- Generated: `/Users/between2058/Documents/gitlab_code/phidias-mcp/dist/index.js`
- Generated: `/Users/between2058/Documents/gitlab_code/phidias-mcp/dist/phidias-client.js`

- [ ] **Step 5.1: Install dependencies**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm install
```
Expected: exit 0, `node_modules/` and `pnpm-lock.yaml` created, no peer-dep warnings about missing `zod`/`@modelcontextprotocol/sdk`.

- [ ] **Step 5.2: Build TypeScript**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build
```
Expected: exit 0, produces `dist/index.js`, `dist/index.d.ts`, `dist/phidias-client.js`, `dist/phidias-client.d.ts`.

- [ ] **Step 5.3: Smoke-test that the server starts and lists 4 tools**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && \
printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}\n{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\n{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}\n' | node dist/index.js 2>/dev/null | tail -1 | python3 -c "import json,sys; d=json.load(sys.stdin); tools=d['result']['tools']; print(f'Total: {len(tools)} tools'); [print(f'  {t[\"name\"]}') for t in tools]"
```
Expected output:
```
Total: 4 tools
  generate_image
  generate_3d
  segment_model
  list_generated_assets
```

If you see any bridge-related tool (`load_model`, etc.), return to Task 4 — the wrong tools are still defined.

---

## Task 6: Write `README.md` (zh-TW)

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/README.md`

- [ ] **Step 6.1: Write `README.md`**

Create `/Users/between2058/Documents/gitlab_code/phidias-mcp/README.md` with exactly this content:

````markdown
# phidias-mcp-headless

Phidias 資產生成 pipeline 的 **headless** MCP server —— 給 Claude Code（或任何 MCP client）用來文字生圖、圖生 3D、3D 模型分割。

**不需要 Phidias 前端**。純後端 pipeline，所有工具輸出都是本機檔案路徑。

---

## 功能

| 工具 | 說明 |
|---|---|
| `generate_image` | 用 Qwen 從 prompt 生參考圖（PNG） |
| `generate_3d` | 從參考圖生 3D 模型（GLB），支援 `trellis2` 高品質 / `reconviagen` 快速 |
| `segment_model` | 用 P3-SAM 把 GLB 切成語意部件（頭、身體、腿……） |
| `list_generated_assets` | 列出當次 session 生成的所有檔案 |

---

## 前提條件

- Node.js 18+
- pnpm
- 同網路能連到 Phidias 內部 API（預設走 `172.18.245.177`）

---

## 安裝

```bash
git clone <this-repo-url> phidias-mcp
cd phidias-mcp
pnpm install
pnpm build
```

這會產出 `dist/index.js`。

---

## 接到 Claude Code

編輯你的 `~/.claude.json`（或 `~/.config/claude-code/claude_desktop_config.json`，依 Claude Code 版本），在 `mcpServers` 區塊加入：

```json
{
  "mcpServers": {
    "phidias": {
      "command": "node",
      "args": ["/絕對路徑/phidias-mcp/dist/index.js"]
    }
  }
}
```

重啟 Claude Code，輸入 `/mcp` 應該會看到 `phidias` 跟 4 個工具。

---

## 環境變數

如果你的後端 API 不在預設內網位址，覆寫下列 env：

| 變數 | 預設值 | 說明 |
|---|---|---|
| `QWEN_API_URL` | `http://172.18.245.177:8190` | 文字生圖 |
| `TRELLIS2_API_URL` | `http://172.18.245.177:52070` | 3D（高品質） |
| `RECONVIAGEN_API_URL` | `http://172.18.245.177:52069` | 3D（快速） |
| `P3SAM_API_URL` | `http://172.18.245.177:5001` | 分割 |

在 Claude Code config 中加 `env` 欄位：

```json
{
  "mcpServers": {
    "phidias": {
      "command": "node",
      "args": ["/絕對路徑/phidias-mcp/dist/index.js"],
      "env": {
        "QWEN_API_URL": "http://your-host:8190",
        "TRELLIS2_API_URL": "http://your-host:52070"
      }
    }
  }
}
```

---

## 使用範例

在 Claude Code 裡直接說：

- 「幫我生成一張太空人的參考圖」
- 「把這張圖變成 3D 模型，用 reconviagen」
- 「把這個 GLB 分割成部件：/path/to/model.glb」
- 「列出目前 session 生成的檔案」

輸出檔案會放在系統暫存目錄（macOS 通常是 `/var/folders/.../phidias-mcp/`），路徑會在工具回應裡告訴你。

---

## 疑難排解

**「Error generating image/3D/segment: fetch failed」**
→ 後端 API 連不到。確認同網路、或設對應的 `*_API_URL` env。

**「Cannot find module 'dist/index.js'」**
→ 忘了 `pnpm build`。

**Claude Code 看不到 `phidias` server**
→ 檢查 `~/.claude.json` 路徑是不是絕對路徑、JSON 有沒有打錯；重啟 Claude Code。

---

## 與 Phidias 前端的關係

這是 `phidias-standalone/mcp-server/` 的 headless 子集。完整版本還有 `load_model`、`get_viewport_state`、`capture_screenshot`、`smart_organize`，它們需要 Phidias 前端（localhost:3000）一起跑。如果你的工作流程需要 live viewport 互動，去用完整版。
````

---

## Task 7: `git init` and initial commit

**Files:**
- Created: `.git/` inside `phidias-mcp/`

- [ ] **Step 7.1: Initialize the git repo**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && git init -b main
```
Expected: "Initialized empty Git repository in .../phidias-mcp/.git/".

- [ ] **Step 7.2: Verify `.gitignore` keeps `node_modules/` and `dist/` out**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && git status --short
```
Expected: sees only `.env.example`, `.gitignore`, `README.md`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `src/index.ts`, `src/phidias-client.ts` (all with `??` untracked). `node_modules/` and `dist/` must NOT appear.

- [ ] **Step 7.3: Stage all tracked files**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && \
git add .gitignore .env.example README.md package.json pnpm-lock.yaml tsconfig.json src/
```
Expected: exit 0.

- [ ] **Step 7.4: Create the initial commit**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && git commit -m "$(cat <<'EOF'
feat: initial headless Phidias MCP server

Extracted from phidias-standalone/mcp-server/ the 4 backend-only tools
(generate_image, generate_3d, segment_model, list_generated_assets) so
colleagues on the same network can install via git clone without needing
the Phidias Next.js frontend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: exit 0, commit created.

- [ ] **Step 7.5: Confirm the commit is clean**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && git log --oneline && git status
```
Expected: one commit shown, working tree clean.

---

## Task 8: Final verification + GitHub push decision

- [ ] **Step 8.1: Double-check the repo is self-contained**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && \
rm -rf node_modules dist && \
pnpm install && pnpm build && \
ls dist/
```
Expected: `pnpm install` + `pnpm build` both exit 0, `dist/index.js` and `dist/phidias-client.js` exist. (This confirms a fresh clone would work.)

- [ ] **Step 8.2: Re-run the 4-tool smoke test**

Run:
```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp && \
printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}\n{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\n{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}\n' | node dist/index.js 2>/dev/null | tail -1 | python3 -c "import json,sys; d=json.load(sys.stdin); tools=d['result']['tools']; print(f'Total: {len(tools)} tools'); [print(f'  {t[\"name\"]}') for t in tools]"
```
Expected:
```
Total: 4 tools
  generate_image
  generate_3d
  segment_model
  list_generated_assets
```

- [ ] **Step 8.3: Ask the user about GitHub push**

STOP and ask the user:
> The new repo at `/Users/between2058/Documents/gitlab_code/phidias-mcp/` is built, tested, and has its first commit. Do you want to push to GitHub now? If yes, I'll need: (a) the repo name on GitHub, (b) whether it should be private, (c) confirmation to run `gh repo create --push`. Otherwise we stop here.

Do NOT run `gh repo create` or `git remote add` / `git push` without explicit user approval for each.

---

## Self-Review Notes

Checked against the spec (`docs/superpowers/specs/2026-04-22-phidias-mcp-headless-design.md`):

- ✅ Location: `/Users/between2058/Documents/gitlab_code/phidias-mcp/` (Task 1)
- ✅ Fresh `git init` (Task 7)
- ✅ Package name `phidias-mcp-headless`, `private: true` (Task 2)
- ✅ 4-tool set correct: `generate_image`, `generate_3d`, `segment_model`, `list_generated_assets` (Task 4, verified Step 5.3 & 8.2)
- ✅ Backend URLs preserved as hardcoded defaults (Task 3 — copied verbatim)
- ✅ README in zh-TW (Task 6)
- ✅ No LICENSE file created (matches "no license" decision)
- ✅ `bridge.ts` not copied, `ws` dep removed (Task 2, 3)
- ✅ `segment_model` "viewport" branch removed (Task 4)
- ✅ `generate_3d` auto-load removed (Task 4)
- ✅ `startBridge()` call removed (Task 4)
- ✅ Build + smoke-test steps included (Task 5, 8)
- ✅ GitHub push gated on user approval (Task 8.3)

Types/symbols consistency:
- `generateImage`, `generate3D`, `segment3D`, `getSessionAssets`, `getOutputDir` imported from `./phidias-client.js` — all exist in the source file (verified by inspection before plan was written).
- No forward references to undefined symbols.
