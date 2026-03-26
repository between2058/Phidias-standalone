/**
 * STP Diff — compare two CAD import results by hierarchy + geometry hash.
 */

import type { CADNode, CADMesh } from '@/lib/occt-bridge';
import { hashMesh } from '@/lib/occt-bridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffEntry {
    name: string;
    status: DiffStatus;
    meshIndicesA?: number[];
    meshIndicesB?: number[];
}

export interface DiffResult {
    entries: DiffEntry[];
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
}

// ─── Flatten hierarchy into name-indexed map ──────────────────────────────────

interface FlatNode {
    name: string;
    meshIndices: number[];
    hashes: string[];
}

function flattenHierarchy(
    node: CADNode,
    meshes: CADMesh[],
    nameCount: Map<string, number>,
): FlatNode[] {
    const result: FlatNode[] = [];

    const baseName = node.name || 'Unnamed';
    const count = nameCount.get(baseName) || 0;
    nameCount.set(baseName, count + 1);
    const uniqueName = count > 0 ? `${baseName} (${count})` : baseName;

    const hashes = node.meshIndices
        .map(idx => meshes[idx])
        .filter(Boolean)
        .map(m => hashMesh(m));

    if (node.meshIndices.length > 0 || node.children.length === 0) {
        result.push({
            name: uniqueName,
            meshIndices: node.meshIndices,
            hashes,
        });
    }

    for (const child of node.children) {
        result.push(...flattenHierarchy(child, meshes, nameCount));
    }

    return result;
}

// ─── Diff Algorithm ───────────────────────────────────────────────────────────

export function diffCADResults(
    rootA: CADNode,
    meshesA: CADMesh[],
    rootB: CADNode,
    meshesB: CADMesh[],
): DiffResult {
    const flatA = flattenHierarchy(rootA, meshesA, new Map());
    const flatB = flattenHierarchy(rootB, meshesB, new Map());

    const mapA = new Map<string, FlatNode>();
    for (const node of flatA) mapA.set(node.name, node);

    const mapB = new Map<string, FlatNode>();
    for (const node of flatB) mapB.set(node.name, node);

    const entries: DiffEntry[] = [];
    let added = 0, removed = 0, modified = 0, unchanged = 0;

    // Check items in A
    mapA.forEach((nodeA, name) => {
        const nodeB = mapB.get(name);
        if (!nodeB) {
            entries.push({ name, status: 'removed', meshIndicesA: nodeA.meshIndices });
            removed++;
        } else {
            const hashA = nodeA.hashes.sort().join('|');
            const hashB = nodeB.hashes.sort().join('|');
            if (hashA === hashB) {
                entries.push({ name, status: 'unchanged', meshIndicesA: nodeA.meshIndices, meshIndicesB: nodeB.meshIndices });
                unchanged++;
            } else {
                entries.push({ name, status: 'modified', meshIndicesA: nodeA.meshIndices, meshIndicesB: nodeB.meshIndices });
                modified++;
            }
        }
    });

    // Items only in B (added)
    mapB.forEach((nodeB, name) => {
        if (!mapA.has(name)) {
            entries.push({ name, status: 'added', meshIndicesB: nodeB.meshIndices });
            added++;
        }
    });

    // Sort: removed, modified, added, unchanged
    const statusOrder: Record<DiffStatus, number> = { removed: 0, modified: 1, added: 2, unchanged: 3 };
    entries.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return { entries, added, removed, modified, unchanged };
}
