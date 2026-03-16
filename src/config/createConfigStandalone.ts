import type { AppConfig } from './types';
import { usePhidiasStore } from '../store/phidias-store';

export function createConfigStandalone(): AppConfig {
  const config = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
    hostApp: 'standalone',
    basePath: '',
    user: 'Phidias',
  };
  usePhidiasStore.setState({ apiBaseUrl: config.apiBaseUrl });
  usePhidiasStore.setState({ hostApp: config.hostApp });
  usePhidiasStore.setState({ basePath: config.basePath });
  usePhidiasStore.setState({ user: config.user });
  return config;
}
