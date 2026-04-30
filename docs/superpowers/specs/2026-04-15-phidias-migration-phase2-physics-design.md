# Phidias 跨 Repo 移植：Phase 2 — Physics Tab

- **Date**: 2026-04-15
- **Status**: Draft
- **Author**: Claude (brainstorming session)
- **Phase**: 2 of 4
- **Depends on**: Phase 1（Texture tab）完成於 `computex-demo` branch tip `6749cbc`

---

## 1. Context

Phase 1 Pilot 驗證「舊 repo feature verbatim 搬進新 repo，不綁新 polling」這個 pattern 可行。Phase 2 用同一 pattern 搬 Physics tab — 舊 repo 規模最大的子系統（8 components + store + articulation API proxy + 30+ 個 physics 相關 commit）。

跟 Phase 1 相同的硬約束：verbatim port、驗收標準 A、不動共用元件、不動 skip-worktree 檔、只搬已 push 到 github 的 commit（cutoff `85f68d6`）。

## 2. Goal

Physics tab 可在 `/workspace/physics` 路由渲染，`pnpm build` 通過，其他既有 route（包含 Phase 1 剛加的 texture）無 regression。

## 3. Non-Goals

- **不**把 articulation API calls 改接新 polling 機制
- **不**驗證 articulation 後端是否仍存活（網路 call 失敗不列入驗收）
- **不**升級共用元件（`ExportDropdown` / `ThreeViewport` / `workspace-context` / `ProgressBar` / `HierarchyPanel` / `layout.tsx` / `globals.css`）
- **不**動 skip-worktree 保護的 5 檔（`next.config.mjs` / `package.json` / `pnpm-lock.yaml` / `tsconfig.json` / `vite.wc.config.mts`）
- **不**搬 CAD 相關（`src/app/api/phidias/occt/*`、`.env.example` 的 `OCCT_API_URL`）
- **不**新增任何 npm dependency（若發現必須加，PAUSE 回頭決策）
- **不**親眼驗證 articulation / joint 動畫功能（需要 live 後端，獨立 follow-up）

## 4. Source of Truth & Branch 策略

```
舊 repo 路徑:          /Users/between2058/Documents/code/phidias-standalone
Source branch:         github/feat/viewer-export-ux-improvements
Cutoff commit:         85f68d6 (同 Phase 1)
基底 branch (新 repo):  computex-demo @ 6749cbc (Phase 1 完成 tip)
工作 branch (新建):     feat/phase2-physics-migration
合併目標:              computex-demo (main 不動)
```

跟 Phase 1 一樣，只搬已 push 到 github 的 commit；local-only 的 2 個 docs commit 跳過。

## 5. File Inventory（16 項變動）

4 個 Layer 分組。L1~L3 為純 additive，L4 為 atomic coupling 點。

### L1 — Foundation（3 項）

| # | 檔案 | 動作 | 估計 LOC |
|---|---|---|---|
| 1 | `src/store/physics-store.ts` | 新增 | 200 |
| 2 | `src/app/api/phidias/articulation/[...path]/route.ts` | 新增（含 folder 結構） | ~30 |
| 3 | `.env.example` | 追加一行 `ARTICULATION_API_URL=` | +1 |

### L2 — Shared Addition（1 項）

| # | 檔案 | 動作 | 說明 |
|---|---|---|---|
| 4 | `src/components/shared/RenderModeSelector.tsx` | 新增 | 58 行。舊 repo 新加的共用元件，新 repo 完全沒有。**純 additive 不是 upgrade**，因此不違反 Q5=A。 |

### L3 — New-only Physics Components（6 項）

這 6 個元件在新 repo 完全不存在，舊 repo 獨有。

| # | 檔案 | LOC |
|---|---|---|
| 5 | `src/components/physics/AnchorGizmo.tsx` | 77 |
| 6 | `src/components/physics/JointVisualizer.tsx` | 135 |
| 7 | `src/components/physics/MotionPreviewController.tsx` | 219 |
| 8 | `src/components/physics/PhysicsEditorPanel.tsx` | 197 |
| 9 | `src/components/physics/PhysicsExportButtons.tsx` | 289 |
| 10 | `src/components/physics/PhysicsMotionPreview.tsx` | 63 |

