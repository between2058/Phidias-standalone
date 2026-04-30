# Phidias Standalone — E2E 測試計畫

**版本**：2.0　**日期**：2026-03-27

**範圍**：phidias-standalone 在 **Playwright E2E** 層級的使用者可見行為測試。
本文件只涵蓋「使用者開啟瀏覽器、操作 UI、觀察結果」的測試案例。

> **測試分層說明**
>
> | 層級 | 工具 | CICD stage | 文件 |
> |---|---|---|---|
> | 純邏輯單元測試 | Vitest | `vitest` | — (test files in `src/`) |
> | 元件測試（WC 生命週期、屬性、事件） | Playwright Component Test | 預計未來新增 | `phidias-portal-integration-test-case.md` |
> | E2E（使用者行為） | Playwright E2E | `playwright` | **本文件** |
> | Portal × WC 整合 E2E | Playwright E2E | `playwright` | `phidias-portal-integration-test-case.md` |

---

## 目錄

1. [摘要](#1-摘要)
2. [測試環境](#2-測試環境)
3. [A. phidias-standalone — 正常流程 (PHI-INT-N)](#3-a-phidias-standalone--正常流程-phi-int-n)
4. [B. phidias-standalone — 異常流程 (PHI-INT-E)](#4-b-phidias-standalone--異常流程-phi-int-e)

---

## 1. 摘要

| 編號範圍 | 類型 | 說明 | 數量 |
|---|---|---|---|
| PHI-INT-N-006～N-041 | ✅ POSITIVE | phidias-standalone 正常流程（工作區操作） | 25 |
| PHI-INT-E | ❌ NEGATIVE | phidias-standalone 使用者可見異常路徑 | 11 |
| PHI-PERF-001～010 | ✅ POSITIVE | 效能（使用者可觀察的回應時間） | 9 |
| **合計** | | | **45** |

> **POSITIVE**：驗證 Happy Path 產生正確輸出。
> **NEGATIVE**：驗證在非法輸入或錯誤條件下，使用者看到安全且明確的提示。
>
> 下列測試已**移出**本文件：
> - **API Client 單元測試**（N-046~N-050、E-022~E-024）→ Vitest（`src/lib/api/client.test.ts`）
> - **WC 元件行為測試**（N-051~N-056、E-025~E-028、REL-003、REL-004）→ `phidias-portal-integration-test-case.md`（WC-COMP 章節）
> - **Standalone Proxy 路由測試**（N-057~N-062、E-029~E-033）→ Vitest（`src/app/api/phidias/*.test.ts`）
> - **Portal 整合測試**（PGV-INT-N/E）→ `phidias-portal-integration-test-case.md`

---

## 2. 測試環境

### 環境變數需求

| 變數 | 說明 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 設定後端主機（Standalone 模式留空） |
| `RECONVIAGEN_API_URL` | 必填 |
| `QWEN_API_URL` | 必填 |
| `P3SAM_API_URL` | 必填 |
| `VLM_API_URL` / `VLM_API_KEY` | Smart Organize 必填 |

### 瀏覽器需求
- Chromium（Chrome 120+、Edge 120+）或 Firefox 121+。

---

## 3. A. phidias-standalone — 正常流程 (PHI-INT-N)

### 3.2 圖片生成工作區

---

**PHI-INT-N-006** ✅ POSITIVE｜圖片生成 — 文字生成圖片
- **目標**：使用者輸入提示詞並生成圖片
- **前置**：Qwen 後端可用
- **步驟**：1) 導航至 `/workspace/image` 2) 在 Prompt 文字輸入框輸入提示詞 3) 將 Samples 滑桿設為 1 4) 點擊生成按鈕 5) 等待回應
- **預期**：顯示一張生成後的圖片；生成中顯示進度指示器，完成後消失

---

