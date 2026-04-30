# phidias-mcp-headless 獨立 repo 設計

**Date**: 2026-04-22
**Status**: Approved
**Source**: `phidias-standalone/mcp-server/` 的 headless 子集

## 目標

把現有 `mcp-server/` 裡「不需要 Phidias 前端即可使用」的 4 個工具抽出成獨立 git repo，讓同網路的其他工程師可以 `git clone` 下來在自己的 Claude Code 用來生圖、生 3D、分割模型。

## 決策摘要

| 項目 | 決策 |
|---|---|
| 位置 | `/Users/between2058/Documents/gitlab_code/phidias-mcp/`（`phidias-standalone/` 旁邊） |
| Git | 全新 repo，`git init`，乾淨 commit 歷史 |
| Package name | `phidias-mcp-headless` |
| 工具集 | `generate_image`, `generate_3d`, `segment_model` (file-path only), `list_generated_assets` |
| 後端 API 預設值 | 保留現有 hardcoded 內網 IP（`172.18.245.177:...`），可用 env 覆寫 |
| README 語言 | 繁體中文 |
| License | 無（內部使用） |
| `private` | `true`（不發 npm） |

## 檔案結構

```
phidias-mcp/
├── .gitignore             # node_modules, dist, .env
├── .env.example           # 4 個 API URL 範例
├── README.md              # zh-TW
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           # MCP server 入口 + 4 個工具
    └── phidias-client.ts  # 後端 API client（沿用）
```

不複製：`bridge.ts`、`dist/`、`node_modules/`。

## 從 `mcp-server/` 抽取的內容

### `src/phidias-client.ts`
**完全沿用**，不做任何修改。包含 4 個後端 URL 常數與對應的 fetch 流程（Qwen / Trellis2 / ReconViaGen / P3SAM）。

### `src/index.ts`
複製後做以下移除：
- `import` 區塊：移除 `from './bridge.js'` 的所有 symbols（`startBridge`, `sendToFrontend`, `requestFromFrontend`, `isFrontendConnected`, `getFileUrl`）
- `startBridge()` 呼叫
- 工具定義：移除 `load_model`、`get_viewport_state`、`capture_screenshot`、`smart_organize`
- `segment_model` 工具：拿掉 `glb_path === "viewport"` 的分支（需要前端的情境），只支援 absolute file path
- `generate_3d` 工具內部：拿掉「自動 `sendToFrontend({ type: 'load_model' })`」那段，改為只回傳檔案路徑與提示

### `package.json`（修改後）
- `name`: `phidias-mcp-headless`
- `version`: `0.1.0`
- `private`: `true`
- `description`: 一句話說明
- `bin`: `{ "phidias-mcp-headless": "dist/index.js" }` — 讓 Claude Code config 可用 `npx` 或全域指令
- `files`: `["dist"]`
- `scripts`: 沿用（`start`, `build`, `dev`）
- `dependencies`: `@modelcontextprotocol/sdk`, （**移除 `ws`**，不再需要）
- `devDependencies`: 沿用

### `tsconfig.json`
沿用現有設定（ES2022 output、ESM、`dist/` 輸出）。

### `.gitignore`
```
node_modules/
dist/
.env
.env.local
*.log
```

### `.env.example`
```
# Phidias 後端 API URLs（不設則用內網預設 172.18.245.177）
QWEN_API_URL=
TRELLIS2_API_URL=
RECONVIAGEN_API_URL=
P3SAM_API_URL=
```

### `README.md`（zh-TW）
章節：
1. **功能**：4 個工具簡介
2. **前提條件**：Node 18+、pnpm、同網路可連到內網 API
3. **安裝**：`git clone → pnpm install → pnpm build`
4. **Claude Code 設定**：`~/.claude.json` 的 `mcpServers` 片段範例（指向 `dist/index.js`）
5. **環境變數**：`.env.example` 說明、如何覆寫預設 URL
6. **工具清單與參數**：每個工具的輸入/輸出範例
7. **疑難排解**：常見錯誤（後端連不上、路徑權限）

## 實作後要做的動作

1. `cd phidias-mcp/ && git init`
2. `pnpm install`
3. `pnpm build`（驗證能過）
4. 初次 commit：`feat: initial headless MCP server extracted from phidias-standalone`
5. 是否 push 到 GitHub → 之後跟使用者確認

## 非目標（不做）

- 不處理 live viewport 互動（`load_model` 等）
- 不做 HTTP transport（仍是 stdio，單機使用）
- 不發 npm package
- 不做 Docker 封裝
- 不做 CI/CD
- 不改動原本 `phidias-standalone/mcp-server/`（它仍是 full 版本，保留不動）

## 風險與備註

- **內網 IP 出現在公開 repo**：這個 repo 是「給同網路同事用」，不打算公開。如果之後要對外，需改方案 B/C（env 必填）。
- **版本漂移**：新 repo 跟原 `mcp-server/` 各自演進。若原 repo 的 `phidias-client.ts` 有更新，需手動同步到 headless repo。後續可考慮把 `phidias-client.ts` 改成 sub-module 或 npm package 共用。
