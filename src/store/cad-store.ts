import { create } from 'zustand';
import { temporal } from 'zundo';
import type { HierarchyItem } from '@/components/shared/HierarchyPanel';

// ─── State shape ─────────────────────────────────────────────────────────────

type CADState = {
    hierarchyItems: HierarchyItem[];
    setHierarchyItems: (items: HierarchyItem[] | ((prev: HierarchyItem[]) => HierarchyItem[])) => void;
};

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Zustand store with Zundo temporal middleware for CAD hierarchy.
 * ONLY `hierarchyItems[]` is snapshotted in history.
 * Limit: 50 undo snapshots.
 */
export const useCADStore = create(
    temporal<CADState>(
        (set) => ({
            hierarchyItems: [],
            setHierarchyItems: (itemsOrFn) =>
                set((s) => ({
                    hierarchyItems:
                        typeof itemsOrFn === 'function' ? itemsOrFn(s.hierarchyItems) : itemsOrFn,
                })),
        }),
        {
            partialize: (state) => ({ hierarchyItems: state.hierarchyItems }) as CADState,
            limit: 50,
        },
    ),
);
