"""Tessellate B-Rep shapes into mesh data matching client CADMesh format."""

from __future__ import annotations

from OCP.TDocStd import TDocStd_Document
from OCP.TDF import TDF_Label
from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorTool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location
from OCP.Quantity import Quantity_TOC_RGB
from OCP.XCAFDoc import XCAFDoc_ColorType


def tessellate_label(
    label: TDF_Label,
    index: int,
    doc: TDocStd_Document,
    linear_deflection: float = 0.001,
    angular_deflection: float = 0.5,
) -> dict:
    """
    Tessellate a shape label and return a CADMesh-compatible dict.

    Output format:
    {
        "index": int,
        "name": str,
        "color": [r, g, b] | None,
        "positions": [float, ...],
        "normals": [float, ...] | None,
        "indices": [int, ...],
        "brepFaces": [{"first": int, "last": int, "color": [r,g,b] | None}, ...]
    }
    """
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    color_tool = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())

    shape = shape_tool.GetShape(label)
    if shape.IsNull():
        return _empty_mesh(index, "Empty")

    # Get name
    from OCP.TDataStd import TDataStd_Name
    name = "Unnamed"
    name_attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), name_attr):
        name = name_attr.Get().ToExtString()

    # Get shape color
    from OCP.Quantity import Quantity_Color
    shape_color = None
    qc = Quantity_Color()
    if color_tool.GetColor(label, XCAFDoc_ColorType.XCAFDoc_ColorSurf, qc):
        shape_color = [qc.Red(), qc.Green(), qc.Blue()]
    elif color_tool.GetColor(label, XCAFDoc_ColorType.XCAFDoc_ColorGen, qc):
        shape_color = [qc.Red(), qc.Green(), qc.Blue()]

    # Tessellate
    BRepMesh_IncrementalMesh(shape, linear_deflection, False, angular_deflection, True)

    # Extract triangulation from each face
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    brep_faces: list[dict] = []

    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    vertex_offset = 0

    while explorer.More():
        face = explorer.Current()
        loc = TopLoc_Location()
        triangulation = BRep_Tool.Triangulation_s(face, loc)

        if triangulation is None:
            explorer.Next()
            continue

        trsf = loc.Transformation()
        nb_nodes = triangulation.NbNodes()
        nb_tris = triangulation.NbTriangles()

        first_tri = len(indices) // 3

        # Extract vertices
        for i in range(1, nb_nodes + 1):
            pnt = triangulation.Node(i)
            pnt.Transform(trsf)
            positions.extend([pnt.X(), pnt.Y(), pnt.Z()])

        # Extract normals if available
        has_normals = triangulation.HasNormals()
        if has_normals:
            for i in range(1, nb_nodes + 1):
                nrm = triangulation.Normal(i)
                nrm = nrm.IsEqual(nrm, 0.0) and nrm or nrm  # identity check
                normals.extend([nrm.X(), nrm.Y(), nrm.Z()])

        # Extract triangles
        for i in range(1, nb_tris + 1):
            tri = triangulation.Triangle(i)
            n1, n2, n3 = tri.Get()
            indices.extend([
                n1 - 1 + vertex_offset,
                n2 - 1 + vertex_offset,
                n3 - 1 + vertex_offset,
            ])

        last_tri = len(indices) // 3 - 1

        # Per-face color
        face_color = None
        fc = Quantity_Color()
        if color_tool.GetColor(face, XCAFDoc_ColorType.XCAFDoc_ColorSurf, fc):
            face_color = [fc.Red(), fc.Green(), fc.Blue()]

        brep_faces.append({
            "first": first_tri,
            "last": last_tri,
            "color": face_color,
        })

        vertex_offset += nb_nodes
        explorer.Next()

    return {
        "index": index,
        "name": name,
        "color": shape_color,
        "positions": positions,
        "normals": normals if normals else None,
        "indices": indices,
        "brepFaces": brep_faces,
    }


def tessellate_all(
    mesh_labels: list[tuple[str, TDF_Label]],
    doc: TDocStd_Document,
    linear_deflection: float = 0.001,
    angular_deflection: float = 0.5,
) -> list[dict]:
    """Tessellate all mesh labels and return a list of CADMesh dicts."""
    return [
        tessellate_label(label, i, doc, linear_deflection, angular_deflection)
        for i, (_node_id, label) in enumerate(mesh_labels)
    ]


def _empty_mesh(index: int, name: str) -> dict:
    return {
        "index": index,
        "name": name,
        "color": None,
        "positions": [],
        "normals": None,
        "indices": [],
        "brepFaces": [],
    }
