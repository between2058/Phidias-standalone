# Phidias 跨 Repo 移植：Phase 3.5 — Targeted UI/UX Issue Fixes

- **Date**: 2026-04-15
- **Status**: Draft
- **Author**: Claude (brainstorming session)
- **Phase**: 3.5（疊在 Phase 3 branch 上的 targeted cleanup）
- **Depends on**: Phase 3 完成於 `feat/phase3-model-segment-uiux` tip `d237cf8`

---

## 1. Context

Phase 3 完成後 user 親測發現 4 個 UI/UX 問題：

1. Segment tab 的 TransformPanel UI 邊框顯示為白色（應該是深紫 `#333355`）
2. Smart Organize 按鈕目前要 segmentation 完成才出現，應該在偵測到多 part 時就出現
3. 雙擊 part 名字無法重新命名（新 repo 的 rename handler 被刻意停用）
4. Rename / grouping / merging 過的 asset 匯出之後未拿到修改後版本

診斷發現這些 issue 全都住在 Phase 3 明確排除的範圍內：
- Issue 1 住在共用元件 `TransformPanel.tsx`（Q5=A 保護）
- Issue 2, 3, 4 住在 `segment/page.tsx`（Phase 3 spec §3 Non-Goals）
- Issue 3 還額外發現 Phase 3 L3 port 的 `SegmentHierarchyPanel.tsx` 在新 repo 是 dead code（沒人 import），真實 hierarchy 渲染走 `ScenePanel → 共用 HierarchyPanel` 鏈路

Phase 3.5 針對這 4 個具體 issue 做 targeted fix，**在特定 hunk 鬆動**原 Phase 3 的兩條硬約束，其他部分保持。

## 2. Goal

4 個 issue 全部修正、Phase 3 未破壞之其他行為全部保留、驗收標準 A（compile + render + 關鍵互動 smoke）。

## 3. Scope Rescoping

Phase 3 兩條硬約束在 3.5 針對**具體 hunk** 鬆動：

### 鬆動 1：「不動 page.tsx」→ `segment/page.tsx` 的 4 個 hunk

- Issue 2: ~line 1545 附近 `<SegmentAIPanel>` prop；加回 `hasMultipleParts` useMemo
- Issue 3: ~line 1058 `_handleRenamePart` 重啟 + setter 呼叫
- Issue 4: ~line 826, 837, 991, 1023 `threeGroup.name = part.id` → `part.name`
- **仍保留**：polling 路徑（useJobManager / job state / useConnectionAvailability）、state machine、effect hooks 順序 — 完全不動

### 鬆動 2：Q5=A「不動共用元件」→ 3 個精確修改

- `TransformPanel.tsx`：3 處 class 字串還原（純 revert 到舊 repo 字面值）
- `workspace-context.tsx`：新增 1 個 optional state 欄位 + setter，不改既有 API
- `ScenePanel.tsx`：讀 context 新欄位並 forward 給 HierarchyPanel 既有 `onRename` prop

**仍保留**：`ThreeViewport.tsx`、`HierarchyPanel.tsx` 內部邏輯（HierarchyPanel 的 onRename 分支已就緒）、`ExportDropdown.tsx`、`AssetsPanel.tsx`、`globals.css`、`tailwind.config.ts`、`layout.tsx`。

## 4. Non-Goals

