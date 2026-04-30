# Phidias WC × Pegaverse-Portal 整合測試計畫

**版本**：2.1　**日期**：2026-03-30

**範圍**：phidias-standalone 以 `npm run build:wc` 編譯後，透過 phidias-static 靜態服務，在 pegaverse-portal 以 `<phidias-app>` Web Component 掛載時的 **使用者視角** E2E 測試。

> **相關文件**：
> - `phidias-standalone-test-case.md` — Standalone Next.js E2E（使用者行為）
> - Vitest 單元測試 — API Client、Proxy 路由、Retry 邏輯、Zustand store（見 `src/` 下各 `*.test.ts`）

---

## 目錄

1. [摘要](#1-摘要)
2. [測試環境](#2-測試環境)
3. [Seed Data](#3-seed-data)
4. [A. WC 渲染與 Host-App UI 差異 (WC-UI)](#4-a-wc-渲染與-host-app-ui-差異-wc-ui)
5. [B. Upload to Pegaverse 完整流程 (WC-UPLOAD)](#5-b-upload-to-pegaverse-完整流程-wc-upload)
6. [C. API 錯誤處理 (WC-API)](#6-c-api-錯誤處理-wc-api)
7. [D. 靜態資源服務 (WC-STATIC)](#7-d-靜態資源服務-wc-static)
8. [E. 異常流程 (WC-ERR)](#8-e-異常流程-wc-err)
9. [F. 可靠性 (WC-REL)](#9-f-可靠性-wc-rel)

---

## 1. 摘要

| 編號範圍 | 類型 | 說明 | 數量 |
|---|---|---|---|
| WC-UI-001～012（10 項） | ✅ POSITIVE | WC 渲染與 host-app 造成的 UI 行為差異 | 10 |
| WC-UI-013～015 | ❌ NEGATIVE | UI 差異異常路徑 | 3 |
| WC-UPLOAD-001～008 | ✅ POSITIVE | Upload to Pegaverse 完整 E2E 正常流程 | 8 |
| WC-UPLOAD-009～014（5 項） | ❌ NEGATIVE | Upload to Pegaverse 異常路徑 | 5 |
| WC-API-008～009 | ❌ NEGATIVE | API 錯誤處理 | 2 |
| WC-STATIC-001、003 | ✅ POSITIVE | 靜態資源服務正常流程 | 2 |
| WC-STATIC-007～008 | ❌ NEGATIVE | 靜態資源服務異常路徑 | 2 |
| WC-ERR-004～007 | ❌ NEGATIVE | WC 整合層異常路徑 | 4 |
| WC-REL-001、003、005 | ✅ POSITIVE | 可靠性（重新掛載、並發操作、頁面刷新） | 3 |
| **合計** | | | **39** |

> **POSITIVE**：驗證 Happy Path 產生正確輸出。
> **NEGATIVE**：驗證在錯誤條件下，使用者看到安全且明確的提示。

---

## 2. 測試環境

### 必要服務

| 服務 | 說明 |
|---|---|
| pegaverse-portal（前端） | React + Redux，含 PhidiasRoute 與 API Bridge |
| pegaverse-portal（後端） | FastAPI，提供 `/api/v1/assets/*`、`/api/v1/auth/*` |
| phidias-static（nginx） | 服務 `phidias-wc.js` 及靜態資源（HDRI、材質） |
| Nucleus / 資產後端 | 提供資產目錄樹（`getAssets`）及上傳 endpoint |
| ReconViaGen / Qwen / P3SAM | AI 後端服務（3D 生成、圖片生成） |

### 環境變數（Portal）

| 變數 | 說明 | 測試值 |
|---|---|---|
| `REACT_APP_PHIDIAS_ENABLED` | 功能旗標 | `true` |
| `REACT_APP_PHIDIAS_CDN_BASE` | phidias-static nginx 根路徑 | `http://localhost:8080/phidias-static` |
| `REACT_APP_BACKEND_URL` | Portal 後端 API base | `http://localhost:9527/api/v1` |

### WC Attributes（PhidiasRoute 傳入）

| Attribute | 值 | 說明 |
|---|---|---|
| `api-base-url` | `http://localhost:9527/api/v1` | WC 模式下直接打後端 |
| `host-app` | `pegaverse` | 觸發 pegaverse 專屬 UI |
| `base-path` | `/phidias` | BrowserRouter basename |
| `user` | `phidias` | 從 portal session 取得 |

### 瀏覽器

- Chrome 120+（首選，完整 Custom Elements v1 支援）
- Firefox 121+

---

## 3. Seed Data

### 使用者資料

| 欄位 | 值 | 使用測試 |
|---|---|---|
| 帳號 | `phidias` | 全部 |
| 密碼 | `phidias` | 全部 |
| userId cookie | `user-42` | WC-UPLOAD-* |

### 資產資料（Nucleus 目錄樹）

| 節點 | 類型 | path | 使用測試 |
|---|---|---|---|
| Root | category | `/Projects` | WC-UPLOAD-001～008 |
| 子資料夾 A | folder | `/Projects/Factory` | WC-UPLOAD-001～008 |
| 子資料夾 B | folder | `/Projects/Archive` | WC-UPLOAD-003 |
| 空資料夾 C | folder | `/Projects/Empty` | WC-UPLOAD-006 |

### 測試模型檔案

| 檔名 | 格式 | 大小 | 使用測試 |
|---|---|---|---|
| `cube_test.glb` | GLB | ~1MB | WC-UPLOAD-001～008 |
| `large_model.glb` | GLB | ~50MB | WC-UPLOAD-005 |

### 設置步驟

```bash
# 1. 登入 portal，以 phidias 帳號取得 session
# 2. 確認 Nucleus 目錄樹存在（透過 GET /api/v1/assets/hierarchy 驗證）
# 3. 在 Phidias 中生成或上傳一個 GLB 資產（供 Upload to Pegaverse 流程使用）
```

---

## 4. A. WC 渲染與 Host-App UI 差異 (WC-UI)

---

**WC-UI-001** ✅ POSITIVE｜首頁 — TopNavBar 在 WC 模式下不渲染
- **目標**：以 `host-app="pegaverse"` 掛載時，Phidias 首頁不顯示 TopNavBar
- **前置**：使用者已登入；已導航至 `/phidias`；WC 已掛載完成
- **步驟**：1) 導航至 `/phidias` 2) 觀察頁面頂部區域 3) 觀察 Portal 原有的 NavBar
- **預期**：Phidias 內部無 TopNavBar（無 Phidias logo、無導航連結）；Portal 自身的導覽列仍在頁面最頂部

---

**WC-UI-002** ✅ POSITIVE｜首頁 — 歡迎訊息顯示 Portal 傳入的使用者名稱
- **目標**：`user="phidias"` attribute 傳入後，首頁顯示 "Welcome back, phidias"
- **前置**：`phidias` 已登入；WC 掛載時帶有 `user="phidias"` attribute
- **步驟**：1) 導航至 `/phidias` 2) 觀察 Hero Section 標題
- **預期**：顯示 "Welcome back, phidias"

---

**WC-UI-003** ✅ POSITIVE｜首頁 — Quick Start 連結在 base-path 內路由
- **目標**：Quick Start 卡片的連結在 `base-path="/phidias"` 下正確跳轉，不導致整頁刷新
- **前置**：WC 已掛載，`base-path="/phidias"`
- **步驟**：1) 點擊 "Image to 3D" 卡片 2) 確認無整頁刷新 3) 點擊 "Text to 3D" 卡片 4) 使用瀏覽器返回按鈕
- **預期**：SPA 內部導航，URL 依序變為 `/phidias/workspace/image` 和 `/phidias/workspace/model`；Portal 整體 chrome 不重新載入；返回後 Phidias 首頁重新渲染

