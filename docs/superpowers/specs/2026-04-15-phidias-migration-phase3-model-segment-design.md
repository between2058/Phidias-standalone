# Phidias 跨 Repo 移植：Phase 3 — Model / Segment Panel UI Refresh

- **Date**: 2026-04-15
- **Status**: Draft
- **Author**: Claude (brainstorming session)
- **Phase**: 3 of 4
- **Sub-scope**: A（Panel-only；page.tsx 不動）
- **Depends on**: Phase 2 完成於 `computex-demo` branch tip `9f32722`

---

## 1. Context

Phase 1（Texture）與 Phase 2（Physics）已用 verbatim port pattern 把舊 repo 完整的 tab 帶進新 repo。Phase 3 處理的 Model / Segment tab 在兩 repo 都已存在但內容 diff 大：新 repo 為它們加了 polling-based job tracking（useJobManager 接線、job_id 在 page state 中流轉），舊 repo 則保留同步呼叫 + 較成熟的 panel UI。

按 user 在最初 brainstorming Q3 的決定：**「涉及到 polling 的 model tab 跟 segment tab 程式碼以新 repo 為主，UIUX 體驗能搬則搬」**，本 phase 嚴格遵循此原則。

Phase 3 brainstorming 進一步確定了 Sub-scope A：**只動 panel 元件，不動 page.tsx**。理由是 page.tsx 是 polling 邏輯的核心位置（segment/page.tsx 1543→1704 多 161 行、model/page.tsx 478→538 多 60 行皆為新 repo 的 polling 加項），任何手動 merge 都有破壞 polling 的高風險；而 panel 元件層級的 UI 改動相對獨立、爆炸半徑小。

## 2. Goal

新 repo `computex-demo` 上，把 4 個 panel 元件的 UI 改進從舊 repo 拿過來，達成驗收標準 A：

- `pnpm build` 通過
- 6 routes (`/`, `/workspace/{model,image,segment,texture,physics}`) 全部 HTTP 200
- 不破壞 model/segment 的 polling 行為（page.tsx 完全未動 = 結構性保護）

## 3. Non-Goals

- **不**動 `src/app/workspace/model/page.tsx`（polling 邏輯保留新版）
- **不**動 `src/app/workspace/segment/page.tsx`（polling 邏輯保留新版）
- **不**升級共用元件（`AssetsPanel`, `HierarchyPanel`, `LeftIconSidebar`, `TopNavBar`, `ExportDropdown`, `ThreeViewport`, `workspace-context`, `ProgressBar`, `RenderModeSelector`, `layout.tsx`, `globals.css`）→ 留給 Phase 4
- **不**動 skip-worktree 5 檔（`next.config.mjs` / `package.json` / `pnpm-lock.yaml` / `tsconfig.json` / `vite.wc.config.mts`）
- **不**新增 npm dependency
- **不**改動 wc-entry / 路由 / env vars
- **不**驗證真實後端 API 行為

## 4. Source of Truth & Branch 策略

```
舊 repo:        /Users/between2058/Documents/code/phidias-standalone
Source branch:  github/feat/viewer-export-ux-improvements
Cutoff:         85f68d6
基底 branch:    computex-demo @ 9f32722 (Phase 2 完成 tip)
工作 branch:    feat/phase3-model-segment-uiux (待建)
合併目標:       computex-demo (main 不動)
```

跟 Phase 1/2 一致，只搬已 push 到 github 的 commit。

## 5. File Inventory（4 項 panel）

每個 panel 為獨立 commit。無 transitive coupling。

| # | 檔案 | 動作 | 舊 LOC | 新 LOC | Diff 行 | 風險 |
|---|---|---|---|---|---|---|
| 1 | `src/components/model/ModelAssetPanel.tsx` | hybrid（覆蓋 / surgical） | 201 | 200 | 3 | 極低 — 幾乎必過 verbatim |
| 2 | `src/components/segment/SegmentAIPanel.tsx` | hybrid | 446 | 451 | 37 | 低 — 大概率過 verbatim |
| 3 | `src/components/segment/SegmentHierarchyPanel.tsx` | hybrid | 406 | 361 | 63 | 中 — 50/50 verbatim/surgical |
| 4 | `src/components/model/ModelGeneratePanel.tsx` | hybrid | 763 | 714 | 123 | 高 — 預期需 surgical |

**明確不動**（即使 diff 過大也不動）：

- 兩個 page.tsx：`src/app/workspace/model/page.tsx`、`src/app/workspace/segment/page.tsx`
- 共用元件全部（見 §3 Non-Goals）
- skip-worktree 5 檔
- `.env.example`、`wc-entry.tsx`、其他 phase 的工作

## 6. Execution Order

每個 panel 一個 Layer，hybrid 模式（兩條路徑）：

### Per-Layer Hybrid Procedure