### L4 — Coupled Swap（6 項）

下列 6 件必須合併成單一 atomic commit：其中任何一步單獨做都會讓 tsc 失敗。

| # | 檔案 | 動作 | 說明 |
|---|---|---|---|
| 11 | `src/components/physics/PhysicsJointsPanel.tsx` | 覆蓋（413 舊版取代 327 新版） | diff'd；舊 page.tsx 預期舊 prop 界面 |
| 12 | `src/components/physics/PhysicsMaterialsPanel.tsx` | 覆蓋（168 舊版取代 135 新版） | 同上 |
| 13 | `src/components/physics/PhysicsPartsPanel.tsx` | 覆蓋（322 舊版取代 127 新版） | 同上 |
| 14 | `src/components/physics/PhysicsPropertiesPanel.tsx` | **刪除**（new-only 孤兒） | 264 行。只被新 `_physics/page.tsx` 引用，換頁後 orphan。 |
| 15 | `src/app/workspace/_physics/` → `src/app/workspace/physics/` | 刪舊 folder + 新增 `page.tsx` (384 行) | 跟 Phase 1 的 `_texture` → `texture` 同手法 |
| 16 | `src/wc-entry.tsx` | 兩處 patch | (a) lazy import `_physics` → `physics`；(b) `<Routes>` 加 `<Route path="workspace/physics" element={<PhysicsPage />} />` |

### 明確不動

**Q5=A 保護名單**（shared components）：
- `src/components/shared/ExportDropdown.tsx`
- `src/components/shared/ThreeViewport.tsx`
- `src/components/shared/HierarchyPanel.tsx`（old physics/page.tsx 用它的 `HierarchyItem` type）
- `src/lib/workspace-context.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/app/workspace/layout.tsx`
- `src/app/globals.css`

**skip-worktree 保護名單**：
- `next.config.mjs`、`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`vite.wc.config.mts`

**新 repo 既有 diff'd 檔**：即使 physics/page.tsx 或 physics components 會 import 到以下檔案且兩邊 diff，也 **不動**：
- `src/store/segment-store.ts`（physics/page.tsx 有 `useSegmentStore` 呼叫）
- `src/lib/api/phidias.ts`（若有 physics 專屬 helper 要用）
- `src/lib/utils.ts`、`src/lib/api/client.ts`

若真的不相容，先嘗試在 physics folder 內做 local adapter；若 adapter 太醜再 PAUSE 回報（按 R2 流程）。

**跳過**：
- `src/app/api/phidias/occt/` 整個（CAD）
- `.env.example` 的 `OCCT_API_URL=`（CAD）

## 6. Execution Order

4 個 Layer + Final smoke test。每層 = 一個 commit（允許相鄰層合併於執行期發現耦合時）。

### L1 — Foundation

- 複製 `src/store/physics-store.ts` 整檔
- 複製 `src/app/api/phidias/articulation/[...path]/route.ts` 整個 folder
- `.env.example` 追加 `ARTICULATION_API_URL=`
- 驗證：`pnpm build` 完成；route table 出現 `/api/phidias/articulation/[...path]`；尚無前端 consumer
- Commit: `feat(physics): L1 — add physics-store, articulation proxy, env var`

### L2 — Shared Addition

- 複製 `src/components/shared/RenderModeSelector.tsx` 整檔
- 驗證：`pnpm tsc --noEmit` 綠燈（尚無 consumer）
- Commit: `feat(physics): L2 — add RenderModeSelector shared component`

### L3 — New-only Physics Components

- 複製 6 個 new-only 元件到 `src/components/physics/`
- 驗證：`pnpm tsc --noEmit`
- **若失敗**（如 R4 所述，`PhysicsEditorPanel` 可能 import 到 `Joints/Materials/Parts` 的舊 prop 界面，但 L4 還沒做覆蓋）→ 合併 L3 + L4 成單一 atomic commit（參照 Phase 1 L4+L5+L6 合併手法）
- 若成功：Commit: `feat(physics): L3 — add 6 new physics components`

### L4 — Coupled Swap

- 覆蓋 3 個 diff'd panel (`PhysicsJointsPanel` / `PhysicsMaterialsPanel` / `PhysicsPartsPanel`)
- `git rm src/components/physics/PhysicsPropertiesPanel.tsx`
- `git rm -r src/app/workspace/_physics`
- 建立 `src/app/workspace/physics/page.tsx`
- 在 `src/wc-entry.tsx` 做兩處 patch（lazy import 路徑 + `<Route>` 加入）
- 驗證：
  - `pnpm build` 通過
  - `pnpm dev` 後瀏覽 6 routes（`/`, `/workspace/model`, `/workspace/image`, `/workspace/segment`, `/workspace/texture`, `/workspace/physics`）全部 HTTP 200 且 console 無 runtime error
- Commit: `feat(physics): L4 — swap _physics → physics + overwrite 3 diff'd panels + wire wc-entry`（若 L3 被合併進 L4，message 做對應擴充說明 3 層合併理由）

