/* eslint-disable */
/**
 * src/wc-entry.tsx
 *
 * Web Component entry point for Phidias.
 * 整合 @pegaverse/phidias-sdk 的 SSOT 版本
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';

// 【修改點】：引入官方定義的標籤名稱與屬性名稱常數
import { PHIDIAS_TAG, PHIDIAS_ATTRS, PHIDIAS_EVENTS, configurePhidiasRequest } from '@pegaverse/phidias-sdk';
import type { PhidiasErrorDetail, PhidiasRequestConfig } from '@pegaverse/phidias-sdk';
import { usePhidiasStore } from '@/store/phidias-store';
import { ShadowPortalContext } from '@/lib/shadow-portal';
import { WorkspaceProvider } from '@/lib/workspace-context';

import { ConfigProvider, createConfigWebComponent } from './config';

// Derive the CDN base URL from this script's own location so that static
// assets (HDRI, textures, etc.) resolve correctly regardless of which host
// app loads the WC.  e.g. "http://cdn.example.com/phidias-static"
const WC_STATIC_BASE = (() => {
  try {
    return new URL('.', import.meta.url).href.replace(/\/$/, '');
  } catch {
    return '';
  }
})();
import type { AppConfig } from './config';

// ── Import Phidias app styles ─────────────────────────────────────────────────
import './app/globals.css';

// ── Import all page components ────────────────────────────────────────────────
import HomePage from './app/page';
import WorkspaceLayout from './app/workspace/layout';
import ImagePage from './app/workspace/image/page';
import ModelPage from './app/workspace/model/page';
import ScenePage from './app/workspace/_scene/page';
import SegmentPage from './app/workspace/segment/page';
import ErrorPage from './components/error';

// Lazy‑loaded pages
const TexturePage = React.lazy(() => import('./app/workspace/texture/page'));
const RetopoPage = React.lazy(() => import('./app/workspace/_retopo/page'));
const WorldPage = React.lazy(() => import('./app/workspace/_world/page'));
const PhysicsPage = React.lazy(() => import('./app/workspace/physics/page'));
const AgentPage = React.lazy(() => import('./app/agent/page'));

// ── Error Reporting Helper ────────────────────────────────────────────────────
function dispatchError(detail: Omit<PhidiasErrorDetail, 'timestamp'>) {
  const event = new CustomEvent(PHIDIAS_EVENTS.ERROR, {
    bubbles: true,
    composed: true,
    detail: {
      ...detail,
      timestamp: new Date().toISOString(),
    },
  });
  document.dispatchEvent(event);
}

// ── ErrorBoundary ──────────────────────────────────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    dispatchError({
      type: 'render',
      message: error.message,
      stack: error.stack || errorInfo.componentStack || undefined,
    });
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}

// ── WorkspaceLayoutRoute ──────────────────────────────────────────────────────
function WorkspaceLayoutRoute() {
  return (
    <WorkspaceLayout>
      <Outlet />
    </WorkspaceLayout>
  );
}

// ── PhidiasApp ────────────────────────────────────────────────────────────────
interface PhidiasAppProps {
  basePath?: string;
  /** Shadow DOM portal target. Null in Next.js Standalone mode. */
  portalTarget: HTMLElement | null;
}

