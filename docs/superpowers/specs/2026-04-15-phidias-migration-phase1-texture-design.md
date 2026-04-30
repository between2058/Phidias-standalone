# Phidias 跨 Repo 移植：Phase 1 Pilot — Texture Tab

- **Date**: 2026-04-15
- **Status**: Draft
- **Author**: Claude (brainstorming session)
- **Phase**: 1 of 4（Pilot）

---

## 1. Context

Phidias 目前存在兩個內容分岔的 `phidias-standalone` repo：

- **舊 repo**（個人 GitHub fork，`github.com/between2058/Phidias-standalone`）
  branch `feat/viewer-export-ux-improvements`：有較完整的 UX 功能（Physics、Texture、CAD tabs，多個 viewer / export 改進）。
- **新 repo**（公司 GitLab 上 canonical `main`）：改造過 Web Component 架構、整合 `@pegaverse/phidias-sdk`、實作了統一的 polling hooks（`useJobManager`、`useJobDownload`，配合 `phidias-store.jobs`）。

目標是把舊 repo 的功能**搬進**新 repo，並保留新 repo 的 polling 機制作為未來的 async 契約。整體工程量約 40+ 檔案差異、59 個 commit，不可能塞進單一 spec。因此先拆成 4 個 Phase 獨立施工。

本文件是 **Phase 1 (Pilot)** 的 spec。後續 Phase 會在完成 Phase 1 後各自寫 spec。

## 2. Multi-Phase Roadmap

```
Phase 1 (本文件, pilot): Texture tab     原樣搬（不綁新 polling）
Phase 2:                 Physics tab    原樣搬（含 physics-store、articulation proxy）
Phase 3:                 Model / Segment 新 repo polling 為主，視需要疊舊 UI 細節
Phase 4:                 Shared UI polish（TopNavBar / LeftIconSidebar / globals.css 等）
```

CAD tab 本次不搬。

## 3. Phase 1 Goal

Texture tab 在新 repo 能**編譯 + 渲染**（驗收標準 A）：

- `pnpm build` 通過
- `/workspace/texture` route 能打開、UI 元件顯示正常、console 無 runtime error
- 不破壞其他 tab（`/workspace/model`、`/workspace/image`、`/workspace/segment`）

## 4. Non-Goals

- **不**把 `textureTrellis` 改接新 polling（維持原 callback-based 輪詢）
- **不**驗證 trellis2 後端是否仍存活（真實 API 可通與否不列入驗收）
- **不**升級共用元件 `ExportDropdown` / `ThreeViewport` / `workspace-context` / `globals.css`（留給 Phase 4）
- **不**新增任何 npm dependency（若發現必須加，暫停回頭決策）

## 5. Source of Truth

```
舊 repo 路徑:    /Users/between2058/Documents/code/phidias-standalone
Branch:          github/feat/viewer-export-ux-improvements
Cutoff commit:   85f68d6  "debug: add proxy log for articulation route path mapping"
```

**只搬已 push 到 github 的 commit**。舊 repo local 比 github remote 多 2 個 commit（`7c4e9c9`、`59ef68d`），皆為 polling migration docs，無程式碼內容，因此跳過不影響本次功能移植。

## 6. File Inventory

共 8 項變動。只動與 Texture tab 直接相關的檔案 + 路由啟用必要的 `wc-entry.tsx`。

| # | 檔案 | 動作 | 說明 |
|---|---|---|---|
| 1 | `src/lib/api/types.ts` | surgical merge | 加入 `ProgressUpdate`、`TextureRequest` 及其相依型別 |
| 2 | `src/lib/api/phidias.ts` | surgical merge | 新增 `textureTrellis`、`downloadPhidiasImage`、`editImage` 三函式，置於獨立 `// ── Texture tab (legacy async) ──` 區塊以免與 polling 函式混淆 |
| 3 | `src/app/api/phidias/trellis2/[...path]/route.ts` | 新增 | 整個 folder 從舊 repo 搬 |
| 4 | `.env.example` | 追加一行 | `TRELLIS2_API_URL=` |
| 5 | `src/components/texture/TextureGeneratePanel.tsx` | 覆蓋 | 舊版整檔覆蓋 |
| 6 | `src/app/workspace/_texture/` → `src/app/workspace/texture/` | rename + 覆蓋 | 拿掉底線啟用 Next.js route；`page.tsx` 內容用舊版覆蓋 |
| 7 | `src/wc-entry.tsx` | 兩處小改 | (a) `React.lazy(() => import('./app/workspace/_texture/page'))` → `./app/workspace/texture/page`；(b) `<Routes>` 新增 `<Route path="workspace/texture" element={<TexturePage />} />` |

**明確不動**（Q5 = A：共用元件留待 Phase 4）：

- `src/components/shared/ExportDropdown.tsx`
- `src/components/shared/ThreeViewport.tsx`
- `src/lib/workspace-context.tsx`
- `src/components/ui/ProgressBar.tsx`（兩邊皆匯出 `{ProgressBar, Toggle, PillGroup, CollapsibleSection}`，compile 層面相容）
- `src/app/workspace/layout.tsx`
- `src/app/globals.css`
- `package.json`、`pnpm-lock.yaml`、`next.config.mjs`、`tsconfig.json`、`vite.wc.config.mts`（皆被本機 skip-worktree 標記，用於 SDK stub 解決方案；不得觸碰）

## 7. Execution Order（6 Layers）