**PHI-INT-N-007** ✅ POSITIVE｜圖片生成 — 多樣本生成
- **目標**：使用者一次生成多張圖片樣本
- **前置**：同 N-006
- **步驟**：將 Samples 滑桿設為 4，在 Prompt 文字輸入框輸入提示詞，點擊生成按鈕
- **預期**：返回並顯示 4 張圖片，各自可獨立下載

---

**PHI-INT-N-008** ✅ POSITIVE｜圖片生成 — 圖片編輯
- **目標**：上傳參考圖片並以提示詞進行編輯
- **前置**：Qwen 後端可用
- **步驟**：1) 將參考 PNG 拖曳或點擊上傳至圖片上傳區域 2) 在 Prompt 文字輸入框輸入編輯提示詞 3) 點擊生成按鈕
- **預期**：顯示以參考圖片為基礎並依提示詞編輯的結果圖片

---

**PHI-INT-N-009** ✅ POSITIVE｜圖片生成 — 多角度圖生成
- **目標**：上傳參考圖片後請求多角度視圖
- **前置**：Qwen angle endpoint 可用
- **步驟**：1) 將參考圖片上傳至圖片上傳區域 2) 開啟「Generate Multi-view」多角度切換開關 3) 點擊生成按鈕
- **預期**：顯示原圖加右、後、左三個角度，共 4 張圖片

---

**PHI-INT-N-010** ✅ POSITIVE｜圖片生成 — 傳送至模型工作區
- **目標**：將生成的圖片傳送至 Model workspace 進行 3D 重建
- **前置**：至少已生成一張圖片
- **步驟**：1) 點擊圖片上的「送至模型」按鈕 2) 導航至 `/workspace/model`
- **預期**：Model workspace 預填該圖片於上傳區域

---

**PHI-INT-N-011** ✅ POSITIVE｜圖片生成 — 傳送多角度圖至模型工作區
- **目標**：將多角度圖組傳送至 Model workspace
- **前置**：已執行多角度生成
- **步驟**：點擊多角度組的「送至模型」按鈕，導航至 Model workspace
- **預期**：Model workspace 自動切換至 Multi-view 模式並預填多張圖片

---

### 3.3 模型生成工作區（ReconViaGen）

---

**PHI-INT-N-012** ✅ POSITIVE｜模型生成 — 文字生成 3D
- **目標**：直接用文字生成 3D 物件
- **前置**：Qwen 後端、ReconViaGen single endpoint 可用
- **步驟**：在 Text 模式 (✏️) 中在 Prompt 文字輸入框輸入提示詞，點擊生成按鈕
- **預期**：3D Viewport 渲染生成的物件；Hierarchy Panel 顯示 mesh 節點

---

**PHI-INT-N-013** ✅ POSITIVE｜模型生成 — 單圖重建
- **目標**：上傳單張圖片並生成 3D 模型
- **前置**：ReconViaGen 後端可用；timeout=300000ms
- **步驟**：1) 導航至 `/workspace/model` 2) 在 Image 模式（📷）上傳一張 PNG 3) 點擊生成按鈕 4) 等待完成
- **預期**：3D Viewport 顯示生成的模型；階層面板（Hierarchy Panel）顯示 mesh 節點

---

**PHI-INT-N-014** ✅ POSITIVE｜模型生成 — 多圖重建
- **目標**：提供多張圖片（來自多角度）進行多圖 3D 重建
- **前置**：ReconViaGen multi endpoint 可用
- **步驟**：切換至 Multi-view 模式（🔲），上傳多視圖圖片（可從圖片工作區傳送），點擊生成按鈕
- **預期**：3D Viewport 顯示生成的模型並載入

---

**PHI-INT-N-015** ✅ POSITIVE｜模型生成 — 多圖演算法：Stochastic
- **目標**：選用 `stochastic` 多圖演算法
- **前置**：2 張以上圖片可用
- **步驟**：在 Multi-view 模式中選擇 `stochastic` 演算法，點擊生成按鈕
- **預期**：生成成功；模型顯示於 3D Viewport

