# phidias-mcp File Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let MCP clients retrieve generated assets from both the headless HTTP-mode server and the standalone bridge-mode server — images as inline MCP `image` content, GLB files via HTTP URL.

**Architecture:** Two-repo change. In `phidias-mcp` (headless), add a `/files/` HTTP route on the same `http.Server` that hosts `/mcp`, an `AsyncLocalStorage` request context so tool handlers can derive public URLs from the incoming `Host` header, a new `download_asset` tool, and inline image content in `generate_image`. In `phidias-standalone/mcp-server`, mirror the behavioral changes (inline image, URL-in-text, `download_asset`) — the bridge already runs `/files/` on port 9800, it only needs auth parity with `MCP_AUTH_TOKEN`.

**Tech Stack:** Node 22, TypeScript ES2022 ESM, `@modelcontextprotocol/sdk`, stdlib `node:http` + `node:fs` + `node:path` + `node:async_hooks`, no new deps.

**Paths:**
- Repo A (headless): `/Users/between2058/Documents/gitlab_code/phidias-mcp/`
- Repo B (standalone): `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/`
- Spec: `docs/superpowers/specs/2026-04-23-phidias-mcp-file-retrieval-design.md`

**Testing approach:** Neither repo has a test framework. Verification uses `curl` against a live server and MCP request fixtures via `http` POST. Each task has concrete verification commands with expected output.

---

## Phase 1 — phidias-mcp (headless)

### Task 1: Add file-serving helper module

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/file-serving.ts`

- [ ] **Step 1: Create the file**

```ts
// src/file-serving.ts
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { getOutputDir } from './phidias-client.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.usdz': 'model/vnd.usdz+zip',
};

export function getMimeType(ext: string): string {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Serve a file from the output directory. Returns true if handled.
 * Enforces path safety: only basename is honored, no traversal, no dotfiles.
 * If `token` is provided, requires matching Bearer header.
 */
export function serveFileIfMatch(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  token: string | undefined,
): boolean {
  if (!req.url?.startsWith('/files/')) return false;

  // CORS (match bridge.ts behavior)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (token) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid bearer token' }));
      return true;
    }
  }

  const raw = decodeURIComponent(req.url.slice('/files/'.length));
  const safeName = path.basename(raw);
  if (!safeName || safeName.startsWith('.') || safeName !== raw) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return true;
  }

  const filePath = path.join(getOutputDir(), safeName);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': getMimeType(ext),
    'Content-Length': stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/file-serving.ts
git commit -m "feat: add file-serving helper with path safety and optional bearer auth"
```

---

### Task 2: Add request-context module (AsyncLocalStorage)

**Files:**
- Create: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/request-context.ts`

- [ ] **Step 1: Create the file**

```ts
// src/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import type http from 'node:http';

export interface RequestContext {
  publicUrlBase: string; // e.g. "http://172.18.245.177:7777"
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function buildPublicUrlBase(req: http.IncomingMessage): string {
  const host = req.headers.host ?? 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
  return `${proto}://${host}`;
}

/**
 * Build a public URL for a file in the output directory, using the current
 * HTTP request's Host header. Returns null in stdio mode (no request context).
 */
export function makeFileUrl(filePath: string): string | null {
  const ctx = requestContext.getStore();
  if (!ctx) return null;
  const fileName = path.basename(filePath);
  return `${ctx.publicUrlBase}/files/${encodeURIComponent(fileName)}`;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/request-context.ts
git commit -m "feat: add request-context with Host-header-derived public URL"
```

---

### Task 3: Wire /files/ route and AsyncLocalStorage into HTTP transport

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts`

- [ ] **Step 1: Update imports**

Add these imports below the existing ones at the top of the file (lines 12–23):

```ts
import { serveFileIfMatch } from './file-serving.js';
import { buildPublicUrlBase, requestContext } from './request-context.js';
```

- [ ] **Step 2: Modify `startHttp()` to handle /files/ and wrap MCP in ALS**

Replace the body of `http.createServer(async (req, res) => { ... })` (originally lines 251–293) with:

```ts
  const httpServer = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: 'phidias-mcp-headless' }));
      return;
    }

    // File retrieval (same auth posture as /mcp)
    if (serveFileIfMatch(req, res, token)) return;

    if (!req.url || !req.url.startsWith('/mcp')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found. MCP endpoint is at /mcp, files at /files/<name>');
      return;
    }

    if (token) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid bearer token' }));
        return;
      }
    }

    const requestServer = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      transport.close().catch(() => {});
      requestServer.close().catch(() => {});
    });

    const publicUrlBase = buildPublicUrlBase(req);
    await requestContext.run({ publicUrlBase }, async () => {
      try {
        await requestServer.connect(transport);
        await transport.handleRequest(req, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[phidias-mcp] handleRequest error: ${msg}\n`);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: msg }));
        }
      }
    });
  });
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 4: Smoke-test /files/ locally**