---

**WC-UI-004** ✅ POSITIVE｜Workspace Layout — TopNavBar 在 WC 模式下不渲染
- **目標**：在工作區（Model、Image、Segment）中，WC 模式下 TopNavBar 不出現
- **前置**：WC 已掛載，`host-app="pegaverse"`
- **步驟**：1) 導航至 `/phidias/workspace/model` 2) 觀察頂部 3) 導航至 `/phidias/workspace/image` 4) 觀察頂部
- **預期**：兩個工作區均無 Phidias 自身的 TopNavBar；Portal NavBar 正常顯示

---

**WC-UI-005** ✅ POSITIVE｜AssetGrid — 右鍵選單在 host-app=pegaverse 時顯示「Upload to Pegaverse」
- **目標**：`host-app="pegaverse"` 時，AssetGrid 右鍵選單包含 "Upload to Pegaverse" 選項
- **前置**：WC 已掛載；Asset Panel 中至少有一個 ready 狀態的 3D 模型資產
- **步驟**：1) 在 Model Workspace 中完成或匯入一個 GLB 資產 2) 右鍵點擊該資產卡片 3) 觀察選單項目
- **預期**：Context Menu 包含 "Upload to Pegaverse" 選項（↑ 圖示）

---

**WC-UI-008** ✅ POSITIVE｜Asset Panel — 標籤切換在 WC 模式下正常運作
- **目標**：Asset Panel 的 Assets / Scene / History 標籤在 WC 模式下可正常切換
- **前置**：WC 已掛載，已導航至任一工作區
- **步驟**：1) 點擊 "Scene" 標籤 2) 點擊 "Assets" 標籤 3) 在 Segment 工作區完成分割
- **預期**：Scene 標籤啟用顯示 Scene Panel；Assets 標籤啟用顯示 Asset Grid；完成分割後自動切換至 Scene 標籤

