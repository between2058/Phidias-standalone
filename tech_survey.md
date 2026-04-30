# 技術評估報告：Phidias 微前端架構與整合策略

## 1. 背景與開發需求
本專案旨在解決 `phidias` 模組的架構整合問題。`phidias` 需具備雙重運行模式：

* **整合模式**：作為外部 `pegaverse-portal/client` 專案 router 中的一個子路由（Route）無縫載入。
* **獨立模式**：可作為一個獨立的 Standalone 服務（Web App）自行 Host 與運行。

**基礎設施與環境前提：**
* Host 運行環境為 Docker 容器化，並透過 Kubernetes (k8s) 進行調度與管理。
* `pegaverse-portal/client` 採用 Vite 進行建置。
* `phidias` 本身基於 Next.js 框架，且包含大量的 Client-side 渲染邏輯（如處理 3D Viewer、three.js 渲染與 Scene Graph 操作）。

**核心架構目標：**
* **開發獨立性**：確保團隊能獨立進行開發、測試與發版。
* **整合便利性**：降低與 Portal 的耦合度，減少對宿主環境配置的侵入性。
* **快速迭代**：維持良好的本地開發體驗（包含快速重載與除錯）。
* **穩定部署**：確保本地打包與 CI pipeline 輸出的 Artifact 高度一致，避免環境差異造成的 Runtime 錯誤。

## 2. 整合技術方案評估
針對上述需求，我們評估了三種主流的前端整合方案：iframe、Module Federation 與 Web Components。

### 方案一：iframe
* **優勢**：提供最嚴格的沙盒隔離，完全不用擔心全域變數或 CSS 污染。整合時完全不干擾 Portal 的 Bundler。若有強烈的 SSR 需求，此方案能無痛保留 Next.js 的伺服器渲染。
* **劣勢**：使用者體驗存在斷層，無法做到完美的無縫整合。跨 iframe 之間的通訊（如狀態共享、URL Deep-link 同步）需仰賴 `postMessage`，開發與維護成本高。

### 方案二：Module Federation

* **優勢**：能做到最深度的整合，子應用與宿主應用共享同一個 React Runtime，組件層級的互動最為自然，且能避免重複載入相同的套件（如 React、three.js）。
* **劣勢**：在此專案背景下**極度不推薦**。Portal (Vite) 與 Phidias (Next.js/Webpack) 的 Bundler 差異巨大。協調跨框架的模組聯邦、處理 SSR 水合（Hydration），以及嚴格管控 Peer Dependencies 版本，會帶來不成比例的工程複雜度與後續維護災難。

### 方案三：Web Components (推薦)
* **優勢**：完美平衡了「獨立性」與「整合體驗」。可將複雜的 3D 渲染邏輯與 UI 封裝在 Custom Element 內部。Portal 僅需引入一個編譯好的 JS 腳本即可像原生標籤一樣使用（如 `<phidias-app>`），對 Portal 的伺服器與路由配置零侵入。
* **劣勢**：HMR（熱模組替換）體驗與原生 SPA 略有落差。打包產物中可能會包含重複的依賴（如 React），導致初始載入體積稍大。

## 3. 架構決策與總結
**決策結果：採用 Web Components 作為主要整合方案。**

**選型理由：**
此專案的 3D 相關互動主要依賴 Client-side 執行，對 SSR/SEO 的需求較低，Web Components 的劣勢不構成阻礙。同時，此方案允許 Portal 維持乾淨的 Vite 環境，不需要頻繁調整 Reverse-proxy 設定。針對 3D Viewer 這種具備高度封裝特性且需要隔離 Canvas 樣式的應用場景，Shadow DOM 提供了極佳的保護機制。若未來仍有最極簡的獨立部署需求，也可以輕易退回 iframe 模式（將編譯好的靜態檔案以 Nginx 提供服務）。

## 4. 本地開發與測試流程
針對 Web Component 架構，團隊的日常開發與整合測試流程定義如下：

