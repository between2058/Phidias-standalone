import { create } from 'zustand';

interface PhidiasState {
  /** URL string of the image currently being previewed in the overlay, or null if no overlay is shown */
  previewImage: string | null;
  setPreviewImage: (url: string | null) => void;
  /** URL of an image that was sent from another panel (e.g. Image Workspace) to be loaded into the Model Workspace */
  pendingModelImage: string | null;
  setPendingModelImage: (url: string | null) => void;
  /** URLs of images sent from Image Workspace for multi-view generation */
  pendingMultiViewImages: string[] | null;
  setPendingMultiViewImages: (urls: string[] | null) => void;
  /** Auth tokens */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  refreshToken: string | null;
  setRefreshToken: (token: string | null) => void;
  /** Configuration */
  apiBaseUrl: string | null;
  setApiBaseUrl: (url: string | null) => void;
  hostApp: string | null;
  setHostApp: (hostApp: string | null) => void;
  basePath: string | null;
  setBasePath: (basePath: string | null) => void;
  user: string | null;
  setUser: (user: string) => void;
}

export const usePhidiasStore = create<PhidiasState>((set) => ({
  previewImage: null,
  setPreviewImage: (url) => set({ previewImage: url }),
  pendingModelImage: null,
  setPendingModelImage: (url) => set({ pendingModelImage: url }),
  pendingMultiViewImages: null,
  setPendingMultiViewImages: (urls) => set({ pendingMultiViewImages: urls }),
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  refreshToken: null,
  setRefreshToken: (token) => set({ refreshToken: token }),
  apiBaseUrl: null,
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  hostApp: null,
  setHostApp: (hostApp) => set({ hostApp }),
  basePath: null,
  setBasePath: (basePath) => set({ basePath }),
  user: null,
  setUser: (user) => set({ user }),
}));