---

**WC-UI-009** ✅ POSITIVE｜Phidias 首頁 — 導航至 Model Workspace 後返回首頁保持 WC 狀態
- **目標**：在 WC 模式下於 Phidias 內部路由往返，Portal 狀態不被重置
- **前置**：WC 已掛載；已在 Asset Panel 生成了一個資產
- **步驟**：1) 在 Model Workspace 生成一個模型 2) 點擊 Portal 側邊欄其他功能（如 Virtual Factory） 3) 點擊 Portal 側邊欄 Phidias 返回
- **預期**：返回後 WC 重新掛載；in-memory 資產清空屬預期行為（非 bug）

---

**WC-UI-010** ✅ POSITIVE｜Asset 狀態徽章 — 生成中顯示進度百分比
- **目標**：WC 模式下，正在生成的資產在 Asset Panel 顯示旋轉動畫與進度百分比
- **前置**：已觸發 3D 模型生成，生成進行中
- **步驟**：1) 在 Model Workspace 上傳圖片並點擊生成 2) 觀察資產卡片右上角 3) 等待生成完成
- **預期**：生成中顯示旋轉圓圈 + 進度百分比（如 "42%"）；完成後徽章消失，縮圖顯示

---

**WC-UI-011** ✅ POSITIVE｜Asset Grid 排序 — WC 模式下排序功能正常
- **目標**：WC 模式下 Asset Grid 的排序下拉選單可正常切換
- **前置**：Asset Panel 中有至少 3 個資產
- **步驟**：1) 點擊排序按鈕（↕ 圖示） 2) 選擇 "Name A→Z" 3) 選擇 "Latest first"
- **預期**：下拉選單含 Latest first / Oldest first / Name A→Z / Name Z→A / File size；各模式排序結果正確

---

**WC-UI-012** ✅ POSITIVE｜Asset Grid 篩選 — WC 模式下 Model Type 篩選正常
- **目標**：WC 模式下 Filter 下拉選單可按 model type 篩選資產
- **前置**：Asset Panel 中有 textured 和 untextured 類型的資產各至少 1 個
- **步驟**：1) 點擊 Filter 按鈕 2) 選擇 "Textured" 3) 點擊 Reset 按鈕
- **預期**：選 Textured 後只顯示 textured 類型資產；Reset 後所有資產重新顯示

---

