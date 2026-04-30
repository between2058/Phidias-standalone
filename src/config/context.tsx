'use client';

import React, { createContext, useContext } from 'react';
import { usePhidiasStore } from '@/store/phidias-store';
import type { AppConfig } from './types';

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({
  config,
  children,
}: {
  config: AppConfig;
  children: React.ReactNode;
}) {
  // WHY: Sync config into the Zustand store here, on the client.
  //
  // In Standalone mode, createConfigStandalone() is called inside layout.tsx,
  // which is a Next.js Server Component. Server Components execute on the server,
  // so any usePhidiasStore.setState() calls inside createConfigStandalone() only
  // affect the server-side store instance — they are discarded and never reach the
  // client-side Zustand store.
  //
  // ConfigProvider carries the 'use client' directive, so it executes during
  // client-side hydration. By calling setState() here synchronously (before
  // children render), we guarantee the store is populated before any child
  // component reads from it, avoiding a null-flash on first render.
  //
  // In WC mode, createConfigWebComponent() is called inside connectedCallback
  // in wc-entry.tsx, which is purely client-side, so that path is unaffected.
  //
  // Note: Token management is handled by the host app via requestConfig prop.
  // Phidias is host-app-agnostic and does not assume any specific token mechanism.
  usePhidiasStore.setState({
    apiBaseUrl: config.apiBaseUrl,
    hostApp: config.hostApp,
    basePath: config.basePath,
    user: config.user,
  });

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): AppConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('ConfigProvider is missing');
  }
  return ctx;
}
