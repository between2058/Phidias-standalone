/* eslint-disable */
/**
 * src/wc-entry.tsx
 *
 * Web Component entry point for Phidias.
 *
 * This file is the entry for the Vite library build (`vite.wc.config.ts`)
 * and produces `dist/phidias-wc.js`. It is NOT used by the Next.js build.
 *
 * Usage in portal:
 * <script type="module" src="/phidias/phidias-wc.js"></script>
 * <phidias-app base-path="/phidias"></phidias-app>
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Outlet,
} from 'react-router-dom';
import { ConfigProvider, createConfigWebComponent } from './config';
import type { AppConfig } from './config';
// 【修改點】：使用 BrowserRouter 替換 MemoryRouter

// ── Import Phidias app styles ─────────────────────────────────────────────────
import './app/globals.css';

// ── Import all page components ────────────────────────────────────────────────
import HomePage from './app/page';
import WorkspaceLayout from './app/workspace/layout';
import ImagePage from './app/workspace/image/page';
import ModelPage from './app/workspace/model/page';
import ScenePage from './app/workspace/_scene/page';
import SegmentPage from './app/workspace/segment/page';

// Lazy‑loaded pages
const TexturePage = React.lazy(() => import('./app/workspace/_texture/page'));
const RetopoPage = React.lazy(() => import('./app/workspace/_retopo/page'));
const WorldPage = React.lazy(() => import('./app/workspace/_world/page'));
const PhysicsPage = React.lazy(() => import('./app/workspace/_physics/page'));
const AgentPage = React.lazy(() => import('./app/agent/page'));

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
}

function PhidiasApp({ basePath = '' }: PhidiasAppProps) {
    return (
        // 【修改點】：BrowserRouter 會讀取 basePath 作為 basename
        // 這樣內部路由就會自動接在宿主的網址前綴之後
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
                    {/* Home / dashboard */}
                    <Route path="/" element={<HomePage />} />

                    {/* Workspace routes */}
                    <Route element={<WorkspaceLayoutRoute />}>
                        <Route path="workspace/model" element={<ModelPage />} />
                        <Route path="workspace/image" element={<ImagePage />} />
                        {/* <Route path="workspace/scene" element={<ScenePage />} /> */}
                        <Route path="workspace/segment" element={<SegmentPage />} />
                        {/* <Route path="workspace/texture" element={<TexturePage />} />
                        <Route path="workspace/retopo" element={<RetopoPage />} />
                        <Route path="workspace/world" element={<WorldPage />} />
                        <Route path="workspace/physics" element={<PhysicsPage />} /> */}
                    </Route>

                    {/* Agent canvas */}
                    <Route path="agent" element={<AgentPage />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </React.Suspense>
        </BrowserRouter>
    );
}

// ── Custom Element ────────────────────────────────────────────────────────────
class PhidiasWebComponent extends HTMLElement {
    private _root: Root | null = null;

    static get observedAttributes() {
        return ['base-path', 'api-base-url'];
    }

    connectedCallback() {
        this.style.display = 'contents';
        this._mount();
    }

    disconnectedCallback() {
        this._root?.unmount();
        this._root = null;
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        // 當 Portal 動態改變 base-path 時重新渲染
        if (this._root && oldValue !== newValue) {
            this._render();
        }
    }

    private _mount() {
        const container = document.createElement('div');
        container.style.cssText =
            'display:flex;flex-direction:column;height:100%;width:100%;';
        this.appendChild(container);
        this._root = createRoot(container);
        this._render();
    }

    private _render() {
        if (!this._root) return;
        const basePath = this.getAttribute('base-path') ?? '';
        const config: AppConfig = createConfigWebComponent(this);

        this._root.render(
            <React.StrictMode>
                <ConfigProvider config={config}>
                    <PhidiasApp basePath={basePath} />
                </ConfigProvider>
            </React.StrictMode>,
        );
    }
}

if (!customElements.get('phidias-app')) {
    customElements.define('phidias-app', PhidiasWebComponent);
}