**WC-UI-013** ❌ NEGATIVE｜首頁 — user attribute 為空時顯示 fallback
- **目標**：`user=""` 或未傳入 user 時，首頁顯示 fallback 使用者名稱或空白，不崩潰
- **前置**：WC 掛載時 `user=""` 或省略 user attribute
- **步驟**：1) 以 `user=""` 掛載 WC 2) 觀察 Hero Section
- **預期**：顯示 "Welcome back, "（空字串）或適當 fallback；不顯示 `null` 或 `undefined`；不崩潰

---

**WC-UI-014** ❌ NEGATIVE｜AssetGrid — 右鍵選單在資產生成中（generating）時選項被禁用
- **目標**：生成中的資產右鍵選單不顯示可用的破壞性操作
- **前置**：WC 已掛載，host-app=pegaverse；有一個 generating 狀態的資產
- **步驟**：1) 觸發生成，在 generating 狀態時右鍵點擊資產卡片 2) 嘗試點擊 "Upload to Pegaverse" 3) 取消後等待生成完成，再次右鍵
- **預期**：生成完成後操作正常；Modal 在生成中開啟時需記錄實際行為（目前可能無禁用邏輯）

---

**WC-UI-015** ❌ NEGATIVE｜WC 模式 — host-app 值不為 "pegaverse" 時不顯示 Upload to Pegaverse
- **目標**：`host-app="other-app"` 時，Upload to Pegaverse 選項不出現
- **前置**：以 `host-app="other-app"` 掛載 WC；Asset Panel 有資產
- **步驟**：1) 右鍵點擊資產 2) 確認選單項目
- **預期**：Context Menu 無 "Upload to Pegaverse"

---

## 5. B. Upload to Pegaverse 完整流程 (WC-UPLOAD)

---

**WC-UPLOAD-001** ✅ POSITIVE｜完整 E2E — 開啟 Modal 並選擇資料夾上傳
- **目標**：使用者右鍵選擇 Upload to Pegaverse，選擇目標資料夾並成功上傳
- **前置**：WC 已掛載，`host-app="pegaverse"`；Asset Panel 有一個 ready 狀態的 `cube_test.glb` 資產；Nucleus 目錄樹可用（含 `/Projects/Factory`）；使用者已認證
- **步驟**：1) 右鍵點擊 `cube_test.glb` 資產卡片 2) 點擊 "Upload to Pegaverse" 3) 等待資料夾樹載入完成 4) 點擊 `Factory` 資料夾 5) 點擊 "Upload Asset" 按鈕 6) 等待上傳完成
- **預期**：Modal 展開顯示 "Upload to PEGAVERSE" 標題及 `cube_test.glb` 副標題；資料夾樹顯示 `/Projects` 下 `Factory`、`Archive`、`Empty`；選擇後 Upload 按鈕啟用；進度條從 0% 遞增至 100%；完成後 Modal 自動關閉；上傳目錄為 `/Projects/Factory`

---

**WC-UPLOAD-002** ✅ POSITIVE｜資料夾樹展開/收合互動
- **目標**：Modal 中的資料夾樹可正確展開和收合子節點
- **前置**：UploadToPegaverseModal 已開啟，資料夾樹載入完成
- **步驟**：1) 點擊 `/Projects` 旁的 ChevronDown 圖示收合 2) 點擊 ChevronRight 再次展開 3) 雙擊 `/Projects` 行
- **預期**：收合時子資料夾隱藏，圖示變為 ChevronRight；展開時子資料夾重新顯示；樹中只顯示資料夾節點，不顯示資產類型節點

---

**WC-UPLOAD-003** ✅ POSITIVE｜切換資料夾選擇
- **目標**：選擇不同資料夾時，高亮正確轉移
- **前置**：Modal 已開啟；`Factory` 資料夾已選中
- **步驟**：1) 點擊 `Archive` 資料夾 2) 確認 Upload 按鈕狀態
- **預期**：`Archive` 高亮；`Factory` 不再高亮；Upload 按鈕仍可點擊