### Final Smoke Test

- `rm -rf .next && pnpm build`
- 6 route smoke test 再跑一遍（含 Phase 1 的 texture）
- `git ls-files -v | grep '^S '` 確認 skip-worktree 5 檔未動
- `git log --oneline computex-demo..HEAD` 列出本 phase 所有 commit 作為驗收紀錄

## 7. Verification（標準 A）

1. `pnpm install` 不觸發新 dependency
2. `pnpm build` 通過
3. `pnpm dev` 啟動後瀏覽 `/workspace/physics`：
   - PhysicsEditorPanel 與相關 panel 顯示
   - ThreeViewport 顯示 loading 或 fallback（articulation API 失敗不算 crash）
   - Console 無 runtime error
4. 其他 route 無 regression：`/`, `/workspace/model`, `/workspace/image`, `/workspace/segment`, `/workspace/texture`
5. skip-worktree 5 檔完全未動

## 8. Risk Register

| # | 風險 | 發生時機 | 應對 |
|---|---|---|---|
| R1 | articulation 後端下架 | L4 後 runtime | 不影響驗收 A；標 known issue |
| R2 | `workspace-context` / `ThreeViewport` / `ExportDropdown` / `HierarchyPanel` prop drift | L3 or L4 | 先試 local adapter（在 physics folder 內）；若太醜 PAUSE |
| R3 | `segment-store` action/state signature drift（physics/page.tsx 會呼叫） | L4 tsc | 同 R2 應對；**Phase 2 獨有風險** |
| R4 | `PhysicsEditorPanel` 的 L3 commit 因 import diff'd panel 舊 prop 而 tsc fail | L3 | 合併 L3+L4 成 atomic commit |
| R5 | 舊 physics 元件使用 `uuid` package 但新 repo 不含此 dep | L3 tsc | (a) 改用 `crypto.randomUUID()`；(b) drop-in 不穩 → PAUSE |
| R6 | skip-worktree 5 檔必須動 | 任何層 | 不應發生；若發生 PAUSE |
| R7 | `.env.example` 進 git diff | L1 | 符合預期 |
| R8 | physics 元件 import 到新 repo 不存在的工具 / 路徑漂移 | L3 tsc | 逐項補 import 或 local wrapper |
| R9 | 刪除 `PhysicsPropertiesPanel` 後發現其他 new-only 檔也是只被 `_physics/page.tsx` 用的 orphan | L4 build | Task 0 pre-flight 會預先 grep 全新 repo，列可疑清單；執行時照清單處理 |
| R10 | L1~L3 additive 順序導致命名/路徑衝突 | 任何 tsc | 先 rename；再合併層；最後 PAUSE |

## 9. Out-of-Scope（明確不做）

- Texture tab（Phase 1 已做）
- CAD tab（user 決定不搬）
- Model / Segment tab 的 UI 細節更新（Phase 3）
- `TopNavBar` / `LeftIconSidebar` / `globals.css` 視覺 polish（Phase 4）
- articulation API 改接新 polling（長期目標）
- End-to-end 功能驗證 / 真後端測試
- 舊 repo 未 push 到 github 的 local-only commit

## 10. Follow-up

- 完成 Phase 2 後：評估是否需要 Phase 2.5（Texture + Physics 共同的 shared component 升級 — 若 R2 / R3 觸發的次數多到累積成技術債）
- Phase 3（Model / Segment）範圍收斂
- articulation 後端實際狀況查核（R1）