function PhidiasApp({ basePath = '', portalTarget }: PhidiasAppProps) {
  return (
    <ShadowPortalContext.Provider value={portalTarget}>
      <BrowserRouter basename={basePath}>
        <React.Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                background: '#1a1a2e',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              Loading Phidias…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route element={<WorkspaceLayoutRoute />}>
              <Route path="workspace/model" element={<ModelPage />} />
              <Route path="workspace/image" element={<ImagePage />} />
              <Route path="workspace/segment" element={<SegmentPage />} />
              <Route path="workspace/texture" element={<TexturePage />} />
              <Route path="workspace/physics" element={<PhysicsPage />} />
            </Route>
            <Route path="agent" element={<AgentPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </ShadowPortalContext.Provider>
  );
}

// ── Custom Element ────────────────────────────────────────────────────────────
class PhidiasWebComponent extends HTMLElement {
  private _root: Root | null = null;
  private _portalTarget: HTMLElement | null = null;
  private _errorHandler: ((event: ErrorEvent) => void) | null = null;
  private _requestConfig: PhidiasRequestConfig | undefined = undefined;

  /**
   * DOM property setter for request infrastructure configuration.
   *
   * The SDK's PhidiasApp React component sets this property synchronously in
   * its ref callback (React's commit phase) after the element is inserted into
   * the DOM. Because configurePhidiasRequest is sealed after the first call,
   * subsequent React re-renders that trigger the setter are safely ignored.
   *
   * isConnected guard: if the property is set before connectedCallback fires
   * (unusual in React but theoretically possible), connectedCallback will pick
   * it up via _requestConfig. If set after (the normal case), apply immediately.
   */
  set requestConfig(config: PhidiasRequestConfig | undefined) {
    this._requestConfig = config;
    if (this.isConnected && config) {
      configurePhidiasRequest(config);
    }
  }

  // 【修改點】：監聽屬性改用 PHIDIAS_ATTRS 常數，確保與 Host App 同步
  static get observedAttributes() {
    return [
      PHIDIAS_ATTRS.BASE_PATH,
      PHIDIAS_ATTRS.API_BASE_URL,
      PHIDIAS_ATTRS.HOST_APP,
      PHIDIAS_ATTRS.USER
    ];
  }

  connectedCallback() {
    // Apply requestConfig if it was set as a DOM property before insertion.
    // In the normal React flow this will be undefined here (the ref callback
    // runs after connectedCallback), so the setter handles it instead.
    if (this._requestConfig) {
      configurePhidiasRequest(this._requestConfig);
    }
    this.style.display = 'contents';
    this._setupErrorHandler();
    this._mount();
  }

  disconnectedCallback() {
    this._removeErrorHandler();
    this._root?.unmount();
    this._root = null;
  }

  /**
   * Public reset — called by the SDK's resetPhidiasState() via
   * document.querySelector(PHIDIAS_TAG).reset().
   * Clears all user-specific Zustand state while preserving config values.
   */
  reset() {
    usePhidiasStore.getState().reset();
  }

  private _setupErrorHandler() {
    // 透過 Whitelist 模式，只攔截致命的部署、資源載入或環境缺失錯誤
    this._errorHandler = (event: ErrorEvent) => {
      const errorMsg = event.error?.message || event.message || '';

      const fatalErrorsWhitelist = [
        'process is not defined', // 環境/打包配置錯誤
        'Failed to fetch dynamically imported module', // Chunk 載入失敗 (e.g. NGINX 上沒有對應檔案)
        'ChunkLoadError', // Webpack/Vite chunk 取出失敗
        'Importing a module script failed' // 在某些瀏覽器中動態 import 失敗
      ];

      // 只要符合 whitelist 中的任何一個關鍵字，我們才攔截並回報給 Host
      if (fatalErrorsWhitelist.some(msg => errorMsg.includes(msg))) {
        dispatchError({
          type: 'runtime',
          message: errorMsg,
          stack: event.error?.stack,
          context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        });
        // 防止瀏覽器在 Console 再次印出紅字造成重複報錯
        event.preventDefault();
      }
    };
    window.addEventListener('error', this._errorHandler);
  }

  private _removeErrorHandler() {
    if (this._errorHandler) {
      window.removeEventListener('error', this._errorHandler);
      this._errorHandler = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (this._root && oldValue !== newValue) {
      this._render();
    }
  }

  private _mount() {
    const shadow = this.attachShadow({ mode: 'open' });

    // Inject bundled CSS into the shadow root so styles are fully encapsulated
    // and never leak into the host application's document.
    const css = (window as any).__PHIDIAS_CSS__ as string | undefined;
    if (css) {
      try {
        // Constructable Stylesheets: single shared CSSStyleSheet instance,
        // more efficient than cloning a <style> element per component instance.
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        shadow.adoptedStyleSheets = [sheet];
      } catch {
        // Fallback for browsers that do not support Constructable Stylesheets.
        const style = document.createElement('style');
        style.textContent = css;
        shadow.appendChild(style);
      }
    }

    // Portal target: Radix UI components (Dialog, DropdownMenu, Popover, …)
    // should render here via useShadowPortal() so they stay inside the shadow
    // boundary and can access :host CSS variables.
    // Also used as the download container for triggerDownload() to ensure
    // downloads work correctly inside the shadow DOM.
    this._portalTarget = document.createElement('div');
    this._portalTarget.setAttribute('data-shadow-portal', '');
    shadow.appendChild(this._portalTarget);

    const container = document.createElement('div');
    container.style.cssText =
      'display:flex;flex-direction:column;height:100%;width:100%;';
    shadow.appendChild(container);

    this._root = createRoot(container);
    this._render();
  }

  private _render() {
    if (!this._root) return;

    // 【修改點】：讀取屬性也改用 PHIDIAS_ATTRS
    const basePath = this.getAttribute(PHIDIAS_ATTRS.BASE_PATH) ?? '';
    // WC_STATIC_BASE is self-derived from import.meta.url — not a host-provided
    // attribute — so it is passed as a parameter rather than an HTML attribute.
    const config: AppConfig = createConfigWebComponent(this, WC_STATIC_BASE);

    this._root.render(
      <React.StrictMode>
        <ConfigProvider config={config}>
          <ErrorBoundary>
            <WorkspaceProvider>
              <PhidiasApp basePath={basePath} portalTarget={this._portalTarget} />
            </WorkspaceProvider>
          </ErrorBoundary>
        </ConfigProvider>
      </React.StrictMode>,
    );
  }
}

// 【修改點】：使用從 phidias-sdk 引入的 PHIDIAS_TAG
if (!customElements.get(PHIDIAS_TAG)) {
  customElements.define(PHIDIAS_TAG, PhidiasWebComponent);
}