---

**WC-UPLOAD-004** ✅ POSITIVE｜上傳前 Modal 可取消
- **目標**：點擊 Cancel 關閉 Modal，無副作用
- **前置**：Modal 已開啟，尚未點擊 Upload
- **步驟**：1) 點擊 "Cancel" 按鈕確認關閉 2) 重新開啟 Modal，點擊 X 按鈕（右上角）
- **預期**：兩種方式均可關閉 Modal；無上傳請求發出

---

**WC-UPLOAD-005** ✅ POSITIVE｜大型檔案上傳進度條更新
- **目標**：50MB GLB 上傳時，進度條連續更新
- **前置**：Asset Panel 有 `large_model.glb`（~50MB）；已選擇目標資料夾
- **步驟**：1) 開始上傳 `large_model.glb` 2) 觀察進度條更新頻率 3) 等待上傳完成
- **預期**：進度條持續遞增，百分比數字與進度條寬度一致；完成後 Modal 關閉

---

**WC-UPLOAD-006** ✅ POSITIVE｜資料夾樹空時顯示空狀態
- **目標**：`getAssets` 返回空陣列時，顯示「No folders available」空狀態
- **前置**：模擬 `getAssets` 返回空資料
- **步驟**：1) 右鍵資產 → Upload to Pegaverse 2) 等待樹載入完成 3) 確認 Upload 按鈕狀態
- **預期**：顯示 "No folders available"；Upload Asset 按鈕保持禁用

---

**WC-UPLOAD-007** ✅ POSITIVE｜GLB 以外的資產格式自動附加正確副檔名
- **目標**：資產名稱若不含副檔名，上傳時自動附加 .glb 後綴
- **前置**：Asset Panel 有一個名為 `my_model`（無副檔名）的資產；已選擇目標資料夾
- **步驟**：1) 對 `my_model` 資產點擊 Upload to Pegaverse 2) 選擇資料夾並點擊 Upload
- **預期**：Modal 副標題顯示 `"my_model"`；上傳成功；實際上傳的檔名為 `my_model.glb`

---

**WC-UPLOAD-008** ✅ POSITIVE｜上傳期間 Cancel 按鈕禁用
- **目標**：上傳進行中，Cancel 按鈕禁用，防止使用者意外關閉
- **前置**：已開始上傳（進度條顯示中）
- **步驟**：1) 觀察上傳進行中的 Modal 2) 嘗試點擊 Cancel 3) 嘗試點擊 X（右上角）
- **預期**：Cancel 按鈕呈禁用樣式（透明度降低）；點擊無反應

---

**WC-UPLOAD-009** ❌ NEGATIVE｜未選資料夾時 Upload 按鈕禁用
- **目標**：未選任何資料夾時，Upload Asset 按鈕無法點擊
- **前置**：Modal 已開啟，資料夾樹已載入，尚未選擇任何節點
- **步驟**：1) 觀察初始狀態 2) 嘗試點擊 Upload Asset
- **預期**：Upload Asset 按鈕呈禁用樣式；點擊無反應

---

**WC-UPLOAD-010** ❌ NEGATIVE｜getAssets API 失敗時 Modal 顯示空狀態不崩潰
- **目標**：`getAssets` 呼叫失敗時，Modal 顯示空狀態，不崩潰
- **前置**：模擬 portal 的 `getAssets` 函式拋出錯誤
- **步驟**：1) 開啟 Upload to Pegaverse Modal 2) 等待載入失敗 3) 嘗試關閉 Modal
- **預期**：顯示「No folders available」空狀態；Modal 未崩潰且可正常關閉

---

**WC-UPLOAD-012** ❌ NEGATIVE｜fetch asset.modelUrl 失敗時 Modal 解除鎖定
- **目標**：資產檔案無法取得時，Modal 不被鎖住，使用者可重試或取消
- **前置**：資產的 modelUrl 為不可達的 URL；已選擇資料夾
- **步驟**：1) 點擊 Upload Asset 2) 等待 fetch 失敗
- **預期**：進度條消失；Cancel 按鈕重新可用；不崩潰

