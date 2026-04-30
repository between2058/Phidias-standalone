# phidias-mcp 遠端檔案取得設計

**Date**: 2026-04-23
**Status**: Approved
**Scope**: `phidias-standalone/mcp-server/` + `phidias-mcp/`（headless）

## 背景

目前 phidias-mcp-headless 以 HTTP mode 部署在內網（`http://172.18.245.177:7777/mcp`）。remote client 呼叫 `generate_image` 等工具後，tool 回傳的 `/tmp/phidias-mcp/xxx.png` 是 **remote 主機**上的路徑，client 本機拿不到檔案。

## 目標

讓任何 MCP client（stdio 本機 / HTTP remote）都能實際拿到生成的資產。

## 決策摘要

| 項目 | 決策 |
|---|---|
| 作用範圍 | 兩個 repo 同步更新（phidias-standalone/mcp-server + phidias-mcp headless） |
| 傳輸策略 | 混合：image inline base64、GLB 以 HTTP URL |
| URL 推斷 | HTTP mode 從 request `Host` header 推斷 |
| Auth | `/files/` 比照 `/mcp`：`MCP_AUTH_TOKEN` 有設則要 Bearer，沒設則開放 |
| 新 tool | `download_asset(asset_id)`：吃 asset id，自動判斷 inline/url |
| Stdio headless | 仍回傳本機 path，不啟 HTTP file server |

## 行為矩陣

| Tool | Stdio 本機 | HTTP Remote |
|---|---|---|
| `generate_image` | text(path) + inline `image` content | text(path + public URL) + inline `image` content |
| `generate_3d` | text(path) | text(path + public URL) |
| `segment_model` | text(path) | text(path + public URL) |
| `download_asset` | image→inline / GLB→path | image→inline / GLB→public URL |
| `list_generated_assets` | 列 path | 列 path + public URL |

## HTTP 檔案路由（phidias-mcp headless）

新增到 `startHttp()` 內的 `http.createServer` callback：

- 路徑：`GET /files/<basename>`（URL-decoded）
- 安全：`path.basename()` 清洗檔名、拼到 `getOutputDir()`；拒絕 `..`、絕對路徑、隱藏檔（以 `.` 開頭）
- Auth：若 `MCP_AUTH_TOKEN` 環境變數有設，驗 `Authorization: Bearer <token>`；否則放行
- 回應：`200` + `Content-Type` (查表) + `Content-Length`；不存在回 `404`
- CORS：`Access-Control-Allow-Origin: *`（跟 standalone bridge 保持一致）
- 串流：`fs.createReadStream(filePath).pipe(res)`

MIME 對應：沿用 `bridge.ts` 的 `getMimeType()`（`.png`、`.jpg`、`.glb` 等）。抽成共用 helper 放在 headless 的 `src/file-serving.ts`。

## Host header 推斷 public URL

MCP SDK 的 tool handler 收不到原始 HTTP request。解法：在 HTTP transport 的 `handleRequest()` 外層用 Node 內建 `AsyncLocalStorage` 包裝，把 `{ host }` 放進 context；tool handler 從 context 抓。

```ts
// src/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  publicUrlBase: string; // e.g., "http://172.18.245.177:7777"
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function buildPublicUrlBase(req: http.IncomingMessage): string {
  const host = req.headers.host ?? 'localhost';
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  return `${proto}://${host}`;
}

export function makeFileUrl(filePath: string): string | null {
  const ctx = requestContext.getStore();
  if (!ctx) return null; // stdio mode, no request context
  const fileName = path.basename(filePath);
  return `${ctx.publicUrlBase}/files/${encodeURIComponent(fileName)}`;
}
```

用法：

```ts
// startHttp: wrap handleRequest
await requestContext.run({ publicUrlBase: buildPublicUrlBase(req) }, async () => {
  await requestServer.connect(transport);
  await transport.handleRequest(req, res);
});