---

**PHI-INT-N-016** ✅ POSITIVE｜模型生成 — 多圖演算法：Multidiffusion
- **目標**：選用 `multidiffusion` 多圖演算法
- **前置**：2 張以上圖片可用
- **步驟**：在 Multi-view 模式中選擇 `multidiffusion` 演算法，點擊生成按鈕
- **預期**：生成成功；模型顯示於 3D Viewport

---

**PHI-INT-N-017** ✅ POSITIVE｜模型生成 — 批次重建
- **目標**：上傳多張獨立圖片進行批次 3D 生成
- **前置**：ReconViaGen batch endpoint 可用；timeout=600000ms
- **步驟**：切換至 Batch 模式（📦），上傳 3 張圖片，點擊生成按鈕
- **預期**：3 個模型分別顯示於 Viewport；各項目結果可識別

---

**PHI-INT-N-018** ✅ POSITIVE｜模型生成 — 進階參數
- **目標**：修改 seed、simplify、texture_size 等參數後生成
- **前置**：Model workspace 已開啟
- **步驟**：展開進階參數，設定 Seed=100、simplify=0.85、Texture Size=2048、Guidance Strength=9.0、Sampling Steps=15，點擊生成按鈕
- **預期**：生成成功；模型在設定參數下渲染

---

**PHI-INT-N-019** ✅ POSITIVE｜模型生成 — GLB 下載並渲染至 Viewport
- **目標**：生成的 GLB 透過 proxy 下載並在 Three.js viewport 渲染
- **前置**：模型已成功生成
- **步驟**：1) 觀察 3D Viewport 2) 確認 GLB 已下載並渲染
- **預期**：3D Viewport 渲染模型；階層面板顯示 mesh 節點

---

**PHI-INT-N-020** ✅ POSITIVE｜模型生成 — GLB 匯出
- **目標**：將生成模型匯出為 GLB 檔案
- **前置**：模型已載入 viewport
- **步驟**：點擊 Export 匯出下拉選單 → 選擇 GLB 匯出
- **預期**：瀏覽器觸發 GLB 檔案下載

---

### 3.4 語義分割工作區（3D Semantic Segmentation）

---

**PHI-INT-N-028** ✅ POSITIVE｜3D 分割 — 上傳 GLB 並分割
- **目標**：上傳 GLB 檔案並執行 P3SAM 3D 分割
- **前置**：P3SAM 後端可用；`P3SAM_API_URL` 已設定
- **步驟**：1) 導航至 `/workspace/segment` 2) 將 GLB 檔案拖曳或點擊上傳至 GLB 檔案上傳區域 3) 點擊「Start Segmentation」按鈕 4) 等待最多 300 秒
- **預期**：分割期間顯示「Segmenting... X%」進度；分割完成後結果 GLB 顯示於 3D Viewport；零件面板列出各零件

---

**PHI-INT-N-029** ✅ POSITIVE｜3D 分割 — 自訂分割參數
- **目標**：使用者設定自訂 P3SAM 參數後分割
- **前置**：GLB 檔案已就緒
- **步驟**：設定 Point Density=1024、Area Threshold=0.6、開啟 Post-Process、開啟 Clean Mesh、Seed=7，上傳 GLB 後點擊「Start Segmentation」
- **預期**：分割成功完成；結果顯示於 Viewport

---

**PHI-INT-N-030** ✅ POSITIVE｜3D 分割 — 色彩編碼零件視覺化
- **目標**：各分割零件以 SEGMENT_PALETTE 中不同顏色標示
- **前置**：分割結果 `num_parts=5`
- **步驟**：分割完成後觀察 3D Viewport 及零件面板
- **預期**：零件面板顯示 5 個零件，各具唯一顏色圓點；3D Viewport 模型以不同顏色區分各零件

---