---

**WC-UPLOAD-013** ❌ NEGATIVE｜Portal uploadAssetsXHR 失敗時 Modal 解除鎖定
- **目標**：XHR 上傳失敗時，Modal 的上傳狀態重置，使用者可重試或取消
- **前置**：模擬 `uploadAssetsXHR` 返回錯誤
- **步驟**：1) 上傳進行中，模擬 XHR 失敗 2) 觀察 Modal 狀態
- **預期**：進度條消失；Cancel 按鈕重新可用；無崩潰

---

**WC-UPLOAD-014** ❌ NEGATIVE｜getUploadId 失敗時不建立 upload job
- **目標**：`getUploadId` 失敗時，Portal 不加入新 upload job，`onError` 被呼叫
- **前置**：模擬 `getUploadId` 拋出錯誤
- **步驟**：1) 觸發上傳 2) 確認 Portal upload job 清單 3) 確認 callback 行為
- **預期**：upload job 清單無新增；`onSuccess` 不被呼叫；Modal 解除鎖定

---

## 6. C. API 錯誤處理 (WC-API)

---

**WC-API-008** ❌ NEGATIVE｜WC 模式 — 後端返回 401 顯示認證錯誤
- **目標**：accessToken 過期，後端返回 401 時，UI 顯示適當錯誤
- **前置**：使用過期的 accessToken
- **步驟**：1) 觸發任意 API 請求（如圖片生成） 2) 觀察 UI
- **預期**：顯示認證錯誤（如 "Session 已過期"）；不崩潰

---

**WC-API-009** ❌ NEGATIVE｜WC 模式 — 後端返回 500 顯示服務錯誤
- **目標**：後端返回 500 時，UI 顯示 "Internal server error"
- **步驟**：1) 觸發 API 請求；模擬後端返回 500 2) 觀察 UI
- **預期**：顯示含 "Internal server error" 的錯誤通知；不崩潰

---

## 7. D. 靜態資源服務 (WC-STATIC)

---

**WC-STATIC-001** ✅ POSITIVE｜WC Bundle 從 CDN Base 正確載入
- **目標**：`phidias-wc.js` 從 `REACT_APP_PHIDIAS_CDN_BASE` 指定的路徑成功載入
- **前置**：phidias-static nginx 運行在 `http://localhost:8080/phidias-static`
- **步驟**：1) 導航至 `/phidias` 2) 觀察 WC 是否正常渲染
- **預期**：WC bundle 成功載入（HTTP 200）；`<phidias-app>` 正常渲染 Phidias 內容

---

**WC-STATIC-003** ✅ POSITIVE｜WC 內 3D 靜態資源從 staticBase 解析
- **目標**：HDRI 背景、材質等靜態資源從 WC bundle 所在路徑正確解析，無 404 錯誤
- **前置**：phidias-static 上有 HDRI 檔案；WC 已渲染 3D Viewport
- **步驟**：1) 導航至 Model Workspace 2) 觀察 3D Viewport 環境光
- **預期**：3D 場景有正確環境光；無 HDRI 資源載入錯誤

---

**WC-STATIC-007** ❌ NEGATIVE｜CDN Base 不可達時顯示錯誤 UI
- **目標**：phidias-static 服務不可達時，portal 顯示 "Could not load Phidias" 錯誤
- **前置**：`REACT_APP_PHIDIAS_CDN_BASE` 指向不存在的服務
- **步驟**：1) 導航至 `/phidias` 2) 觀察 UI 3) 嘗試 Portal 其他路由
- **預期**：顯示錯誤 UI（⚠️ + "Could not load Phidias"）；Portal 其他路由正常可用

---

**WC-STATIC-008** ❌ NEGATIVE｜靜態資源 404 時 3D 渲染降級
- **目標**：HDRI 或材質資源 404 時，3D Viewport 以預設材質降級顯示，不崩潰
- **前置**：phidias-static 上缺少 HDRI 檔案
- **步驟**：1) 導航至 Model Workspace 2) 觀察 3D Viewport
- **預期**：3D Viewport 以預設背景降級顯示；不觸發 React 崩潰