Start the server in one shell:

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
MCP_HTTP_PORT=7777 MCP_HTTP_HOST=127.0.0.1 pnpm start
```

In another shell, put a test file and hit it:

```bash
mkdir -p /tmp/phidias-mcp
echo hello > /tmp/phidias-mcp/smoketest.txt
curl -sS -o /tmp/out.txt -w "%{http_code}\n" http://127.0.0.1:7777/files/smoketest.txt
cat /tmp/out.txt
# Expected: 200 and "hello"

curl -sS -w "%{http_code}\n" -o /dev/null "http://127.0.0.1:7777/files/..%2Fetc%2Fpasswd"
# Expected: 404

curl -sS -w "%{http_code}\n" -o /dev/null "http://127.0.0.1:7777/files/does-not-exist.png"
# Expected: 404
```

Stop the server (Ctrl-C).

- [ ] **Step 5: Smoke-test with auth**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
MCP_AUTH_TOKEN=secret123 MCP_HTTP_PORT=7777 MCP_HTTP_HOST=127.0.0.1 pnpm start
```

```bash
curl -sS -w "%{http_code}\n" -o /dev/null http://127.0.0.1:7777/files/smoketest.txt
# Expected: 401

curl -sS -w "%{http_code}\n" -o /dev/null -H "Authorization: Bearer secret123" http://127.0.0.1:7777/files/smoketest.txt
# Expected: 200
```

Stop the server.

- [ ] **Step 6: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/index.ts
git commit -m "feat: serve /files/ alongside /mcp; wrap handleRequest in AsyncLocalStorage for public URL context"
```

---

### Task 4: Add `findAssetById` to phidias-client.ts

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/phidias-client.ts` (after line 44, after `getSessionAssets`)

- [ ] **Step 1: Add the helper**

Insert directly after the `getSessionAssets` function:

```ts
export function findAssetById(id: string): GeneratedAsset | undefined {
  return sessionAssets.find((a) => a.id === id);
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/phidias-client.ts
git commit -m "feat: add findAssetById lookup for download_asset tool"
```

---

### Task 5: Update `generate_image` to return inline image + URL

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts` (generate_image handler, originally lines 52–85)

- [ ] **Step 1: Add import for fs + makeFileUrl**

At the top of the file, add:

```ts
import fs from 'node:fs';
import { makeFileUrl } from './request-context.js';
```

- [ ] **Step 2: Replace the handler body**

Replace the `async (params) => { ... }` body of the `generate_image` tool with:

```ts
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
        const textLines: string[] = [
          'Image generated successfully.',
          '',
          `File: ${asset.filePath}`,
        ];
        const url = makeFileUrl(asset.filePath);
        if (url) textLines.push(`URL: ${url}`);
        textLines.push(`Prompt: "${params.prompt}"`);
        textLines.push(`Asset ID: ${asset.id}`);
        textLines.push('', 'Next step: Use generate_3d with this image path or URL to create a 3D model.');

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
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/index.ts
git commit -m "feat: generate_image returns inline image content and public URL"
```

---

### Task 6: Update `generate_3d` and `segment_model` text output with URL

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts`

- [ ] **Step 1: Patch `generate_3d` text**

Replace the `return { content: [...] };` inside `generate_3d` (originally lines 120–133) with:

```ts
        const lines: string[] = [
          `3D model generated successfully (${params.backend}).`,
          '',
          `File: ${asset.filePath}`,
        ];
        const url = makeFileUrl(asset.filePath);
        if (url) lines.push(`URL: ${url}`);
        lines.push(`Source image: ${asset.sourceImagePath}`);
        lines.push(`Asset ID: ${asset.id}`);

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
```

- [ ] **Step 2: Patch `segment_model` text**

Replace the `return { content: [...] };` inside `segment_model` (originally lines 167–177) with:

```ts
        const lines: string[] = [
          `Model segmented successfully into ${result.numParts} parts.`,
          '',
          `File: ${result.filePath}`,
        ];
        const url = makeFileUrl(result.filePath);
        if (url) lines.push(`URL: ${url}`);
        lines.push(`Parts: ${result.numParts}`);
        lines.push(`Source: ${params.glb_path}`);

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/index.ts
git commit -m "feat: include public URL in generate_3d and segment_model output"
```

