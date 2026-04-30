# Phidias Agent Instructions

這些指令適用於在本專案（Phidias / PEGAHorse）工作的 AI 助理。

## 專案概述
- **正式名稱**: Phidias
- **架構核心**: 雙模式運行 (Standalone Next.js App / Web Component Integration)
- **主要領域**: 3D 場景編輯器、AI 輔助建模與資產管理

## 技術棧 (Tech Stack)
- **Framework**: Next.js 14 (App Router)
- **Build Tool**: pnpm (主要), Vite (用於 Web Component 打包)
- **3D Libraries**: Three.js, React Three Fiber (R3F), PlayCanvas, Spark JS
- **State Management**: Zustand (+ Zundo for undo/redo)
- **Styling**: Tailwind CSS, Framer Motion, Lucide React
- **Entry Points**:
  - Standalone: `src/app/page.tsx`
  - Web Component: `src/wc-entry.tsx` (Vite config: `vite.wc.config.ts`)
  - Portal Integration: `PhidiasRoute.jsx` (Wrapper for custom element `<phidias-app>`)

## 常用指令
- `npm run dev`: 啟動 Next.js 開發環境 (Standalone)
- `npm run build:wc`: 打包 Web Component (`dist/phidias-wc.mjs`)
- `npm run dev:wc`: Vite watch 模式，快速編譯 Web Component
- `npm run build`: Next.js 完整建置
- `npm run lint`: 執行 ESLint 檢查
- `next start`: 在正式環境執行SSR (server-side rendering)

## 雙模式開發 (Dual-Mode)
- **Standalone (Next.js)**: 當 `apiBaseUrl` 為空時，前端呼叫 `/phidias/*` 會透過 `next.config.mjs` 的 rewrites 導向至 `src/app/api/phidias/*`。
- **Web Component (WC)**: 當 host app 指定 `apiBaseUrl` 時，前端會直接與目標 URL 通訊，繞過 Next.js API Routes。
- **開發要求**: 
  - API 實作：
    - 新增 API 必須同時在 `src/lib/api/phidias.ts` (前端 Client) 與 `src/app/api/phidias/` (Standalone Proxy) 實作。
    - Client: `src/lib/api/phidias.ts`: 需要以function call的方式實作而不是用一個物件把複數個function封裝起來。
    - Proxy: `src/app/api/phidias/`: app/api/phidias/的api call僅僅是在standalone模式下作為proxy使用。
  - **環境變數與props**:
    - `.env`的環境變數僅在standalone的情況下被使用，他可以讓next.js的api proxy直接呼叫API endpoint (這些API endpoint在web component模式下會在一個獨立的後端服務中被代理)。
    - runtime的config注入方式定義在`src/config`中。這些設置會在被傳遞給context provider的時候被寫入zustand store中以便各個component可以依據不同模式進行不同的渲染或處理。

## 溝通與 Note
- **語言**: 永遠使用**繁體中文**回覆需求，但程式碼中的註解、變數、AI Prompt 必須使用**英文**。
- **UI/UX 規範**: 
  - 風格：毛玻璃效果 (Glassmorphism)、漸層邊框、圓角設計、科幻感。
  - 色彩：深藍/靛色底 (`#1a1a2e`), 紫色主題 (`#7c3aed`), 橘色強調 (`#f5a623`)。
  - 組件：禁止用原生 Alert/Confirm，一律使用自訂 Modal 或 Toast。
  - RWD：確保 3D Viewport 與側邊欄在不同螢幕尺寸下正常顯示。
- **日期顯示**: 年->月->日->時->分->秒 (e.g., 2026-03-16 14:30:00)。
- **國際化 (i18n)**: 禁止硬編碼 UI 文字，優先考慮可擴展性。
- **日誌**: 使用 `console.log` 時應帶有區分標籤，正式環境輸出應考慮使用 Logger。

## 程式開發規則
- **API 代理 (Standalone)**: 使用 `src/app/api/phidias/_proxy.ts` 進行請求轉發。內部微服務位址由環境變數 (`P3SAM_API_URL` 等) 定義。
- **雙模式意識**: 修改 UI 或 API 時，必須考慮在 Standalone 與 Web Component 模式下都能運作。
- **3D 效能**: 處理資產加載、渲染循環時，優先考慮效能優化 (e.g., useMemo, useCallback)。
- **狀態管理**: 跨組件狀態優先使用 Zustand (`src/store/phidias-store.ts`)。
- **型別安全**: 嚴格遵守 TypeScript 型別定義。
- **DDD 與設計模式**: 實作前考慮 Design Pattern (如 Factory, Observer)，保持程式碼擴展性。
- **檔案限制**: 單一檔案儘量控制在 1000 行以內。

## 安全規則
- **嚴禁**硬編碼 API Key、Secret 或登錄資訊。
- **嚴禁**提交 `.env` 或包含機密資訊的檔案。
- **路徑安全**: 處理檔案路徑或 API URL 時需進行清理，防止 Directory Traversal。