---

## 8. E. 異常流程 (WC-ERR)

---

**WC-ERR-004** ❌ NEGATIVE｜portal 未登入時直接訪問 `/phidias` 被重定向
- **目標**：未登入使用者訪問 `/phidias` 時，portal ProtectedLayout 重定向至登入頁
- **前置**：使用者未登入（已清除 session）
- **步驟**：1) 未登入，直接訪問 `http://portal/phidias` 2) 觀察重定向目標
- **預期**：被重定向至 `/`（登入頁）；Phidias WC 不被載入

---

**WC-ERR-005** ❌ NEGATIVE｜`REACT_APP_PHIDIAS_ENABLED=false` 時訪問 `/phidias` 顯示 404
- **步驟**：1) 以 `REACT_APP_PHIDIAS_ENABLED=false` 建置 Portal，訪問 `/phidias` 2) 確認頁面
- **預期**：顯示 404 頁面；PhidiasRoute 不載入

---

**WC-ERR-006** ❌ NEGATIVE｜WC 內部 React 崩潰時，Error Boundary 顯示 fallback UI
- **目標**：WC 內部元件拋出錯誤時，Error Boundary 捕捉並顯示 fallback，不使整個 Portal 崩潰
- **前置**：在 WC 內部某元件注入會拋錯的 prop
- **步驟**：1) 觸發 WC 內部崩潰 2) 觀察 WC 區域 UI 3) 確認 Portal 其他路由
- **預期**：WC 區域顯示 fallback UI；Portal NavBar 和其他路由仍正常可用

---

**WC-ERR-007** ❌ NEGATIVE｜WC bundle 腳本執行錯誤時顯示錯誤
- **目標**：phidias-wc.js 包含語法錯誤導致執行失敗時，portal 顯示錯誤 UI
- **前置**：模擬腳本執行失敗（替換 bundle 為損壞版本）
- **步驟**：1) 載入損壞的 phidias-wc.js 2) 觀察 UI 3) 確認 Portal 其他功能
- **預期**：顯示錯誤 UI；portal 其他功能正常（記錄目前是否有 timeout 機制）

---

## 9. F. 可靠性 (WC-REL)

---

**WC-REL-001** ✅ POSITIVE｜WC 從 Portal 路由離開再返回後重新掛載正常
- **目標**：離開再返回 `/phidias` 後，`<phidias-app>` 重新掛載，app 正常初始化
- **步驟**：1) 導航至 `/phidias`，確認 WC 正常渲染 2) 導航至其他 portal 路由（如 `/home`） 3) 返回 `/phidias` 4) 確認無異常警告
- **預期**：WC 卸載後重新掛載；Phidias 首頁重新渲染；console 無 React 異常警告

---

**WC-REL-003** ✅ POSITIVE｜同時進行生成與上傳時 UI 正常
- **目標**：在 3D 生成進行中，同時觸發 Upload to Pegaverse，兩個操作互不干擾
- **前置**：有至少一個 ready 資產和一個 generating 資產
- **步驟**：1) 觸發 3D 生成（generating 狀態） 2) 同時對 ready 資產觸發 Upload to Pegaverse 3) 完成上傳後關閉 Modal 4) 等待生成完成
- **預期**：上傳完成後 Modal 關閉；生成仍持續進行直到完成；兩個操作互不干擾

---

**WC-REL-005** ✅ POSITIVE｜Portal 頁面重新整理後 WC 重新初始化正常
- **目標**：使用者在 `/phidias` 頁面按 F5 重新整理後，WC 完整重新初始化
- **步驟**：1) 在 `/phidias` 頁面按 F5 2) 確認 WC 重新掛載 3) 觸發任意 API 請求確認正常運作
- **預期**：phidias-wc.js 重新載入；WC 重新渲染；attributes 正確傳入；API 請求正常處理

---

> **合計 39 項** (2026-03-30)
