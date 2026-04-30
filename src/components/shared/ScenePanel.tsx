'use client';

/**
 * ScenePanel
 *
 * Standalone Scene Graph panel component.
 * Reads sceneGraph and segmentHierarchy from WorkspaceContext and renders:
 *   - HierarchyPanel (with multi-select support)
 *   - TransformPanel (when a scene graph with transform data is active)
 *
 * This component is intentionally decoupled from AssetsPanel so the two
 * can evolve independently. AssetsPanel hosts both as tabs.
 */

import { RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace-context';
import HierarchyPanel from '@/components/shared/HierarchyPanel';
import TransformPanel from '@/components/shared/TransformPanel';

export default function ScenePanel() {
  const { sceneGraph, segmentHierarchy } = useWorkspace();

  // Determine what to render
  const items = segmentHierarchy ?? sceneGraph?.items ?? [];
  const showSegmentBanner = !sceneGraph && !!segmentHierarchy;

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: '#141428' }}
    >
      {/* Banner: shown only when we are displaying persisted segment data */}
      {showSegmentBanner && (
        <div
          className="flex-shrink-0 px-3 py-1.5 text-[10px] border-b flex items-center gap-2"
          style={{
            background: '#1a1a2e',
            borderColor: '#1e1e36',
            color: '#64748b',
          }}
        >
          <RefreshCw size={9} />
          Showing last Segment edit
        </div>
      )}

      {/* Hierarchy tree */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <HierarchyPanel
          items={items}
          selectedId={sceneGraph?.selectedId ?? undefined}
          selectedIds={sceneGraph?.selectedIds ?? undefined}
          onSelect={sceneGraph?.onSelect}
          onMultiSelect={sceneGraph?.onMultiSelect}
          onVisibilityToggle={sceneGraph?.onVisibilityToggle}
          onRename={sceneGraph?.onRename}
        />
      </div>

      {/* Transform panel (bottom, only for model/viewport mode) */}
      {sceneGraph && (
        <div
          className="border-t flex-shrink-0"
          style={{ borderColor: '#1e1e36' }}
        >
          <TransformPanel
            transform={sceneGraph.transform ?? undefined}
            onChange={sceneGraph.onTransformChange}
          />
        </div>
      )}
    </div>
  );
}
