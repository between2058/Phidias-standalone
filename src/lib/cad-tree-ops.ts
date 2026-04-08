/**
 * Pure tree manipulation functions for CAD hierarchy (HierarchyItem[]).
 * All functions are immutable — they return new arrays.
 */

import type { HierarchyItem } from '@/components/shared/HierarchyPanel';

// ─── Find helpers ─────────────────────────────────────────────────────────────

/** Find a node by id in the tree. */
export function findNode(tree: HierarchyItem[], id: string): HierarchyItem | null {
    for (const node of tree) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

/** Find the parent of a node by id. Returns [parent, indexInParent] or null. */
export function findParent(
    tree: HierarchyItem[],
    nodeId: string,
): { parent: HierarchyItem | null; index: number; root: true } | { parent: HierarchyItem; index: number; root: false } | null {
    // Check top-level
    for (let i = 0; i < tree.length; i++) {
        if (tree[i].id === nodeId) {
            return { parent: null, index: i, root: true };
        }
    }
    // Check children recursively
    for (const node of tree) {
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                if (node.children[i].id === nodeId) {
                    return { parent: node, index: i, root: false };
                }
            }
            const found = findParent(node.children, nodeId);
            if (found) return found;
        }
    }
    return null;
}

// ─── Remove helper ────────────────────────────────────────────────────────────

function removeNodeById(tree: HierarchyItem[], id: string): HierarchyItem[] {
    return tree
        .filter(n => n.id !== id)
        .map(n => n.children ? { ...n, children: removeNodeById(n.children, id) } : n);
}

function removeNodesByIds(tree: HierarchyItem[], ids: Set<string>): HierarchyItem[] {
    return tree
        .filter(n => !ids.has(n.id))
        .map(n => n.children ? { ...n, children: removeNodesByIds(n.children, ids) } : n);
}

// ─── Insert helper ────────────────────────────────────────────────────────────

function insertAtPath(
    tree: HierarchyItem[],
    targetParentId: string | null,
    node: HierarchyItem,
    insertIndex?: number,
): HierarchyItem[] {
    // Insert at root level
    if (targetParentId === null) {
        const idx = insertIndex ?? tree.length;
        const next = [...tree];
        next.splice(idx, 0, node);
        return next;
    }

    return tree.map(n => {
        if (n.id === targetParentId) {
            const children = [...(n.children || [])];
            const idx = insertIndex ?? children.length;
            children.splice(idx, 0, node);
            return { ...n, children };
        }
        if (n.children) {
            return { ...n, children: insertAtPath(n.children, targetParentId, node, insertIndex) };
        }
        return n;
    });
}

// ─── Move ─────────────────────────────────────────────────────────────────────

/**
 * Move a node to a new parent at the given index.
 * targetParentId=null means move to root level.
 */
export function moveNode(
    tree: HierarchyItem[],
    nodeId: string,
    targetParentId: string | null,
    insertIndex?: number,
): HierarchyItem[] {
    const node = findNode(tree, nodeId);
    if (!node) return tree;

    // Don't allow moving a node into itself or its descendants
    if (targetParentId) {
        const targetNode = findNode(tree, targetParentId);
        if (targetNode) {
            const isDescendant = (parent: HierarchyItem, childId: string): boolean => {
                if (parent.id === childId) return true;
                return (parent.children || []).some(c => isDescendant(c, childId));
            };
            if (isDescendant(node, targetParentId)) return tree;
        }
    }

    // Remove from old position, insert at new position
    const withoutNode = removeNodeById(tree, nodeId);
    return insertAtPath(withoutNode, targetParentId, node, insertIndex);
}

// ─── Group ────────────────────────────────────────────────────────────────────

let groupIdCounter = 0;

/**
 * Group multiple nodes into a new group node.
 * The group is inserted at the position of the first selected node.
 */
export function groupNodes(
    tree: HierarchyItem[],
    nodeIds: string[],
    groupName?: string,
): HierarchyItem[] {
    if (nodeIds.length === 0) return tree;

    const nodes = nodeIds.map(id => findNode(tree, id)).filter(Boolean) as HierarchyItem[];
    if (nodes.length === 0) return tree;

    // Find where to insert the group (position of first selected node)
    const firstInfo = findParent(tree, nodeIds[0]);

    const groupId = `cad-group-${++groupIdCounter}`;
    const group: HierarchyItem = {
        id: groupId,
        name: groupName || `Group ${groupIdCounter}`,
        type: 'group',
        visible: true,
        children: nodes,
    };

    // Remove all selected nodes
    const idsSet = new Set(nodeIds);
    const withoutNodes = removeNodesByIds(tree, idsSet);

    // Insert group at the first node's old position
    if (firstInfo?.root) {
        return insertAtPath(withoutNodes, null, group, firstInfo.index);
    } else if (firstInfo && !firstInfo.root) {
        return insertAtPath(withoutNodes, firstInfo.parent.id, group, firstInfo.index);
    }

    // Fallback: insert at root
    return [...withoutNodes, group];
}

// ─── Ungroup ──────────────────────────────────────────────────────────────────

/**
 * Ungroup a group node — replace it with its children at the same position.
 */
export function ungroupNode(tree: HierarchyItem[], groupId: string): HierarchyItem[] {
    const group = findNode(tree, groupId);
    if (!group || !group.children?.length) return tree;

    const info = findParent(tree, groupId);
    const children = group.children;

    // Remove the group
    const withoutGroup = removeNodeById(tree, groupId);

    // Insert children at the group's old position
    if (info?.root) {
        const result = [...withoutGroup];
        result.splice(info.index, 0, ...children);
        return result;
    } else if (info && !info.root) {
        let result = withoutGroup;
        for (let i = 0; i < children.length; i++) {
            result = insertAtPath(result, info.parent.id, children[i], info.index + i);
        }
        return result;
    }

    return [...withoutGroup, ...children];
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete multiple nodes by id.
 */
export function deleteNodes(tree: HierarchyItem[], nodeIds: string[]): HierarchyItem[] {
    return removeNodesByIds(tree, new Set(nodeIds));
}
