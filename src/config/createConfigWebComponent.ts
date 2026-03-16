import type { AppConfig } from './types';
import { usePhidiasStore } from '../store/phidias-store';

export function createConfigWebComponent(element: HTMLElement): AppConfig {
  const config = {
    apiBaseUrl: element.getAttribute('api-base-url') ?? '',
    hostApp: element.getAttribute('host-app') ?? null,
    basePath: element.getAttribute('base-path') ?? null,
    user: element.getAttribute('user') ?? 'Phidias',
  };
  usePhidiasStore.setState({ apiBaseUrl: config.apiBaseUrl });
  usePhidiasStore.setState({ hostApp: config.hostApp });
  usePhidiasStore.setState({ basePath: config.basePath });
  usePhidiasStore.setState({ user: config.user });
  return config;
}