---

### Task 7: Update `list_generated_assets` to include URL per asset

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts`

- [ ] **Step 1: Patch the map**

Replace the `const lines = assets.map(...)` block in `list_generated_assets` (originally lines 211–219) with:

```ts
      const lines = assets.map((a, i) => {
        const parts = [
          `${i + 1}. [${a.type.toUpperCase()}] ${a.filePath}`,
        ];
        const url = makeFileUrl(a.filePath);
        if (url) parts.push(`   URL: ${url}`);
        if (a.prompt) parts.push(`   Prompt: "${a.prompt}"`);
        if (a.sourceImagePath) parts.push(`   Source: ${a.sourceImagePath}`);
        parts.push(`   Asset ID: ${a.id}`);
        parts.push(`   Created: ${a.createdAt}`);
        return parts.join('\n');
      });
```

(Also adds `Asset ID` per line — useful for `download_asset`.)

- [ ] **Step 2: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/index.ts
git commit -m "feat: list_generated_assets includes URL and asset id per entry"
```

---

### Task 8: Add `download_asset` tool

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/index.ts`
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-mcp/src/phidias-client.ts` (export `findAssetById` was done in Task 4)

- [ ] **Step 1: Add findAssetById to imports**

Update the import block (line 17–23 area) to include `findAssetById`:

```ts
import {
  generateImage,
  generate3D,
  segment3D,
  getSessionAssets,
  getOutputDir,
  findAssetById,
} from './phidias-client.js';
```

- [ ] **Step 2: Add the tool**

Insert the following new `server.tool(...)` call inside `createServer()` directly before `list_generated_assets`:

```ts
  // -------------------------------------------------------------------------
  // Tool: download_asset
  // -------------------------------------------------------------------------

  server.tool(
    'download_asset',
    'Retrieve a previously generated asset by its asset ID. For images, returns the image inline so Claude can see (and save) it. For 3D models, returns a download URL (HTTP mode) or local path (stdio mode) that the client can fetch.',
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
        const textLines = [`Asset ${asset.id} (image)`, `File: ${asset.filePath}`];
        const url = makeFileUrl(asset.filePath);
        if (url) textLines.push(`URL: ${url}`);
        return {
          content: [
            { type: 'image' as const, data: base64, mimeType: 'image/png' },
            { type: 'text' as const, text: textLines.join('\n') },
          ],
        };
      }

      // 3D model
      const lines = [`Asset ${asset.id} (3d model)`, `File: ${asset.filePath}`];
      const url = makeFileUrl(asset.filePath);
      if (url) lines.push(`Download: ${url}`);
      else lines.push('Stdio mode — the client is on the same machine; read from File path directly.');
      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-mcp && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
git add src/index.ts src/phidias-client.ts
git commit -m "feat: add download_asset tool with image-inline / GLB-URL dispatch"
```

---

### Task 9: End-to-end verification (headless HTTP mode)

- [ ] **Step 1: Start the server**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-mcp
MCP_HTTP_PORT=7778 MCP_HTTP_HOST=127.0.0.1 pnpm start
```

(Using 7778 to avoid clashing with the deployed 7777.)

- [ ] **Step 2: Send a generate_image MCP request**

In another shell:

```bash
curl -sS -X POST http://127.0.0.1:7778/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_image","arguments":{"prompt":"a red apple, front view, clean background"}}}' \
  | tee /tmp/generate_image_response.txt | head -c 600
echo
```

Expected: a JSON-RPC response (or `text/event-stream` with `data:` lines) containing `"type":"image"` with `"data"` (base64) and `"mimeType":"image/png"`, plus a text block containing `URL: http://127.0.0.1:7778/files/img_...png`.

- [ ] **Step 3: Download the URL it returned**

Extract the URL and curl it:

```bash
URL=$(grep -oE 'http://127\.0\.0\.1:7778/files/[A-Za-z0-9._%-]+\.png' /tmp/generate_image_response.txt | head -1)
echo "URL=$URL"
curl -sS -o /tmp/downloaded.png -w "%{http_code} %{size_download}\n" "$URL"
file /tmp/downloaded.png
```

Expected: 200, nonzero size, `file` says `PNG image data`.

- [ ] **Step 4: Call download_asset with the image id**