**PHI-INT-N-031** ✅ POSITIVE｜3D 分割 — 觸發 Smart Organize
- **目標**：分割完成後觸發 Smart Organize 自動命名並分組零件
- **前置**：分割已完成；VLM 已設定
- **步驟**：分割完成後，點擊 Smart Organize 按鈕，等待 VLM 回應
- **預期**：零件面板更新為 AI 命名與分組

---

**PHI-INT-N-032** ✅ POSITIVE｜3D 分割 — 零件可見性切換
- **目標**：使用者可在 3D viewport 中顯示 / 隱藏個別零件
- **前置**：分割模型已載入；至少 2 個零件可見
- **步驟**：1) 點擊零件面板中零件 1 的可見性切換（眼睛圖示） 2) 觀察 3D Viewport 3) 再次點擊眼睛圖示恢復顯示
- **預期**：切換關閉後 3D Viewport 中零件 1 消失；再次點擊後恢復；其他零件不受影響

---

**PHI-INT-N-033** ✅ POSITIVE｜3D 分割 — 匯出分割 GLB
- **目標**：使用者匯出分割後的模型
- **前置**：分割模型已載入
- **步驟**：點擊 Export 下拉選單 → 選擇下載 GLB
- **預期**：匯出的 GLB 含完整分割 mesh 及顏色標示

---

### 3.5 Smart Organize（VLM 零件命名）

---

**PHI-INT-N-038** ✅ POSITIVE｜Smart Organize — OpenAI 相容 VLM
- **目標**：使用 OpenAI 相容端點命名並分組零件
- **前置**：`VLM_API_URL` 指向 OpenAI 相容服務；`VLM_API_KEY` 及 `VLM_MODEL` 已設定
- **步驟**：分割完成後，點擊 Smart Organize 按鈕，等待 VLM 回應（3 個零件、2 組圖片）
- **預期**：所有 3 個零件 ID 均獲得命名；零件面板更新

---

**PHI-INT-N-039** ✅ POSITIVE｜Smart Organize — Anthropic VLM
- **目標**：`VLM_API_URL` 含 "anthropic" 時 Smart Organize 運作正常
- **前置**：`VLM_API_URL` 指向 Anthropic 相容端點
- **步驟**：分割完成後點擊 Smart Organize，等待結果
- **預期**：零件面板更新為 AI 命名；無使用者可見錯誤

---

**PHI-INT-N-040** ✅ POSITIVE｜Smart Organize — 缺少零件時 Fallback 命名
- **目標**：VLM 回應省略某零件時，該零件顯示 fallback 名稱
- **前置**：VLM 僅回傳 3 個零件中的 2 個
- **步驟**：觸發 Smart Organize（3 個零件場景）；等待結果
- **預期**：缺少的零件顯示 fallback 名稱 `"Part N (colorname)"`，分組顯示為 `"Ungrouped"`

---

## 4. B. phidias-standalone — 異常流程 (PHI-INT-E)

### 4.1 網路與 Timeout 錯誤

---

**PHI-INT-E-002** ❌ NEGATIVE｜連線拒絕 — 使用者看到可操作錯誤
- **目標**：後端不可達時，UI 顯示明確的錯誤訊息，應用程式不崩潰
- **前置**：`apiBaseUrl` 指向不存在的主機
- **步驟**：在任一工作區觸發需要後端的操作（如點擊生成按鈕）
- **預期**：UI 顯示錯誤訊息；應用程式不崩潰；使用者可繼續操作

---

**PHI-INT-E-003** ❌ NEGATIVE｜圖片生成 — Text-to-Image Timeout（300 秒）
- **目標**：圖片生成超過 300 秒時，使用者看到 timeout 訊息，UI 解除阻塞
- **前置**：模擬後端無限期掛起（`route.fulfill` delay > 300s）
- **步驟**：在圖片生成工作區輸入提示詞後點擊生成，等待逾時
- **預期**：請求中止；UI 解除阻塞；顯示 timeout 錯誤訊息

