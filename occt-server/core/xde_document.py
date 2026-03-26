"""XDE document wrapper — parse STEP files and build label maps."""

from __future__ import annotations

from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString
from OCP.XCAFApp import XCAFApp_Application
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDF import TDF_Label, TDF_LabelSequence, TDF_ChildIterator
from OCP.TDataStd import TDataStd_Name
from OCP.IFSelect import IFSelect_RetDone


def _label_tag_path(label: TDF_Label) -> str:
    """Return a stable string id from a TDF_Label's tag path, e.g. '0:1:1:2'."""
    return label.EntryDumpToString()


def _get_label_name(label: TDF_Label) -> str:
    """Extract the name attribute from a TDF_Label, or 'Unnamed'."""
    name_attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), name_attr):
        return name_attr.Get().ToExtString()
    return "Unnamed"


def parse_step_file(file_bytes: bytes) -> tuple[TDocStd_Document, dict[str, TDF_Label]]:
    """
    Parse a STEP file into an XDE document.
    Returns (document, label_map) where label_map maps node_id → TDF_Label.
    """
    # Create XDE application and document
    app = XCAFApp_Application.GetApplication_s()
    doc = TDocStd_Document(TCollection_ExtendedString("mdtv-xcaf"))
    app.InitDocument(doc)

    # Read STEP file
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    reader.SetColorMode(True)
    reader.SetLayerMode(True)

    # Write bytes to a temp file (STEPCAFControl_Reader needs a file path)
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(suffix=".stp", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        status = reader.ReadFile(tmp_path)
        if status != IFSelect_RetDone:
            raise RuntimeError(f"STEP read failed with status {status}")

        if not reader.Transfer(doc):
            raise RuntimeError("STEP transfer to XDE document failed")
    finally:
        os.unlink(tmp_path)

    # Build label map by walking the XDE shape tree
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    label_map: dict[str, TDF_Label] = {}

    def walk_label(label: TDF_Label) -> None:
        tag = _label_tag_path(label)
        node_id = f"xde-{tag}"
        label_map[node_id] = label

        it = TDF_ChildIterator(label)
        while it.More():
            child = it.Value()
            walk_label(child)
            it.Next()

    # Start from free shapes (top-level assemblies/parts)
    free_shapes = TDF_LabelSequence()
    shape_tool.GetFreeShapes(free_shapes)

    for i in range(1, free_shapes.Length() + 1):
        walk_label(free_shapes.Value(i))

    return doc, label_map


def build_hierarchy(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
) -> dict:
    """
    Build a CADNode-compatible hierarchy dict from the XDE document.
    Returns the root node dict and a list of (node_id, label) for mesh extraction.
    """
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())

    mesh_labels: list[tuple[str, TDF_Label]] = []

    def build_node(label: TDF_Label) -> dict:
        tag = _label_tag_path(label)
        node_id = f"xde-{tag}"
        name = _get_label_name(label)

        children = []
        mesh_indices: list[int] = []

        # Check if this is a simple shape (leaf) or assembly
        if shape_tool.IsSimpleShape(label):
            # This label holds geometry — assign a mesh index
            idx = len(mesh_labels)
            mesh_labels.append((node_id, label))
            mesh_indices.append(idx)
        else:
            # Assembly — recurse children
            it = TDF_ChildIterator(label)
            while it.More():
                child = it.Value()
                # Only include labels that are shapes or sub-assemblies
                if shape_tool.IsShape(child):
                    children.append(build_node(child))
                it.Next()

        return {
            "id": node_id,
            "name": name,
            "meshIndices": mesh_indices,
            "children": children,
        }

    # Build from free shapes
    free_shapes = TDF_LabelSequence()
    shape_tool.GetFreeShapes(free_shapes)

    if free_shapes.Length() == 1:
        root = build_node(free_shapes.Value(1))
    else:
        # Multiple root shapes — wrap in a virtual root
        children = []
        for i in range(1, free_shapes.Length() + 1):
            children.append(build_node(free_shapes.Value(i)))
        root = {
            "id": "xde-root",
            "name": "Assembly",
            "meshIndices": [],
            "children": children,
        }

    return root, mesh_labels
