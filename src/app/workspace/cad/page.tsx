'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import type * as THREE from 'three';
import CADHierarchyTree from '@/components/cad/CADHierarchyTree';
import CADDiffPanel, { diffToSegmentColors } from '@/components/cad/CADDiffPanel';
import AutoCleanDialog from '@/components/cad/AutoCleanDialog';
import type { AutoCleanOptions } from '@/components/cad/AutoCleanDialog';
import ExportDropdown from '@/components/shared/ExportDropdown';
import type { TransformData } from '@/lib/api/types';
import type { RenderMode } from '@/components/shared/ThreeViewport';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';
import type { TransformValues } from '@/components/shared/TransformPanel';
import { findObjectInScene, writeTransformValues, transformDataToValues, updateNodeVisibility } from '@/lib/scene';
import { useWorkspace } from '@/lib/workspace-context';
import {
    importStepFile,
    cadResultToGlbUrl,
    detectDuplicates,
    expandHierarchy,
    disposeCADMeshBuffers,
} from '@/lib/occt-bridge';
import type {
    CADImportProgress,
    CADImportResult,
    DuplicateGroup,
} from '@/lib/occt-bridge';
import { cadImport, cadDedup } from '@/lib/api/phidias';
import { diffCADResults } from '@/lib/cad-diff';
import type { DiffResult } from '@/lib/cad-diff';
import { useCADStore } from '@/store/cad-store';
import { moveNode, groupNodes, ungroupNode, deleteNodes } from '@/lib/cad-tree-ops';
import { Sparkles, Undo2, Redo2, GitCompareArrows } from 'lucide-react';

