'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import HierarchyPanel from '@/components/shared/HierarchyPanel';
import TransformPanel from '@/components/shared/TransformPanel';
import type { HierarchyItem, AnnotationPin } from '@/lib/api/types';
import AnnotationSystem from './AnnotationSystem';

interface PlacedObject {
  id: string;
  name: string;
  assetId: string;
}

interface WorldHierarchyPanelProps {
  placedObjects: PlacedObject[];
  selectedId: string | null;
  onSelectObject: (id: string | null) => void;
  annotations: AnnotationPin[];
  onDeleteAnnotation: (id: string) => void;
  onUpdateAnnotation: (id: string, updates: Partial<AnnotationPin>) => void;
  onPlayTour: () => void;
}

export default function WorldHierarchyPanel({
  placedObjects,
  selectedId,
  onSelectObject,
  annotations,
  onDeleteAnnotation,
  onUpdateAnnotation,
  onPlayTour,
}: WorldHierarchyPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'hierarchy' | 'properties' | 'annotations' | 'history'
  >('hierarchy');

  const hierarchyItems: HierarchyItem[] = [
    {
      id: 'world-root',
      name: 'World Root',
      visible: true,
      children: placedObjects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        visible: true,
      })),
    },
  ];

  const selectedObject = placedObjects.find((o) => o.id === selectedId);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex flex-wrap border-b border-[#333355]">
        {[
          { id: 'hierarchy', label: 'Hierarchy' },
          { id: 'properties', label: 'Properties' },
          { id: 'annotations', label: '📌' },
          { id: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'py-2.5 px-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'text-white border-b-2 border-[#7c3aed]'
                : 'text-[#64748b] hover:text-[#94a3b8]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'hierarchy' && (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <HierarchyPanel
                items={hierarchyItems}
                selectedId={selectedId ?? undefined}
                onSelect={(id) => onSelectObject(id)}
              />
            </div>
            <div className="border-t border-[#333355]">
              <TransformPanel />
            </div>
          </>
        )}

        {activeTab === 'properties' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
            {selectedObject ? (
              <>
                <div className="p-3 rounded-xl bg-[#252542] border border-[#333355]">
                  <p className="text-xs font-semibold text-white mb-2">
                    {selectedObject.name}
                  </p>
                  <div className="space-y-1 text-xs text-[#94a3b8]">
                    <div className="flex justify-between">
                      <span>Asset ID</span>
                      <span className="text-white font-mono">
                        {selectedObject.assetId}
                      </span>
                    </div>
                  </div>
                </div>
                <button className="w-full py-2 rounded-lg text-xs text-[#94a3b8] border border-[#333355] hover:border-[#22c55e] hover:text-[#22c55e] transition-colors">
                  Snap to Ground
                </button>
                <button className="w-full py-2 rounded-lg text-xs text-[#94a3b8] border border-[#333355] hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors">
                  Physics Settings →
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-[#64748b]">
                  Select an object in the viewport
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'annotations' && (
          <AnnotationSystem
            pins={annotations}
            onAddPin={() => {}}
            onDeletePin={onDeleteAnnotation}
            onUpdatePin={onUpdateAnnotation}
            onPlayTour={onPlayTour}
          />
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {['Placed Car Parts', 'Placed Benz Scan', 'World initialized'].map(
              (action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-1.5 border-b border-[#333355]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span className="text-xs text-[#94a3b8] flex-1">
                    {action}
                  </span>
                  <span className="text-[10px] text-[#64748b]">
                    {i === 0 ? 'Just now' : `${i * 3}m ago`}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
