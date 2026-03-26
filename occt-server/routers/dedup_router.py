"""POST /dedup — find duplicate parts by mesh fingerprint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.session import session_manager
from core.dedup import find_duplicates
from core.tessellator import tessellate_all


class DedupRequest(BaseModel):
    session_id: str


router = APIRouter()


@router.post("/dedup")
async def dedup(req: DedupRequest):
    """Find duplicate parts in the session's model using mesh fingerprints."""
    session = session_manager.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Re-tessellate to get mesh data (positions, indices) for fingerprinting
    _, mesh_labels = _build_hierarchy_from_session(session)
    meshes = tessellate_all(mesh_labels, session.doc)

    return find_duplicates(meshes)


def _build_hierarchy_from_session(session):
    """Rebuild hierarchy from session's XDE document."""
    from core.xde_document import build_hierarchy
    return build_hierarchy(session.doc, session.label_map)