---

**PHI-INT-E-004** ❌ NEGATIVE｜模型生成 — ReconViaGen Timeout（300 秒）
- **目標**：單圖重建超時後使用者看到錯誤
- **前置**：模擬 ReconViaGen 後端掛起
- **步驟**：上傳圖片後點擊生成，等待逾時
- **預期**：Timeout 中止；使用者看到明確錯誤訊息

---

**PHI-INT-E-005** ❌ NEGATIVE｜模型生成 — 批次生成 Timeout（600 秒）
- **目標**：批次生成在 600 秒後 timeout，使用者看到錯誤
- **前置**：模擬批次 endpoint 掛起
- **步驟**：在 Batch 模式上傳 3 張圖片後點擊生成，等待逾時
- **預期**：600 秒後中止；UI 反映 timeout；使用者可重試

---

**PHI-INT-E-009** ❌ NEGATIVE｜3D 分割 — segment3D Timeout（300 秒）
- **目標**：分割在 300 秒後 timeout，使用者看到錯誤
- **前置**：模擬 P3SAM 後端掛起
- **步驟**：上傳 GLB 後點擊「Start Segmentation」，等待逾時
- **預期**：請求中止；UI 解除阻塞並顯示錯誤

---

**PHI-INT-E-010** ❌ NEGATIVE｜Smart Organize — Timeout（600 秒）
- **目標**：Smart Organize 在 VLM 太慢時 timeout，使用者看到錯誤
- **前置**：模擬 VLM endpoint 掛起
- **步驟**：分割完成後點擊 Smart Organize 按鈕，等待逾時
- **預期**：Timeout 中止；使用者看到錯誤訊息；不一直轉圈

---

### 4.2 非法輸入處理

---

**PHI-INT-E-011** ❌ NEGATIVE｜圖片生成 — 無提示詞且無參考圖片
- **目標**：未提供提示詞且未上傳圖片時，阻止生成
- **前置**：所有輸入欄位為空，多角度模式關閉
- **步驟**：不填任何提示詞、不上傳圖片，直接點擊生成按鈕
- **預期**：生成按鈕被禁用或顯示驗證錯誤；無 API 請求發出

---

**PHI-INT-E-012** ❌ NEGATIVE｜模型生成 — 未選擇檔案即生成
- **目標**：未選擇任何檔案時阻止 3D 模型生成
- **前置**：未選擇任何檔案
- **步驟**：未選擇任何圖片檔案，直接點擊生成按鈕
- **預期**：UI 顯示驗證錯誤；無 API 請求發出

---

**PHI-INT-E-013** ❌ NEGATIVE｜3D 分割 — 上傳非 GLB 檔案
- **目標**：上傳非 GLB 檔案（如 JPEG）時被拒絕
- **前置**：Segment workspace 已開啟
- **步驟**：在分割工作區，將 JPEG 圖片拖入或點擊上傳至 GLB 上傳區域
- **預期**：UI 拒絕檔案類型；顯示錯誤訊息；無 API 請求發出

---

**PHI-INT-E-020** ❌ NEGATIVE｜Proxy — 上游 502 Bad Gateway
- **目標**：上游服務故障時，使用者看到適當錯誤訊息
- **前置**：模擬上游返回 502
- **步驟**：在任一工作區觸發生成，等待回應
- **預期**：UI 顯示錯誤通知；應用程式不崩潰

---

**PHI-INT-E-034** ❌ NEGATIVE｜圖片生成 — 生成成功後下載失敗
- **目標**：生成成功但下載步驟失敗時，使用者看到錯誤（而非損壞圖片）
- **前置**：模擬圖片生成成功；模擬下載返回 404
- **步驟**：觸發圖片生成，等待下載步驟
- **預期**：UI 顯示下載失敗錯誤；不顯示損壞圖片

---

*Phidias Standalone E2E 測試計畫 v2.0 — 共 45 個測試案例*
