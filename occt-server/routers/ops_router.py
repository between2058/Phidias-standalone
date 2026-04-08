"""POST /ops — apply batch tree operations to stored B-Rep."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.schemas import OpsRequest
from core.session import session_manager
from core.tree_ops import apply_operations
from core.xde_document import build_hierarchy
from core.tessellator import tessellate_all

router = APIRouter()


@router.post("/ops")
async def apply_ops(req: OpsRequest):
    """
    Apply a batch of operations (rename, delete, group, ungroup, move)
    to the stored XDE document, then return updated hierarchy + meshes.
    """
    try:
        session = session_manager.get(req.session_id)
    except KeyError:
        raise HTTPException(404, f"Session {req.session_id!r} not found")

    # Convert pydantic models to dicts for apply_operations
    ops = [op.model_dump() for op in req.operations]

    try:
        apply_operations(session.doc, session.label_map, ops)
    except (KeyError, ValueError) as e:
        raise HTTPException(422, str(e))

    # Rebuild hierarchy and re-tessellate
    root, mesh_labels = build_hierarchy(session.doc, session.label_map)
    meshes = tessellate_all(mesh_labels, session.doc)

    return {
        "root": root,
        "meshes": meshes,
    }
