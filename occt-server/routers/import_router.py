"""POST /import — upload STEP file, parse, return hierarchy + meshes."""

from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, Query, HTTPException

from core.session import session_manager
from core.xde_document import parse_step_file, build_hierarchy
from core.tessellator import tessellate_all

router = APIRouter()


@router.post("/import")
async def import_step(
    file: UploadFile = File(...),
    linear_deflection: float = Query(0.001, description="Tessellation linear deflection"),
    angular_deflection: float = Query(0.5, description="Tessellation angular deflection"),
):
    """
    Upload a STEP file, parse it into an XDE document, tessellate, and return
    the hierarchy + mesh data in the same format as the client's occt-import-js.
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("stp", "step", "igs", "iges", "brep", "brp"):
        raise HTTPException(400, f"Unsupported format: .{ext}")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    try:
        doc, label_map = parse_step_file(content)
    except Exception as e:
        raise HTTPException(422, f"Failed to parse STEP file: {e}")

    # Build hierarchy and tessellate
    root, mesh_labels = build_hierarchy(doc, label_map)
    meshes = tessellate_all(mesh_labels, doc, linear_deflection, angular_deflection)

    # Create session
    session_id = session_manager.create(doc, label_map)

    return {
        "session_id": session_id,
        "root": root,
        "meshes": meshes,
    }
