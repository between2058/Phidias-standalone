"""Mesh fingerprint and duplicate detection."""

from __future__ import annotations
from collections import defaultdict


def mesh_fingerprint(mesh: dict) -> str:
    """Compute a fingerprint from vertex count, index count, and sorted bbox dimensions."""
    positions = mesh["positions"]
    indices = mesh["indices"]
    v_count = len(positions) // 3
    i_count = len(indices)

    if v_count == 0:
        return f"0:{i_count}:0.0000:0.0000:0.0000"

    xs = positions[0::3]
    ys = positions[1::3]
    zs = positions[2::3]
    dx = max(xs) - min(xs)
    dy = max(ys) - min(ys)
    dz = max(zs) - min(zs)
    # Sort dimensions so orientation doesn't matter
    dims = sorted([dx, dy, dz])
    return f"{v_count}:{i_count}:{dims[0]:.4f}:{dims[1]:.4f}:{dims[2]:.4f}"


def find_duplicates(meshes: list[dict]) -> dict:
    """Group meshes by fingerprint, return groups with count > 1."""
    hash_map: dict[str, list[int]] = defaultdict(list)
    for mesh in meshes:
        h = mesh_fingerprint(mesh)
        hash_map[h].append(mesh["index"])

    groups = []
    duplicate_count = 0
    for h, indices in hash_map.items():
        if len(indices) > 1:
            name = meshes[indices[0]].get("name", f"Part {indices[0]}")
            groups.append({
                "hash": h,
                "name": name,
                "mesh_indices": indices,
                "count": len(indices),
            })
            duplicate_count += len(indices) - 1  # all except one are duplicates

    return {
        "groups": groups,
        "total_parts": len(meshes),
        "unique_parts": len(meshes) - duplicate_count,
        "duplicate_parts": duplicate_count,
    }
