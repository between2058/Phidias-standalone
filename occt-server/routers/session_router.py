"""DELETE /session/{session_id} — cleanup session."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.session import session_manager

router = APIRouter()


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and free its XDE document from memory."""
    try:
        session_manager.get(session_id)  # Verify it exists
    except KeyError:
        raise HTTPException(404, f"Session {session_id!r} not found")

    session_manager.delete(session_id)
    return {"ok": True}


@router.get("/sessions")
async def list_sessions():
    """Debug endpoint — list active session count."""
    return {"count": session_manager.count}