- **不**重做 polling 邏輯
- **不** merge 整個 segment/page.tsx 的 939-line diff（仍只做上述 4 個定點 hunk）
- **不**動 skip-worktree 5 檔（`next.config.mjs`、`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`vite.wc.config.mts`）
- **不**新增 npm dependency
- **不**驗證真實後端 API 行為
- **不**升級未列入鬆動清單的共用元件
- **不**處理 Phase 4 預定的 UI polish（TopNavBar / LeftIconSidebar / AssetsPanel / globals.css 等）

## 5. Source of Truth & Branch

```
舊 repo:         /Users/between2058/Documents/code/phidias-standalone
Source branch:   github/feat/viewer-export-ux-improvements @ 85f68d6
基底:            feat/phase3-model-segment-uiux tip (d237cf8)
工作 branch:     繼續疊在 feat/phase3-model-segment-uiux（不拉子 branch，保持歷史線性）
合併目標:        computex-demo（Phase 3 + 3.5 一併 fast-forward）
```

## 6. File Inventory（4 Issue × 1 Layer，共改 5 檔 + 1 刪除）

### L1 — Issue 1: TransformPanel 邊框 revert

| 檔案 | 動作 |
|---|---|
| `src/components/shared/TransformPanel.tsx` | 3 處 class 字串還原：`border-phidias-border` → `border-[#333355]`；`border-accent-purple` → `border-[#7c3aed]`（focus 樣式）；`border-b border-phidias-border` → `border-b border-[#333355]`（2 處 header border） |

### L2 — Issue 2: Smart Organize gate 改回 `hasMultipleParts`

| 檔案 | 動作 |
|---|---|
| `src/app/workspace/segment/page.tsx` | (a) 加回 `hasMultipleParts` useMemo（比照舊 repo 的計算邏輯，注意 filter 掉 groups 這類虛擬節點）；(b) `<SegmentAIPanel>` 原本 `isAssetSegmented={...}` 改為 `hasMultipleParts={hasMultipleParts}` |
| `src/components/segment/SegmentAIPanel.tsx` | 無需改（Phase 3 L2 Props superset 已保留 `hasMultipleParts?`；`isAssetSegmented?` 變回 unused 無害） |

### L3 — Issue 4: Rename/group/merge 後 export 名稱正確

| 檔案 | 動作 |
|---|---|
| `src/app/workspace/segment/page.tsx` | 4 處 `threeGroup.name` 改動：line ~826, ~837 把 `threeGroup.name = part.id` → `part.name`；line ~991 把 `threeGroup.name = mergedId` → 對應 merged part.name；line ~1023 把 `threeGroup.name = groupId` → 對應 group part.name。**保留** line ~1315 已用 part.name；**保留**「不動個別 mesh.name」原則（舊 repo 明確 fix 過以免 material tracking 失效） |

### L4 — Issue 3: Rename 雙擊恢復（Option B：走 ScenePanel → HierarchyPanel）

| 檔案 | 動作 |
|---|---|
| `src/lib/workspace-context.tsx` | 新增 optional 欄位 `segmentRenameHandler?: ((id: string, name: string) => void) \| null` + setter `setSegmentRenameHandler`；default value `null` |
| `src/app/workspace/segment/page.tsx` | (a) `_handleRenamePart` → `handleRenamePart`（移除 `_` 前綴與 `eslint-disable-next-line @typescript-eslint/no-unused-vars` 註解）；(b) 取 `setSegmentRenameHandler` from workspace-context 並在合適時機（useEffect 掛載時）呼叫 `setSegmentRenameHandler(handleRenamePart)`；unmount 清掉 |
| `src/components/shared/ScenePanel.tsx` | 從 `useWorkspace()` 讀 `segmentRenameHandler`，作為 `onRename` prop 傳給 `<HierarchyPanel>`；null fallback |
| `src/components/segment/SegmentHierarchyPanel.tsx` | **刪除**（Phase 3 L3 port 之 dead code；確認 `grep -r "SegmentHierarchyPanel"` 僅自身一筆命中才刪） |

### 明確不動

**共用 / Q5=A 保留**：
- `src/components/shared/ThreeViewport.tsx`
- `src/components/shared/HierarchyPanel.tsx`（onRename 邏輯已就緒）
- `src/components/shared/ExportDropdown.tsx`
- `src/components/shared/AssetsPanel.tsx`
- `src/components/shared/LeftIconSidebar.tsx`
- `src/components/shared/TopNavBar.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/app/globals.css`、`tailwind.config.ts`、`src/app/workspace/layout.tsx`

**skip-worktree 保護**：
- `next.config.mjs`、`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`vite.wc.config.mts`

## 7. Execution Order（4 Layers + Final smoke）

每層 = 1 個 commit。順序：影響面小的定點修正先做、跨檔案架構改動最後。

| Layer | 內容 | Green 判定 | 爆炸半徑 |
|---|---|---|---|
| **L1** | TransformPanel border 還原 | `pnpm build`（含 next-lint）綠 | 低 — 單檔、字面值 revert |
| **L2** | Smart Organize gate 改 + `hasMultipleParts` useMemo | `pnpm build` 綠 + 手動 smoke `/workspace/segment` 看按鈕行為 | 低 — 2 處 segment/page.tsx |
| **L3** | 4 處 `threeGroup.name` id → name | `pnpm build` 綠 + code review 4 改動對到正確 part 的 name 欄位 | 中 — 動 scene graph 命名；需確認不影響 material tracking |
| **L4** | Rename 鏈路（context 欄位 + page handler 恢復 + ScenePanel forward + SegmentHierarchyPanel 刪） | `pnpm build` 綠 + 手動 smoke `/workspace/segment` 雙擊 part rename 能編輯並確認 | 高 — 跨 3 檔 + 1 刪除 |
| **Final** | clean `pnpm build` + 6 route HTTP 200 + skip-worktree intact + 4 個 issue 互動 smoke | 手動勾 6 項驗收 | — |

## 8. Verification（標準 A + 4 個具體互動 smoke）

1. `pnpm install` 無新增 deps
2. `pnpm build` 通過（重點：next-lint 綠）
3. 6 routes HTTP 200：`/`, `/workspace/{model,image,segment,texture,physics}`
4. **Issue 1**: `/workspace/segment` 的 TransformPanel 邊框看起來是深紫色（`#333355`），不是白色
5. **Issue 2**: `/workspace/segment` 載入多 part 的 asset，Smart Organize 按鈕**立刻**出現
6. **Issue 3**: `/workspace/segment` 雙擊 hierarchy 裡的 part → 變輸入框 → 輸入新名 + Enter → 名稱更新
7. **Issue 4**: code-level — `git diff` 確認 4 個 `threeGroup.name` 改動對到 part.name；真實 export 結果驗收交給 user 後續操作
8. 其他 route（model / image / texture / physics / 首頁）無 regression
9. skip-worktree 5 檔完全未動

## 9. Risk Register

| # | 風險 | 時機 | 應對 |
|---|---|---|---|
| **R1** | L1 revert 影響其他 TransformPanel consumer 視覺 | L1 smoke | TransformPanel 主要被 segment + physics 頁用到；變回舊風格即回歸舊 repo 視覺，屬預期 |
| **R2** | L2 `hasMultipleParts` 計算過度 naive（例如 parts 含虛擬 group 節點） | L2 runtime | 參考舊 repo 邏輯（可能是 `parts.filter(p => !p.isGroup).length > 1`），實作前讀舊 repo 對應處 |
| **R3** | L3 `threeGroup.name` 改動影響 material tracking | L3 runtime | 只動 wrapper Group name，**絕對不動** wrapper 內個別 mesh.name；舊 repo 的 `e92d700` / `758146d` fix 即保護此原則。smoke 時切換 segmented / original texture 看材質是否正常 |
| **R4** | L3 某處的 `mergedId` / `groupId` 當下對應的 part 尚未有 name | L3 tsc/runtime | 每處改動前 read 上下文 2~3 行；若 name 欄未就緒用 fallback（保留 id 或用 `"merged_" + Date.now()`）；或維持該處 id |
| **R5** | L4 workspace-context 新欄位破壞 `useWorkspace()` consumer type | L4 tsc | 新欄位宣告為 optional（`?:`）並於 default value 提供 `null`；既有 consumer 零改動 |
| **R6** | L4 ScenePanel 在 non-segment route 把 HierarchyPanel 的 onRename 啟動 → 其他 tab 誤以為能 rename | L4 runtime | `segmentRenameHandler` 僅在 segment page mount 時 set；unmount 清掉。ScenePanel 傳 `onRename={segmentRenameHandler ?? undefined}`，null 時 HierarchyPanel 的 onDoubleClick 已是 `onRename ? ... : undefined` 設計 |
| **R7** | 刪 `SegmentHierarchyPanel.tsx` 時有隱藏引用 | L4 build | `git grep SegmentHierarchyPanel` 必須僅自身檔案命中才刪；若有其他引用 PAUSE |
| **R8** | L2/L3/L4 segment/page.tsx 改動誤碰 polling | 各層 build/runtime | 每層 surgical 改該 hunk；commit 前 `git diff` review 行範圍；polling 相關 symbol（useJobManager / job / queue / useConnectionAvailability）不在改動範圍內 |
| **R9** | skip-worktree 5 檔被動 | 任何層 | 設計上不會；若發生 PAUSE |
| **R10** | L4 的 useEffect 生命週期順序跟 Phase 3 L2 extended Props 衝突（cross-hook 競爭） | L4 runtime | segment page handleRenamePart 本身是 useCallback 穩定 ref；setSegmentRenameHandler 只在 handler ref 變化時更新 |

## 10. Out-of-Scope（明確不做）

- Phase 4 的 UI polish（TopNavBar / LeftIconSidebar / AssetsPanel / globals.css 等共用元件升級）
- 任何 polling 邏輯改動
- segment/page.tsx 其他 935 line 的 diff（只做列出的 4 個 hunk）
- 真實後端 API 測試
- Phase 1/2 既有功能的行為修改
- 其他 tab（model / texture / physics / image）的 UI/UX 改動

## 11. Follow-up

- 完成後：user 親自驗收 4 個 issue 是否真的解決；若 export rename 驗收（Issue 4）仍有缺，可能代表 L3 漏了某個場景，回頭補 surgical 加行
- Phase 4 範圍收斂（已明確有 AssetsPanel / TopNavBar / LeftIconSidebar 等未動共用元件）
- 若 L1 TransformPanel 的 Tailwind token 問題（`phidias-border` / `accent-purple` 對應 CSS var 的 runtime resolution 細節）有人想查根因，可獨立 debug — 但不是本 phase 責任
- Phase 3 L3 的 SegmentHierarchyPanel 刪除後，相關 Phase 3 commit（`ea94dcb`）變成 no-op。保留該 commit 不 revert（歷史清楚）；僅在 Phase 3.5 L4 的 commit message 說明此 file 為何被刪
