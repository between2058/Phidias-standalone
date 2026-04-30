export type PhidiasMode = 'client' | 'server';

export interface AppConfig {
  apiBaseUrl: string;
  hostApp: string | null;
  basePath: string | null;
  user: string;
  mode: PhidiasMode;
}