const ThreeViewport = dynamic(() => import('@/components/shared/ThreeViewport'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
            <div className="text-center">
                <div
                    className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                    style={{ borderColor: '#f5a623', borderTopColor: 'transparent' }}
                />
                <p className="text-[#64748b] text-xs">Loading viewport...</p>
            </div>
        </div>
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_PALETTE = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#a855f7', '#14b8a6', '#eab308',
];

function flattenMeshes(items: HierarchyItem[]): HierarchyItem[] {
    const result: HierarchyItem[] = [];
    function walk(nodes: HierarchyItem[]) {
        for (const n of nodes) {
            if (n.type === 'mesh') result.push(n);
            if (n.children) walk(n.children);
        }
    }
    walk(items);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rename helpers — update name in both scene graph items and Three.js scene
// ─────────────────────────────────────────────────────────────────────────────

function renameInItems(items: HierarchyItem[], id: string, newName: string): HierarchyItem[] {
    return items.map(item => {
        if (item.id === id) return { ...item, name: newName };
        if (item.children) return { ...item, children: renameInItems(item.children, id, newName) };
        return item;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CADPage() {
    // ── Global asset state (React Context) ────────────────────────────────────
    const { assets, activeAssetId, addAsset, updateAsset, setActiveAssetId, setSceneGraph, updateAssetThumbnail } =
        useWorkspace();
    const activeAsset = assets.find(a => a.id === activeAssetId) ?? null;
    const modelUrl = activeAsset?.modelUrl ?? null;

    // ── CAD store (Zustand + Zundo for undo/redo) ─────────────────────────────
    const { hierarchyItems: _hierarchyItems, setHierarchyItems } = useCADStore();
    const { undo, redo, pastStates, futureStates } = useCADStore.temporal.getState();
    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    // ── Local page state ───────────────────────────────────────────────────────
    const sceneRef = useRef<THREE.Group | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [renderMode, _setRenderMode] = useState<RenderMode>('solid');
    const [transformMode, _setTransformMode] = useState<'translate' | 'rotate' | 'scale' | null>(null);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
    const [selectedTransform, setSelectedTransform] = useState<TransformValues | null>(null);
    const [sceneGraph, setLocalSceneGraph] = useState<HierarchyItem[]>([]);
    const [showGrid, _setShowGrid] = useState(true);
    const [colorViewMode, setColorViewMode] = useState<'original' | 'colored'>('original');

    // ── CAD-specific state ─────────────────────────────────────────────────────
    const [cadProgress, setCadProgress] = useState<CADImportProgress | null>(null);
    const [cadResult, setCadResult] = useState<CADImportResult | null>(null);
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [cadSelectedNodeId, setCadSelectedNodeId] = useState<string | null>(null);
    const [cadSelectedNodeIds, setCadSelectedNodeIds] = useState<string[]>([]);
    const [highlightedMeshIndices, setHighlightedMeshIndices] = useState<Set<number>>(new Set());

    // ── Diff state ─────────────────────────────────────────────────────────────
    const [diffMode, setDiffMode] = useState(false);
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null);

    // ── Auto clean state ───────────────────────────────────────────────────────
    const [showAutoClean, setShowAutoClean] = useState(false);

    // Auto-derive segment colors from scene graph meshes (or diff colors)
    const segmentColors = useMemo(() => {
        if (diffMode && diffResult) {
            return diffToSegmentColors(diffResult);
        }
        if (colorViewMode === 'original') return undefined;
        const meshes = flattenMeshes(sceneGraph);
        if (meshes.length <= 1) return undefined;
        const colors: Record<string, string> = {};
        meshes.forEach((m, i) => { colors[m.id] = SEGMENT_PALETTE[i % SEGMENT_PALETTE.length]; });
        return colors;
    }, [colorViewMode, sceneGraph, diffMode, diffResult]);

    const hasMultipleParts = useMemo(() => flattenMeshes(sceneGraph).length > 1, [sceneGraph]);

    // ── Undo/Redo keyboard shortcuts ──────────────────────────────────────────
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // ── Scene graph → workspace context (right panel) ──────────────────────────
    const handleObjectSelectForContext = useCallback((id: string | null) => {
        setSelectedObjectId(id);
        if (id) {
            setSelectedObjectIds([id]);
        } else {
            setSelectedObjectIds([]);
        }
        if (!id) setSelectedTransform(null);
    }, []);

    const handleObjectMultiSelectForContext = useCallback((id: string) => {
        setSelectedObjectIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
        setSelectedObjectId(id);
    }, []);

    const handleVisibilityToggleForContext = useCallback((id: string, visible: boolean) => {
        setLocalSceneGraph(prev => updateNodeVisibility(prev, id, visible));
        if (sceneRef.current) {
            const obj = findObjectInScene(sceneRef.current, id);
            if (obj) obj.visible = visible;
        }
    }, []);

    const handleTransformWriteForContext = useCallback(
        (t: TransformValues) => {
            setSelectedTransform(t);
            if (sceneRef.current && selectedObjectId) {
                const obj = findObjectInScene(sceneRef.current, selectedObjectId);
                if (obj) writeTransformValues(obj, t);
            }
        },
        [selectedObjectId]
    );

    // Rename handler — updates scene graph items and the Three.js object name
    const handleRename = useCallback((id: string, newName: string) => {
        setLocalSceneGraph(prev => renameInItems(prev, id, newName));
        if (sceneRef.current) {
            const obj = findObjectInScene(sceneRef.current, id);
            if (obj) obj.name = newName;
        }
    }, []);

    // Publish scene graph to workspace context so the right-side AssetsPanel can show it
    useEffect(() => {
        setSceneGraph({
            items: sceneGraph,
            selectedId: selectedObjectId,
            selectedIds: selectedObjectIds,
            transform: selectedTransform,
            onSelect: handleObjectSelectForContext,
            onMultiSelect: handleObjectMultiSelectForContext,
            onVisibilityToggle: handleVisibilityToggleForContext,
            onTransformChange: handleTransformWriteForContext,
            onRename: handleRename,
        });
    }, [sceneGraph, selectedObjectId, selectedObjectIds, selectedTransform,
        handleObjectSelectForContext, handleObjectMultiSelectForContext,
        handleVisibilityToggleForContext, handleTransformWriteForContext,
        handleRename, setSceneGraph]);

    // Clean up scene graph on unmount
    useEffect(() => () => setSceneGraph(null), [setSceneGraph]);

    // Reset viewport state when active asset changes
    useEffect(() => {
        setSelectedObjectId(null);
        setSelectedObjectIds([]);
        setSelectedTransform(null);
        setLocalSceneGraph([]);
        setColorViewMode('original');
        setDiffMode(false);
        setDiffResult(null);
        sceneRef.current = null;
    }, [activeAssetId]);

    // ── CAD File Import (hybrid: WASM ≤50MB, server >50MB) ─────────────────────
    const SERVER_IMPORT_THRESHOLD = 50 * 1024 * 1024; // 50MB

    const handleFileImport = useCallback(async (file: File) => {
        setIsLoading(true);
        setCadProgress({ stage: 'Reading file...', percent: 0 });
        setCadSelectedNodeId(null);
        setCadSelectedNodeIds([]);
        setHighlightedMeshIndices(new Set());
        setSessionId(null);

        try {
            const t0 = performance.now();
            let result: CADImportResult;

            if (file.size > SERVER_IMPORT_THRESHOLD) {
                // Large file → OCCT server backend
                setCadProgress({ stage: 'Uploading to server...', percent: 10 });
                const serverResult = await cadImport(file);
                setSessionId(serverResult.session_id);

                // Convert server response to CADImportResult format
                const rawResult = {
                    root: serverResult.root,
                    meshes: serverResult.meshes,
                } as unknown as CADImportResult;
                result = expandHierarchy(rawResult);
                setCadProgress({ stage: 'Processing...', percent: 70 });
            } else {
                // Small file → client-side WASM (fast)
                const rawResult = await importStepFile(file, setCadProgress);
                result = expandHierarchy(rawResult);
            }

            setCadResult(result);
            setDuplicates(detectDuplicates(result.meshes));

            setCadProgress({ stage: 'Converting to GLB...', percent: 90 });
            const glbUrl = await cadResultToGlbUrl(result);

            // Dispose raw mesh buffers after GLB conversion to free memory
            disposeCADMeshBuffers(result);

            const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
            console.log(`[CAD Import] ${file.name}: ${elapsed}s (${file.size > SERVER_IMPORT_THRESHOLD ? 'server' : 'wasm'})`);

            const assetId = addAsset({
                name: file.name.replace(/\.[^.]+$/, '') || 'CAD Import',
                modelUrl: glbUrl,
                type: 'untextured',
                status: 'ready',
                pipelineUsed: 'uploaded',
                fileSize: file.size,
            });
            setActiveAssetId(assetId);
        } catch (err: unknown) {
            console.error('CAD import failed:', err);
        } finally {
            setIsLoading(false);
            setCadProgress(null);
        }
    }, [addAsset, setActiveAssetId]);

    // Listen for file uploads from AssetsPanel (right side)
    useEffect(() => {
        const handler = (e: Event) => {
            const file = (e as CustomEvent<File>).detail;
            if (file) handleFileImport(file);
        };
        window.addEventListener('phidias:cad-file-upload', handler);
        return () => window.removeEventListener('phidias:cad-file-upload', handler);
    }, [handleFileImport]);

    // ── CAD hierarchy tree callbacks ───────────────────────────────────────────
    const handleCadNodeSelect = useCallback((nodeId: string, meshIndices: number[]) => {
        setCadSelectedNodeId(nodeId);
        setHighlightedMeshIndices(new Set(meshIndices));
        if (meshIndices.length === 1 && sceneRef.current) {
            let meshIdx = 0;
            sceneRef.current.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) {
                    if (meshIndices.includes(meshIdx)) {
                        handleObjectSelectForContext(obj.name || obj.uuid);
                    }
                    meshIdx++;
                }
            });
        }
    }, [handleObjectSelectForContext]);

    const handleCadNodeMultiSelect = useCallback((nodeId: string) => {
        setCadSelectedNodeIds(prev =>
            prev.includes(nodeId) ? prev.filter(x => x !== nodeId) : [...prev, nodeId]
        );
        setCadSelectedNodeId(nodeId);
    }, []);

    const handleCadNodeVisibilityToggle = useCallback((_nodeId: string, visible: boolean) => {
        if (sceneRef.current) {
            sceneRef.current.traverse((obj) => {
                if (obj.name && _nodeId.includes(obj.name)) {
                    obj.visible = visible;
                }
            });
        }
    }, []);

    const handleDeleteDuplicates = useCallback((group: DuplicateGroup) => {
        if (!sceneRef.current) return;
        const indicesToHide = group.meshIndices.slice(1);
        let meshIndex = 0;
        sceneRef.current.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
                if (indicesToHide.includes(meshIndex)) {
                    obj.visible = false;
                }
                meshIndex++;
            }
        });
        setDuplicates(prev => prev.filter(g => g.hash !== group.hash));
    }, []);

    // ── Manual grouping: DnD and context menu ─────────────────────────────────
    const handleMoveNode = useCallback((nodeId: string, targetParentId: string | null, insertIndex?: number) => {
        setHierarchyItems(prev => moveNode(prev, nodeId, targetParentId, insertIndex));
    }, [setHierarchyItems]);

    const handleContextAction = useCallback((action: 'new-group' | 'group-selected' | 'ungroup' | 'delete', nodeId: string) => {
        switch (action) {
            case 'new-group':
                setHierarchyItems(prev => groupNodes(prev, [], `New Group`));
                break;
            case 'group-selected': {
                const ids = cadSelectedNodeIds.length > 1 ? cadSelectedNodeIds : [nodeId];
                setHierarchyItems(prev => groupNodes(prev, ids));
                break;
            }
            case 'ungroup':
                setHierarchyItems(prev => ungroupNode(prev, nodeId));
                break;
            case 'delete': {
                const ids = cadSelectedNodeIds.length > 1 ? cadSelectedNodeIds : [nodeId];
                setHierarchyItems(prev => deleteNodes(prev, ids));
                break;
            }
        }
    }, [setHierarchyItems, cadSelectedNodeIds]);

    // ── Auto Clean Pipeline ───────────────────────────────────────────────────
    const handleAutoClean = useCallback((options: AutoCleanOptions) => {
        if (options.removeDuplicates && sceneRef.current) {
            // Hide all duplicate meshes (keep one per group)
            for (const group of duplicates) {
                const indicesToHide = group.meshIndices.slice(1);
                let meshIndex = 0;
                sceneRef.current.traverse((obj) => {
                    if ((obj as THREE.Mesh).isMesh) {
                        if (indicesToHide.includes(meshIndex)) {
                            obj.visible = false;
                        }
                        meshIndex++;
                    }
                });
            }
            setDuplicates([]);
        }
    }, [duplicates]);

    // ── STP Diff ──────────────────────────────────────────────────────────────
    const handleCompareWith = useCallback(async () => {
        if (!cadResult) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.stp,.step,.igs,.iges,.brep,.brp';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                setCadProgress({ stage: 'Importing comparison file...', percent: 0 });
                setIsLoading(true);
                const rawResultB = await importStepFile(file, setCadProgress);
                const resultB = expandHierarchy(rawResultB);

                const diff = diffCADResults(
                    cadResult.root,
                    cadResult.meshes,
                    resultB.root,
                    resultB.meshes,
                );

                setDiffResult(diff);
                setDiffMode(true);

                // Dispose the comparison file's buffers
                disposeCADMeshBuffers(resultB);
            } catch (err) {
                console.error('Diff import failed:', err);
            } finally {
                setIsLoading(false);
                setCadProgress(null);
            }
        };
        input.click();
    }, [cadResult]);

    // ── Viewport callbacks ─────────────────────────────────────────────────────
    const handleSceneReady = useCallback((group: THREE.Group) => { sceneRef.current = group; }, []);
    const handleSceneGraphChange = useCallback((nodes: HierarchyItem[]) => setLocalSceneGraph(nodes), []);
    const handleObjectSelect = useCallback((id: string | null) => {
        setSelectedObjectId(id);
        if (id) setSelectedObjectIds([id]); else setSelectedObjectIds([]);
        if (!id) setSelectedTransform(null);
    }, []);
    const handleObjectMultiSelect = useCallback((id: string) => {
        setSelectedObjectIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
        setSelectedObjectId(id);
    }, []);
    const handleTransformChange = useCallback((t: TransformData) => setSelectedTransform(transformDataToValues(t)), []);
    const handleThumbnailReady = useCallback(
        (dataUrl: string) => { if (activeAssetId) updateAssetThumbnail(activeAssetId, dataUrl); },
        [activeAssetId, updateAssetThumbnail]
    );
    const handleHasSkinnedMesh = useCallback(
        (value: boolean) => { if (activeAssetId) updateAsset(activeAssetId, { hasSkinnedMesh: value }); },
        [activeAssetId, updateAsset]
    );

    // ── Computed values ────────────────────────────────────────────────────────
    const totalDuplicates = duplicates.reduce((sum, g) => sum + g.count - 1, 0);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full overflow-hidden" style={{ background: '#1a1a2e' }}>
            {/* Left panel — CAD Hierarchy + Duplicates OR Diff panel */}
            {(cadResult || diffMode) && (
                <aside
                    className="w-[260px] flex-shrink-0 overflow-hidden flex flex-col border-r"
                    style={{ background: '#1e1e36', borderColor: '#333355' }}
                >
                    {/* Progress bar during import */}
                    {isLoading && cadProgress && (
                        <div className="px-3 py-2 border-b border-[#333355]">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-[#94a3b8]">{cadProgress.stage}</span>
                                <span className="text-[10px] text-[#D5B451] font-mono">{cadProgress.percent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#1a1a2e] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${cadProgress.percent}%`,
                                        background: 'linear-gradient(90deg, #D5B451, #f5a623)',
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {diffMode && diffResult ? (
                        <CADDiffPanel
                            diff={diffResult}
                            onClose={() => { setDiffMode(false); setDiffResult(null); }}
                        />
                    ) : cadResult ? (
                        <CADHierarchyTree
                            root={cadResult.root}
                            duplicates={duplicates}
                            selectedNodeId={cadSelectedNodeId}
                            selectedNodeIds={cadSelectedNodeIds}
                            highlightedMeshIndices={highlightedMeshIndices}
                            onNodeSelect={handleCadNodeSelect}
                            onNodeMultiSelect={handleCadNodeMultiSelect}
                            onNodeVisibilityToggle={handleCadNodeVisibilityToggle}
                            onDeleteDuplicates={handleDeleteDuplicates}
                            onMoveNode={handleMoveNode}
                            onContextAction={handleContextAction}
                        />
                    ) : null}
                </aside>
            )}

            {/* Viewport */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 relative">
                    {(modelUrl || isLoading) ? (
                        <Suspense fallback={null}>
                            <ThreeViewport
                                modelUrl={modelUrl ?? undefined}
                                showGrid={showGrid}
                                renderMode={renderMode}
                                transformMode={transformMode}
                                selectedObjectId={selectedObjectId}
                                selectedObjectIds={selectedObjectIds}
                                onObjectSelect={handleObjectSelect}
                                onObjectMultiSelect={handleObjectMultiSelect}
                                onTransformChange={handleTransformChange}
                                onSceneReady={handleSceneReady}
                                onSceneGraphChange={handleSceneGraphChange}
                                showStats={!!modelUrl}
                                isGenerating={isLoading}
                                generatingLabel="Importing CAD"
                                onThumbnailReady={handleThumbnailReady}
                                onHasSkinnedMesh={handleHasSkinnedMesh}
                                segmentColors={segmentColors}
                                colorViewMode={hasMultipleParts ? colorViewMode : undefined}
                                onColorViewModeChange={hasMultipleParts ? setColorViewMode : undefined}
                                className="w-full h-full"
                            />
                        </Suspense>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: '#1a1a2e' }}>
                            <div className="text-6xl mb-4 opacity-20">&#9881;</div>
                            <p className="text-[#64748b] text-sm">CAD model will appear here</p>
                            <p className="text-[#4b5563] text-xs mt-1">Upload a .STP / .STEP file from the Assets panel on the right</p>
                        </div>
                    )}
                </div>

                {/* Bottom toolbar */}
                <div
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full z-10"
                    style={{ background: 'rgba(13,13,24,0.95)', border: '1px solid #333355' }}
                >
                    {/* Undo/Redo */}
                    <button
                        onClick={() => undo()}
                        disabled={!canUndo}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#ffffff08] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={14} />
                    </button>
                    <button
                        onClick={() => redo()}
                        disabled={!canRedo}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#ffffff08] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo2 size={14} />
                    </button>

                    <div className="w-px h-5 bg-[#333355]" />

                    {/* Auto Clean */}
                    {cadResult && (
                        <button
                            onClick={() => setShowAutoClean(true)}
                            className="p-1.5 rounded-lg text-[#D5B451] hover:bg-[#D5B451]/10"
                            title="Auto Clean"
                        >
                            <Sparkles size={14} />
                        </button>
                    )}

                    {/* Compare / Diff */}
                    {cadResult && !diffMode && (
                        <button
                            onClick={handleCompareWith}
                            className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#ffffff08]"
                            title="Compare with..."
                        >
                            <GitCompareArrows size={14} />
                        </button>
                    )}

                    <div className="w-px h-5 bg-[#333355]" />

                    <ExportDropdown sceneRef={sceneRef} />
                </div>
            </main>

            {/* Auto Clean Dialog */}
            {showAutoClean && (
                <AutoCleanDialog
                    duplicateCount={totalDuplicates}
                    duplicateGroupCount={duplicates.length}
                    onRun={handleAutoClean}
                    onClose={() => setShowAutoClean(false)}
                />
            )}
        </div>
    );
}
