"""GET /export/stp — serialize current B-Rep state to STEP file."""

from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response

from core.session import session_manager
from core.step_writer import export_step

router = APIRouter()


@router.get("/export/stp")
async def export_stp(session_id: str = Query(...)):
    """
    Export the current XDE document state as a STEP AP214 file.
    Preserves names, colors, and hierarchy.
    """
    try:
        session = session_manager.get(session_id)
    except KeyError:
        raise HTTPException(404, f"Session {session_id!r} not found")

    try:
        stp_bytes = export_step(session.doc)
    except Exception as e:
        raise HTTPException(500, f"STEP export failed: {e}")

    return Response(
        content=stp_bytes,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename=export.stp",
        },
    )
