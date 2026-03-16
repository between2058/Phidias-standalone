import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Part } from '@/app/workspace/segment/page';

// ─── State shape ─────────────────────────────────────────────────────────────

type SegmentState = {
  parts: Part[];
  setParts: (parts: Part[] | ((prev: Part[]) => Part[])) => void;
};

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Zustand store with Zundo temporal middleware.
 * ONLY `parts[]` is snapshotted in history.
 * Setter functions are excluded from history via the partialize cast.
 *
 * Transform history is kept in a local imperative stack in segment/page.tsx
 * to avoid Zundo/React state reconciliation conflict with Three.js imperative mutations.
 */
export const useSegmentStore = create(
  temporal<SegmentState>(
    (set) => ({
      parts: [],
      setParts: (partsOrFn) =>
        set((s) => ({
          parts:
            typeof partsOrFn === 'function' ? partsOrFn(s.parts) : partsOrFn,
        })),
    }),
    {
      // Cast required: Zundo forces partialize to return full TState.
      // In practice only the returned subset is used for diffing — safe.
      partialize: (state) => ({ parts: state.parts }) as SegmentState,
      limit: 50,
    },
  ),
);