// tool handler:
const url = makeFileUrl(asset.filePath); // null in stdio mode
```

## 新 tool:`download_asset`

```ts
server.tool(
  'download_asset',
  'Retrieve a previously generated asset by its asset ID. For images, returns the image inline so Claude can see it. For 3D models (GLB), returns a download URL the client can fetch.',
  {
    asset_id: z.string().describe('Asset ID from list_generated_assets or a previous generation tool, e.g. "img_1776913747916".'),
  },
  async ({ asset_id }) => {
    const asset = findAssetById(asset_id); // lookup in session list
    if (!asset) return { content: [{ type: 'text', text: `Asset not found: ${asset_id}` }], isError: true };

    if (asset.type === 'image') {
      const data = fs.readFileSync(asset.filePath).toString('base64');
      return {
        content: [
          { type: 'image', data, mimeType: 'image/png' },
          { type: 'text', text: `Asset ${asset_id} (image)\nPath: ${asset.filePath}` },
        ],
      };
    }

    // 3D model
    const url = makeFileUrl(asset.filePath);
    const lines = [`Asset ${asset_id} (3d)`, `Path: ${asset.filePath}`];
    if (url) lines.push(`Download: ${url}`);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);
```

`findAssetById`：為 `phidias-client.ts` 的 `sessionAssets` 列表加 lookup helper（用現有 `id` 欄位）。

## `generate_image` 回傳 inline image（兩個 repo 都改）

目前：只回傳 text。改成：

```ts
const imageData = fs.readFileSync(asset.filePath).toString('base64');
const textLines = [
  'Image generated successfully.',
  ``,
  `File: ${asset.filePath}`,
];
const url = makeFileUrl(asset.filePath);
if (url) textLines.push(`URL: ${url}`);
textLines.push(`Prompt: "${params.prompt}"`);
textLines.push(`Asset ID: ${asset.id}`);
textLines.push(``, `Next step: Use generate_3d with this image path or URL to create a 3D model.`);

return {
  content: [
    { type: 'image' as const, data: imageData, mimeType: 'image/png' },
    { type: 'text' as const, text: textLines.join('\n') },
  ],
};
```

**注意**：預設 Qwen 圖 ~1–2MB，base64 後 ~2–3MB，可接受。若之後要對大圖做 size cap，再加 guard。

## `generate_3d` / `segment_model` 附 URL

現有文字輸出保留，在 `File: ${asset.filePath}` 下多一行 `URL: <public url>`（只有 HTTP mode 會有）。phidias-standalone/mcp-server 的 `generate_3d` 也沿用這格式；它已透過 `bridge.getFileUrl()` 有 `localhost:9800/files/` URL，把那個 URL 也寫進 response text 即可（目前只送到 frontend，沒給 Claude 看）。

## `list_generated_assets` 附 URL

在每個 asset 的列印下多一行 `URL: <public url>`（HTTP mode）。stdio 保持原樣只列 path。

## phidias-standalone/mcp-server 的差異

該 repo 的 `bridge.ts` 已經跑 HTTP server 在 `localhost:9800`，本來就有 `/files/` 路由。改動：

1. `bridge.ts`：若 `MCP_AUTH_TOKEN` 有設，對 `/files/` 加 Bearer 檢查（對齊 headless 行為）
2. `index.ts`:
   - `generate_image` handler 加 inline `image` content
   - `generate_3d` handler 的文字輸出多一行 `URL: ${getFileUrl(asset.filePath)}`
   - `segment_model` handler 的文字輸出多一行 URL
   - 加 `download_asset` tool（用 `getFileUrl()` 組 URL）

此 repo 的 `getFileUrl()` 永遠是 `http://localhost:9800/...`，不需要 AsyncLocalStorage（URL base 固定）。

## 測試計畫

Remote (HTTP mode) 驗證：
1. `curl -I http://172.18.245.177:7777/files/<existing-file>` → 200
2. `curl -I http://172.18.245.177:7777/files/../etc/passwd` → 404（`path.basename` 防護）
3. 設 `MCP_AUTH_TOKEN=xxx` 重啟後，無 Bearer 打 `/files/` → 401
4. Claude Code 呼叫 `generate_image`，response 含 inline image 且看得到貓
5. Claude Code 用 response 裡的 URL `curl` 下載圖，md5 相符
6. 呼叫 `generate_3d`，response 有 URL，curl 可下 GLB
7. 呼叫 `download_asset(img_id)` → inline；`download_asset(glb_id)` → URL

Stdio (本機) 驗證：
8. `phidias-standalone/mcp-server` 啟動，frontend 跑在 :3000
9. 呼叫 `generate_image`，inline image 可見，viewport 未被破壞
10. 呼叫 `generate_3d`，model 仍自動載入 viewport（回歸測試）

## 非目標

- 不做檔案大小門檻（image 很大時強制轉 URL）——之後有需要再加
- 不支援 `PUBLIC_FILE_URL_BASE` env override——內網直連 IP，Host header 夠用
- 不做 TTL / 清理機制——沿用現有 `/tmp/phidias-mcp/`，OS tmp cleanup 處理
- 不做 HEAD / range requests——GLB 檔 <100MB，完整下載足夠

## 風險

- **Base64 in MCP response**：Qwen 圖 1–2MB 送到 Claude Code 會進 transcript，多輪對話會累積 token。可接受但要注意；若未來發現 context 爆很快，再加 size cap。
- **無 auth 情境下的 /files/ 暴露**：內網現狀就無 auth，/files/ 只多一層可列舉。檔名是時間戳隨機，爆破風險低。若之後對外開放，要同時開 `MCP_AUTH_TOKEN`。
- **AsyncLocalStorage 在 tool handler 內的正確性**：MCP SDK 的 `handleRequest` 是 async，只要 `run()` 把整段包住、transport 不跨 request 共用就沒問題；每個 HTTP request 建一個新 `transport` + `server` pair（headless 已經這樣寫），天然隔離。
