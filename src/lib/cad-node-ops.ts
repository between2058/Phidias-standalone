/**
 * Pure tree manipulation functions for CADNode hierarchy.
 * All functions are immutable — they return new objects.
 */

import type { CADNode } from '@/lib/occt-bridge';

let groupCounter = 0;

/** Deep clone a CADNode tree. */
function cloneNode(node: CADNode): CADNode {
    return {
        ...node,
        meshIndices: [...node.meshIndices],
        children: node.children.map(cloneNode),
    };
}

/** Find a node by id in the tree. */
export function findCadNode(node: CADNode, id: string): CADNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
        const found = findCadNode(child, id);
        if (found) return found;
    }
    return null;
}

/** Remove a node by id, returning the removed node. Mutates a clone. */
function removeNode(parent: CADNode, id: string): CADNode | null {
    for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].id === id) {
            return parent.children.splice(i, 1)[0];
        }
        const found = removeNode(parent.children[i], id);
        if (found) return found;
    }
    return null;
}

/** Create a new empty group under the root. */
export function cadNewGroup(root: CADNode, name = 'New Group'): CADNode {
    const newRoot = cloneNode(root);
    newRoot.children.push({
        id: `cad-group-${Date.now()}-${groupCounter++}`,
        name,
        meshIndices: [],
        children: [],
    });
    return newRoot;
}

/** Group selected nodes into a new group. */
export function cadGroupNodes(root: CADNode, nodeIds: string[], name = 'Group'): CADNode {
    if (nodeIds.length === 0) return root;
    const newRoot = cloneNode(root);
    const collected: CADNode[] = [];

    for (const id of nodeIds) {
        const removed = removeNode(newRoot, id);
        if (removed) collected.push(removed);
    }

    if (collected.length === 0) return root;

    const groupNode: CADNode = {
        id: `cad-group-${Date.now()}-${groupCounter++}`,
        name,
        meshIndices: [],
        children: collected,
    };
    newRoot.children.push(groupNode);
    return newRoot;
}

/** Ungroup a node — replace it with its children at the same position. */
export function cadUngroupNode(root: CADNode, nodeId: string): CADNode {
    const newRoot = cloneNode(root);

    function ungroupIn(parent: CADNode): boolean {
        for (let i = 0; i < parent.children.length; i++) {
            if (parent.children[i].id === nodeId) {
                const target = parent.children[i];
                parent.children.splice(i, 1, ...target.children);
                return true;
            }
            if (ungroupIn(parent.children[i])) return true;
        }
        return false;
    }

    ungroupIn(newRoot);
    return newRoot;
}

/** Delete nodes by ids. */
export function cadDeleteNodes(root: CADNode, nodeIds: string[]): CADNode {
    const newRoot = cloneNode(root);
    for (const id of nodeIds) {
        removeNode(newRoot, id);
    }
    return newRoot;
}

/** Rename a node. */
export function cadRenameNode(root: CADNode, nodeId: string, name: string): CADNode {
    const newRoot = cloneNode(root);
    const node = findCadNode(newRoot, nodeId);
    if (node) node.name = name;
    return newRoot;
}