```bash
ASSET_ID=$(grep -oE '"img_[0-9]+"' /tmp/generate_image_response.txt | head -1 | tr -d '"')
[ -z "$ASSET_ID" ] && ASSET_ID=$(grep -oE 'img_[0-9]+' /tmp/generate_image_response.txt | head -1)
echo "ASSET_ID=$ASSET_ID"

curl -sS -X POST http://127.0.0.1:7778/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"download_asset\",\"arguments\":{\"asset_id\":\"$ASSET_ID\"}}}" \
  | head -c 400
```

Expected: response contains `"type":"image"` and base64 data.

- [ ] **Step 5: Stop the server**

Ctrl-C the running server process.

- [ ] **Step 6: No commit for verification**

(Verification only. If something failed, go back to the relevant task.)

---

## Phase 2 — phidias-standalone/mcp-server

### Task 10: Mirror `findAssetById` to standalone's phidias-client.ts

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/phidias-client.ts` (after `getSessionAssets`, same as Task 4)

- [ ] **Step 1: Add the helper**

Insert directly after `export function getSessionAssets()` (around line 44):

```ts
export function findAssetById(id: string): GeneratedAsset | undefined {
  return sessionAssets.find((a) => a.id === id);
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git add mcp-server/src/phidias-client.ts
git commit -m "feat(mcp): add findAssetById lookup helper"
```

---

### Task 11: Add MCP_AUTH_TOKEN check to bridge.ts /files/

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/bridge.ts`

- [ ] **Step 1: Read env and enforce Bearer on /files/**

In `bridge.ts`, inside the `httpServer = http.createServer((req, res) => { ... })` block, modify the `/files/` handler (currently lines ~75–96) to respect `MCP_AUTH_TOKEN`.

Replace the `if (req.url?.startsWith('/files/'))` block with:

```ts
    if (req.url?.startsWith('/files/')) {
      const token = process.env.MCP_AUTH_TOKEN;
      if (token) {
        const auth = req.headers.authorization;
        if (auth !== `Bearer ${token}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid bearer token' }));
          return;
        }
      }

      const fileName = decodeURIComponent(req.url.slice('/files/'.length));
      const safeName = path.basename(fileName);
      if (!safeName || safeName.startsWith('.') || safeName !== fileName) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const filePath = path.join(outputDir, safeName);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const stat = fs.statSync(filePath);

      res.writeHead(200, {
        'Content-Type': getMimeType(ext),
        'Content-Length': stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
```

- [ ] **Step 2: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git add mcp-server/src/bridge.ts
git commit -m "feat(mcp): enforce MCP_AUTH_TOKEN on bridge /files/ when set, tighten path safety"
```

---

### Task 12: Update `generate_image` to return inline image (standalone)

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/index.ts`

- [ ] **Step 1: Add imports**

At the top of the file, add:

```ts
import fs from 'node:fs';
```

(The `getFileUrl` import from `./bridge.js` is already present.)

- [ ] **Step 2: Replace the handler body**

Replace the body of `async (params) => { ... }` inside the `generate_image` tool (originally lines 51–84) with:

```ts
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
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git add mcp-server/src/index.ts
git commit -m "feat(mcp): generate_image returns inline image content and bridge URL"
```

---

### Task 13: Add URL line to `generate_3d` and `segment_model` text (standalone)

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/index.ts`

- [ ] **Step 1: Patch `generate_3d` response**

Inside the `generate_3d` handler, after computing `viewportStatus` and before the `return`, the existing response builds a text with `File: ${asset.filePath}` then `Source image:` etc. Replace the `return { content: [...] };` block (originally lines 135–149) with:

```ts
      const url = getFileUrl(asset.filePath);
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `3D model generated successfully (${params.backend}).`,
              '',
              `File: ${asset.filePath}`,
              `URL: ${url}`,
              `Source image: ${asset.sourceImagePath}`,
              `Asset ID: ${asset.id}`,
              viewportStatus,
            ].join('\n'),
          },
        ],
      };
```

- [ ] **Step 2: Patch `segment_model` response**

Replace the final `return { content: [...] };` of `segment_model` (originally lines 417–431) with:

```ts
      const publicUrl = getFileUrl(result.filePath);
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Model segmented successfully into ${result.numParts} parts.`,
            '',
            `File: ${result.filePath}`,
            `URL: ${publicUrl}`,
            `Parts: ${result.numParts}`,
            `Source: ${params.glb_path}`,
            viewportStatus,
            '',
            'Next step: Use smart_organize to name and group the parts.',
          ].join('\n'),
        }],
      };
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git add mcp-server/src/index.ts
git commit -m "feat(mcp): include bridge URL in generate_3d and segment_model output"
```

---

### Task 14: Update `list_generated_assets` with URLs (standalone)

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/index.ts`

- [ ] **Step 1: Patch the map**

Replace the `const lines = assets.map(...)` block inside `list_generated_assets` (originally lines 555–563) with:

```ts
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
```

- [ ] **Step 2: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server && pnpm build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git add mcp-server/src/index.ts
git commit -m "feat(mcp): include URL and asset id in list_generated_assets"
```

---

### Task 15: Add `download_asset` tool (standalone)

**Files:**
- Modify: `/Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server/src/index.ts`

- [ ] **Step 1: Add findAssetById import**

Update the phidias-client import block (originally lines 15–21) to include `findAssetById`:

```ts
import {
  generateImage,
  generate3D,
  segment3D,
  getSessionAssets,
  getOutputDir,
  findAssetById,
} from './phidias-client.js';
```

- [ ] **Step 2: Add the tool**

Insert directly before the `list_generated_assets` tool definition (`server.tool('list_generated_assets', ...)`):

```ts
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
```

- [ ] **Step 3: Build**

Run: `cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone
git add mcp-server/src/index.ts
git commit -m "feat(mcp): add download_asset tool with image-inline / GLB-URL dispatch"
```

---

### Task 16: End-to-end verification (standalone bridge mode)

- [ ] **Step 1: Start the standalone MCP server via stdio + bridge**

Standalone MCP is stdio + bridge. To verify the bridge file serving without running a full MCP client, start just the server and poke the bridge on :9800.

```bash
cd /Users/between2058/Documents/gitlab_code/phidias-standalone/mcp-server
pnpm start &
SERVER_PID=$!
sleep 2
```

- [ ] **Step 2: Smoke-test /files/**

```bash
echo hello > /tmp/phidias-mcp/smoketest.txt
curl -sS -o /tmp/out.txt -w "%{http_code}\n" http://localhost:9800/files/smoketest.txt
cat /tmp/out.txt
# Expected: 200 and "hello"

curl -sS -w "%{http_code}\n" -o /dev/null "http://localhost:9800/files/..%2Fetc%2Fpasswd"
# Expected: 404
```

- [ ] **Step 3: Smoke-test /files/ with auth**

```bash
kill $SERVER_PID
MCP_AUTH_TOKEN=secret123 pnpm start &
SERVER_PID=$!
sleep 2

curl -sS -w "%{http_code}\n" -o /dev/null http://localhost:9800/files/smoketest.txt
# Expected: 401

curl -sS -w "%{http_code}\n" -o /dev/null -H "Authorization: Bearer secret123" http://localhost:9800/files/smoketest.txt
# Expected: 200
```

- [ ] **Step 4: Stop the server**

```bash
kill $SERVER_PID
```

- [ ] **Step 5: Viewport regression (manual, optional)**

If the Phidias frontend is running on `localhost:3000` and you have time, restart the standalone MCP without `MCP_AUTH_TOKEN`, then call `generate_3d` through Claude Code (or skip if no frontend). Verify the model still auto-loads into the viewport. This confirms the changes to `generate_3d` text output didn't break the `sendToFrontend` flow.

No commit for verification.

---

## Cross-cutting notes

- **Image size concern:** Qwen's default 1:1 output is ~1–2MB on disk. Base64 → ~2–3MB in the MCP response. Acceptable for now per spec; revisit if user reports slow transcripts.
- **The headless repo is `private: true` and has its own git history.** All commits above against `/Users/between2058/Documents/gitlab_code/phidias-mcp` are local; pushing is out of scope.
- **The standalone MCP's `bridge.ts` is started from `index.ts:main()`. It stays backwards-compatible:** all new behavior keys on `process.env.MCP_AUTH_TOKEN` being set.

## Self-review checklist

1. ✅ **Spec coverage** — every bullet in the decision table maps to a task: two-repo sync (Phase 1 + Phase 2), hybrid transport (Tasks 5, 6, 8, 12, 13, 15), Host-header URL (Tasks 2, 3), auth parity (Tasks 3, 11), `download_asset` (Tasks 8, 15), stdio fallback to path (Tasks 5, 8, 15 — `makeFileUrl` returns null; handlers fall back to `File:` path only).
2. ✅ **No placeholders** — every code step has full code; every verify step has concrete curl + expected output.
3. ✅ **Type consistency** — `findAssetById`, `GeneratedAsset`, `makeFileUrl`, `getFileUrl` (standalone-only), `requestContext` used consistently across tasks.
4. ✅ **Scope** — single focused change; both repos covered in one plan since the modifications are small and parallel in structure.
