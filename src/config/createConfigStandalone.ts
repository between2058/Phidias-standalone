import type { AppConfig, PhidiasMode } from './types';
import { usePhidiasStore } from '../store/phidias-store';

export function createConfigStandalone(): AppConfig {
  const mode = (process.env.NEXT_PUBLIC_PHIDIAS_MODE as PhidiasMode) || 'client';

  const config = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
    hostApp: 'standalone',
    basePath: '',
    user: 'Phidias',
    mode,
  };
  usePhidiasStore.setState({ apiBaseUrl: config.apiBaseUrl });
  usePhidiasStore.setState({ hostApp: config.hostApp });
  usePhidiasStore.setState({ basePath: config.basePath });
  usePhidiasStore.setState({ user: config.user });
  usePhidiasStore.setState({ mode: config.mode });
  // staticBase is null in standalone: Next.js serves public/ assets at root,
  // so getAssetUrl() returns plain relative paths (e.g. "/hdri/foo.hdr").
  // In WC mode, wc-entry.tsx derives staticBase from import.meta.url instead.
  usePhidiasStore.setState({ staticBase: null });
  return config;
}