```
1. cp <old_panel>.tsx <new_panel>.tsx  (verbatim try)
2. pnpm exec tsc --noEmit
3a. Outcome A (tsc 過):
    git add <panel>.tsx
    git commit -m "feat(model|segment): L<N> — port <Panel> from old (verbatim)"
3b. Outcome B (tsc fail):
    git checkout HEAD -- <panel>.tsx          # 還原成新版
    diff <old> <new> > /tmp/<panel>.diff      # 看 hunks
    手動挑出純 UI hunks 套用，跳過 props/state/event handler signature 改動
    pnpm exec tsc --noEmit                     # 必須過
    git add <panel>.tsx
    git commit -m "feat(model|segment): L<N> — port <Panel> UI hunks from old (surgical, skipped polling-related hunks)
                   <list of skipped line ranges>"
```

### Layers 順序（diff 行小到大）

- **L1**: `ModelAssetPanel.tsx`（3 行；hybrid → 預期 verbatim）
- **L2**: `SegmentAIPanel.tsx`（37 行；hybrid → 預期 verbatim）
- **L3**: `SegmentHierarchyPanel.tsx`（63 行；hybrid → 50/50）
- **L4**: `ModelGeneratePanel.tsx`（123 行；hybrid → 預期 surgical）
- **Final smoke**: clean build + 6 route HTTP 200 + skip-worktree 確認 + commit log 檢查

順序理由：先輕後重，前兩層確立 hybrid 流程的 happy path，後兩層風險高時已熟。

## 7. Verification（標準 A）

1. `pnpm install` 不觸發新 dependency
2. `pnpm build` 通過
3. `pnpm dev` 啟動後 6 routes 全部 HTTP 200：
   - `/`
   - `/workspace/model`（**特別關注**：被 ModelAssetPanel + ModelGeneratePanel 影響）
   - `/workspace/image`
   - `/workspace/segment`（**特別關注**：被 SegmentAIPanel + SegmentHierarchyPanel 影響）
   - `/workspace/texture`
   - `/workspace/physics`
4. Console 無 runtime error
5. skip-worktree 5 檔完全未動
6. **page.tsx 級別的 polling 邏輯**：不需要實測 polling（後端可能不在），但 console 不該出現「`useJobManager` undefined」「`jobs` 不存在於 store」這類涉及 polling 路徑的型別錯誤

## 8. Risk Register

| # | 風險 | 應對 |
|---|---|---|
| **R1** | Verbatim 後 panel prop 介面跟新 page.tsx 不相容 → tsc fail | Hybrid 路徑 B：切 surgical |
| **R2** | Panel 透過 `useWorkspace()` 或其他 shared hook drift | 在 panel 內 local adapter；不行 PAUSE |
| **R3** | Panel 使用 `useSegmentStore` / `usePhidiasStore` 但 action signature 漂移 | 同 R2 |
| **R4** | 舊 panel import `uuid` 但新 repo 沒裝 | 改用 `crypto.randomUUID()`（Phase 2 已建立 pattern） |
| **R5** | 舊 panel 用到的 type / function 在新 repo 不存在 | 在 panel 內補；若需動 types.ts/phidias.ts → 評估後再動 |
| **R6** | Surgical 模式時誤判 polling-related hunk 為 UI hunk → polling 壞 | 驗收 A 抓不到（不測功能）；但 commit message 必須列 skip 範圍，user review 時可審 |
| **R7** | 4 個 panel 之間互相 import（unlikely） | tsc 會抓到不一致，視個案處理 |
| **R8** | skip-worktree 必須動 | 設計上不應發生；若發生 PAUSE |
| **R9** | Surgical 模式下，個別 panel 不可避免動到 polling-related code（例如 ModelGeneratePanel 的 onGenerate callback signature 在新 repo 已改 polling 風格）→ 完全無法取捨 | 該 panel 整層 SKIP（commit `chore(model|segment): L<N> — keep new version, no portable UI changes from old`），不強求 |

R9 是 Phase 3 獨有的「優雅退場」條款 — 不是每個 panel 一定都有「值得搬」的 UI 改動。如果 verbatim 失敗、surgical 也找不到乾淨 hunks，記錄原因、跳過、繼續下一層。

## 9. Out-of-Scope（明確不做）

- model/segment 的 page.tsx merge（涉及 polling，極高風險）
- Phase 4 預定的共用 UI polish（TopNavBar / LeftIconSidebar / globals.css 等）
- 任何 polling 邏輯改寫
- 真實後端整合測試
- 新功能加入

## 10. Follow-up

- 完成後評估：是否需要 Phase 3.5（model/segment page.tsx 級別的選擇性 UI port），條件取決於 user 親眼比較 Phase 3 結果與舊 repo 的 model/segment 視覺後是否仍有缺憾
- Phase 4 範圍收斂（具體哪些共用元件值得升級）
- 若任何 panel 走 surgical 路徑且 skip 了多個 hunks，記錄哪些 UI 改動被放棄，作為未來決策依據
