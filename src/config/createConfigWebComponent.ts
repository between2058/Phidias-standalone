import { PHIDIAS_ATTRS } from '@pegaverse/phidias-sdk';
import type { AppConfig } from './types';
import { usePhidiasStore } from '../store/phidias-store';

/**
 * @param element   The custom element instance whose HTML attributes are the source of config.
 * @param staticBase  CDN base URL for static assets (HDRI, textures, etc.).
 *                    Derived from import.meta.url by the WC entry — NOT a host-provided
 *                    attribute, so it is not part of AppConfig / SDK attributes.
 */
export function createConfigWebComponent(element: HTMLElement, staticBase: string): AppConfig {
  const config = {
    apiBaseUrl: element.getAttribute(PHIDIAS_ATTRS.API_BASE_URL) ?? '',
    hostApp: element.getAttribute(PHIDIAS_ATTRS.HOST_APP) ?? null,
    basePath: element.getAttribute(PHIDIAS_ATTRS.BASE_PATH) ?? null,
    user: element.getAttribute(PHIDIAS_ATTRS.USER) ?? 'Phidias',
    mode: 'client' as const,
  };
  usePhidiasStore.setState({
    apiBaseUrl: config.apiBaseUrl,
    hostApp: config.hostApp,
    basePath: config.basePath,
    user: config.user,
    staticBase,
  });
  return config;
}