* **Phidias 獨立功能開發（最佳 DX）**：直接進入 `client/src/modules/phidias` 目錄，執行 `npm run dev` 啟動 Next.js 開發伺服器。此模式享有完整的 HMR 與最佳除錯體驗，適用於所有不依賴 Portal 環境的獨立功能與 3D 場景開發。
* **與 Portal 聯調的整合測試**：需開啟兩個終端機並行運作。
    * **終端機 A (Phidias 監聽編譯)**：進入 Phidias 目錄，執行 Vite 的 Watch 模式 (`npx vite build --config vite.wc.config.ts --watch`)。此動作會在代碼變更時，於小於 1 秒內快速重新打包 Web Component 的 Artifact (`dist/phidias-wc.js`)。
    * **終端機 B (Portal 開發伺服器)**：啟動 Portal 的 `npm run dev`。Portal 會讀取 Phidias 輸出的最新 Artifact 進行渲染。
* **注意事項**：此整合模式下不具備完整的 HMR，每次 Phidias 代碼更新並觸發 Watch Build 後，需手動重新整理瀏覽器以載入最新的 Component。

## 5. 版控、CI/CD 與 Docker 部署策略 (支援整合與 Standalone 雙模式)


為了同時滿足 Portal 的無縫整合以及 Phidias 作為獨立應用的需求，我們的部署架構將從「單一 Image」升級為**「雙 Image 輸出」**。這意味著在 CI/CD 流程中，我們會平行或循序產出兩個獨立的 Docker Image。

### 5.1 Git 版控原則
所有編譯出來的靜態產物（如 `dist/phidias-wc.js` 或是 Next.js 的 `.next` 資料夾）**絕對不可**追蹤進入 Git 版控，必須加入 `.gitignore`。僅控管原始碼作為唯一的事實來源 (Source of Truth)，以避免環境微小差異造成的 Binary 衝突。

### 5.2 CI/CD Pipeline 流程設計 (以 GitLab CI/CD 為例)
在 CI Pipeline 中，建議將流程拆分為明確的階段 (Stages)，並妥善利用 Artifacts 傳遞：

1. **Stage 1: Build Phidias Web Component**
   * 在 CI 環境中使用 `pnpm run build:wc` 編譯出 `phidias-wc.js`。
   * 將此 JS 檔案存為 CI Pipeline 的 Artifact。
2. **Stage 2: Build Docker Images (平行處理)**
   * **Job A (Build Portal Image)**：下載 Stage 1 的 Artifact，放入 Portal 的 `public/phidias/` 內，接著執行 Portal 的 `pnpm run build`，最後打包成 Nginx 靜態伺服器 Image。
   * **Job B (Build Phidias Standalone Image)**：直接針對 Phidias 模組執行標準的 Next.js `pnpm run build`，打包成 Node.js 運行環境的 Image，以保留其完整的 SSR 與獨立 API 能力。

### 5.3 Dockerfile 實作策略

我們需要維護兩份 Dockerfile：

**Dockerfile A: Phidias Standalone 服務 (`phidias.Dockerfile`)**
這是一個標準的 Next.js 部署設定，讓 Phidias 可以獨立運作。
```dockerfile
# 使用 Alpine 作為基礎
FROM node:20-alpine AS builder
# 啟用 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY client/src/modules/phidias/package.json client/src/modules/phidias/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/src/modules/phidias/ ./
# 建置 Next.js Standalone 產物
RUN pnpm run build

# 運行階段
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```
**Dockerfile B: 包含 Web Component 的 Portal (portal.Dockerfile)**
利用 Multi-stage build，在一個流程中確保 Web Component 被正確編譯並安插進 Portal。這能確保建置環境的純淨度，避免本地端與 CI 環境差異導致的運行錯誤。
```dockerfile
# Stage 1: 建置 Phidias Web Component
FROM node:20-alpine AS phidias-wc-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/phidias
COPY client/src/modules/phidias/package.json client/src/modules/phidias/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/src/modules/phidias/ ./
RUN pnpm run build:wc

# Stage 2: 建置 Pegaverse Portal
FROM node:20-alpine AS portal-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/ ./
# 【關鍵】將編譯好的 Web Component 複製到 Portal 的靜態資源目錄
COPY --from=phidias-wc-builder /app/phidias/dist/phidias-wc.js ./public/phidias/phidias-wc.js
RUN pnpm run build

# Stage 3: 部署 Portal 至 Nginx
FROM nginx:alpine
COPY --from=portal-builder /app/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
