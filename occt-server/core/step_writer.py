"""Export XDE document to STEP file bytes."""

from __future__ import annotations

import tempfile
import os

from OCP.TDocStd import TDocStd_Document
from OCP.STEPCAFControl import STEPCAFControl_Writer
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_AsIs


def export_step(doc: TDocStd_Document) -> bytes:
    """
    Write the XDE document to a STEP AP214 file and return the bytes.
    Preserves names, colors, and hierarchy.
    """
    writer = STEPCAFControl_Writer()
    writer.SetNameMode(True)
    writer.SetColorMode(True)
    writer.SetLayerMode(True)

    if not writer.Transfer(doc, STEPControl_AsIs):
        raise RuntimeError("Failed to transfer XDE document to STEP writer")

    with tempfile.NamedTemporaryFile(suffix=".stp", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        status = writer.Write(tmp_path)
        if status != IFSelect_RetDone:
            raise RuntimeError(f"STEP write failed with status {status}")

        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)