每層 = 一個 commit。每層交付前必須 `pnpm build` / `pnpm tsc --noEmit` 綠燈；失敗就留在該層修正，不進下一層。任何一層有問題可以用 `git revert <sha>` 單獨退回。

### L1 — Types

- 把舊 `src/lib/api/types.ts` 裡跟 Texture 相關的 `ProgressUpdate`、`TextureRequest`、以及 `TextureRequest` 所依賴的任何 interface/type 加到新 repo 同檔
- 保留新 repo 原有型別（尤其 `JobSubmitResponse`、`JobStatusResponse` 不可動）
- 驗證：`pnpm tsc --noEmit`

### L2 — API client functions

- 把舊 `src/lib/api/phidias.ts` 裡的 `textureTrellis`、`downloadPhidiasImage`、`editImage` 加到新 repo 同檔
- 以 `// ── Texture tab (legacy async) ──` 區塊包起來，保留新 repo 的 polling 函式原樣
- 驗證：`pnpm tsc --noEmit`

### L3 — Proxy route + env

- 把舊 repo 的 `src/app/api/phidias/trellis2/` 整個 folder（含 `[...path]/route.ts`）複製過來
- 在 `.env.example` 加上 `TRELLIS2_API_URL=`
- 驗證：`pnpm build`（route 活但尚未被前端呼叫）

### L4 — Panel component

- 覆蓋 `src/components/texture/TextureGeneratePanel.tsx` 為舊版整檔
- 驗證：`pnpm tsc --noEmit`。特別注意 `ProgressBar` / `Toggle` / `CollapsibleSection` 的 prop signature 兼容性（兩邊都匯出這些 symbol，但 props 可能漂移）

### L5 — Page + routing

- 刪除 `src/app/workspace/_texture/` 目錄
- 建立 `src/app/workspace/texture/page.tsx`，內容用舊版覆蓋
- 驗證：`pnpm build` + `pnpm dev` 啟動後瀏覽 `http://localhost:<port>/workspace/texture` 能看到畫面、console 無 runtime error

### L6 — WC entry wiring

- `src/wc-entry.tsx`：
  - 把 `React.lazy(() => import('./app/workspace/_texture/page'))` 改為 `'./app/workspace/texture/page'`
  - 在 `<Routes>` 的 `<Route element={<WorkspaceLayoutRoute />}>` 群組裡加一條 `<Route path="workspace/texture" element={<TexturePage />} />`
- 驗證：`pnpm tsc --noEmit`（`pnpm build:wc` 目前因本機 SDK stub 的已知限制無法執行，不列入本 phase 驗收）

## 8. Verification（驗收標準 A）

1. `pnpm install` 不觸發新增 dependency
2. `pnpm build` 通過
3. `pnpm dev` 啟動後瀏覽 `/workspace/texture`：
   - TextureGeneratePanel 的控制項都長出來
   - ThreeViewport loading spinner 或 fallback 畫面顯示
   - Console 無 runtime error（API 4xx/5xx 不算 crash；網路 fail 不列入驗收）
4. `/workspace/model`、`/workspace/image`、`/workspace/segment`、`/`（首頁）仍正常
5. 其他 standalone 既有 route 無 regression（smoke test：每個都打開一次）

## 9. Risk Register

| # | 風險 | 發生時機 | 應對 |
|---|---|---|---|
| R1 | 後端已下架 trellis2 endpoint | L5 之後的 runtime | 不影響驗收 A；標為 known issue 留待後續處理 |
| R2 | 新 repo 的 `ExportDropdown` / `ThreeViewport` / `workspace-context` 與舊 Texture 使用面不相容 → L4 或 L5 compile 失敗 | L4 or L5 | (a) 在 texture folder 裡做 local adapter 包住不相容；(b) 若 adapter 太醜 → 升級該共用元件（違反 Q5=A，需暫停回頭跟 user 確認） |
| R3 | `ProgressBar.tsx` 兩邊 prop signature 不同，TextureGeneratePanel runtime 壞掉 | L4 runtime | 讀 console 錯誤，局部調整 TextureGeneratePanel；若漂移過大同 R2 處理 |
| R4 | skip-worktree 的 5 檔必須修改（例如要加新 dependency） | 任何層 | 設計上不應發生；若發生暫停 implementation、回頭跟 user 討論（是否解除 skip-worktree、或換作法） |
| R5 | `.env.example` 的修改會進 git diff | L3 | 這是預期且可接受的；`.env.example` 本來就給協作者看，進 commit 是好事 |
| R6 | 新增型別/函式與 new repo 既有型別/函式命名衝突 | L1 / L2 | 若衝突，加 `Texture` prefix 解決（例如 `TextureProgressUpdate`）；避免改到 polling 路徑既有符號 |

## 10. Out-of-Scope（明確不做）

- Physics tab 移植（Phase 2）
- CAD tab 移植（用戶決定本次不搬）
- Model / Segment tab UI 細節更新（Phase 3）
- `TopNavBar`、`LeftIconSidebar`、`globals.css` 等視覺 polish（Phase 4）
- 把 `textureTrellis` 改接新 polling（長期目標，不在本 phase）
- End-to-end 測試 / 真後端 call 驗證
- 舊 repo 的 local-only commit（`7c4e9c9`、`59ef68d`）

## 11. Follow-up（不在本 spec，但完成 Phase 1 後要記得）

- 決定 Phase 2 (Physics) 是否複用本 spec 的分層 pattern
- 評估 R1：若 trellis2 後端確實下架，規劃未來把 Texture 遷進 polling 的小 spec
- Phase 4 Shared UI polish 的 scope 收斂
