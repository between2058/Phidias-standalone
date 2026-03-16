'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';
import type { TransformValues } from '@/components/shared/TransformPanel';

// ─── Asset ──────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  thumbnail?: string;
  modelUrl: string;
  type: 'textured' | 'untextured' | 'rigged' | 'splat';
  isFavorite: boolean;
  createdAt: Date;
  faces?: number;
  vertices?: number;
  // Status & pipeline metadata
  status?: 'ready' | 'generating' | 'failed' | 'queued';
  progress?: number; // 0-100 for 'generating' state
  fileSize?: number; // bytes
  pipelineUsed?: 'trellis' | 'sam3d' | 'segment' | 'uploaded' | 'unknown';
  generationParams?: Record<string, unknown>;
  errorMessage?: string;
  /** True when the GLB contains at least one SkinnedMesh bound to a Skeleton */
  hasSkinnedMesh?: boolean;
}

// ─── Camera ──────────────────────────────────────────────────────────────────

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

// ─── Scene Graph slot (published by model/page.tsx) ──────────────────────────

export interface SceneGraphSlot {
  items: HierarchyItem[];
  selectedId: string | null;
  /** All currently selected object ids (for multi-select). Includes selectedId. */
  selectedIds: string[];
  transform: TransformValues | null;
  onSelect: (id: string | null) => void;
  /** Toggle id in/out of the multi-selection set */
  onMultiSelect: (id: string) => void;
  onVisibilityToggle: (id: string, visible: boolean) => void;
  onTransformChange: (t: TransformValues) => void;
}

// ─── Context value ────────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  // Assets
  assets: Asset[];
  activeAssetId: string | null;
  addAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'isFavorite'>) => string;
  removeAssets: (ids: string[]) => void;
  toggleFavorite: (id: string) => void;
  setActiveAssetId: (id: string | null) => void;
  updateAssetThumbnail: (id: string, thumbnail: string) => void;
  updateAsset: (id: string, updates: Partial<Omit<Asset, 'id'>>) => void;

  // Camera
  cameraState: CameraState | null;
  setCameraState: (state: CameraState) => void;

  // Scene graph slot — set by whichever page has scene data (cleared on unmount)
  sceneGraph: SceneGraphSlot | null;
  setSceneGraph: (slot: SceneGraphSlot | null) => void;

  // Segment hierarchy — persists across tab switches so renames/groups/merges
  // remain visible in the Scene Graph panel even after leaving the Segment tab
  segmentHierarchy: HierarchyItem[] | null;
  setSegmentHierarchy: (items: HierarchyItem[] | null) => void;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState | null>(null);
  const [sceneGraph, setSceneGraph] = useState<SceneGraphSlot | null>(null);
  const [segmentHierarchy, setSegmentHierarchy] = useState<
    HierarchyItem[] | null
  >(null);

  const addAsset = useCallback(
    (assetData: Omit<Asset, 'id' | 'createdAt' | 'isFavorite'>): string => {
      const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setAssets((prev) => [
        { ...assetData, id, isFavorite: false, createdAt: new Date() },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const removeAssets = useCallback((ids: string[]) => {
    setAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
    setActiveAssetId((prev) => (prev && ids.includes(prev) ? null : prev));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isFavorite: !a.isFavorite } : a)),
    );
  }, []);

  const updateAssetThumbnail = useCallback((id: string, thumbnail: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, thumbnail } : a)),
    );
  }, []);

  const updateAsset = useCallback(
    (id: string, updates: Partial<Omit<Asset, 'id'>>) => {
      setAssets((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      );
    },
    [],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        assets,
        activeAssetId,
        addAsset,
        removeAssets,
        toggleFavorite,
        setActiveAssetId,
        updateAssetThumbnail,
        updateAsset,
        cameraState,
        setCameraState,
        sceneGraph,
        setSceneGraph,
        segmentHierarchy,
        setSegmentHierarchy,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
