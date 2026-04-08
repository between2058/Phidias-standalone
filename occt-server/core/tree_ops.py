"""
Map client-side tree operations to XDE label manipulation.

Operations: rename, delete, group, ungroup, move.
All operate on TDF_Labels within an XDE TDocStd_Document.
"""

from __future__ import annotations

from OCP.TDocStd import TDocStd_Document
from OCP.TDF import TDF_Label, TDF_LabelSequence, TDF_ChildIterator, TDF_TagSource
from OCP.TDataStd import TDataStd_Name
from OCP.TCollection import TCollection_ExtendedString
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TopoDS import TopoDS_Compound
from OCP.BRep import BRep_Builder
from OCP.TopLoc import TopLoc_Location

from core.xde_document import _label_tag_path


def rename_node(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
    node_id: str,
    new_name: str,
) -> None:
    """Set the name of a label."""
    label = label_map.get(node_id)
    if label is None:
        raise KeyError(f"Node {node_id!r} not found")
    TDataStd_Name.Set_s(label, TCollection_ExtendedString(new_name))


def delete_nodes(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
    node_ids: list[str],
) -> None:
    """Remove shapes from the document."""
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    for node_id in node_ids:
        label = label_map.pop(node_id, None)
        if label is not None:
            shape_tool.RemoveShape(label, True)


def group_nodes(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
    node_ids: list[str],
    group_name: str = "Group",
) -> str:
    """
    Create a new compound assembly from the given nodes.
    Returns the new group's node_id.
    """
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())

    # Create a new compound shape
    builder = BRep_Builder()
    compound = TopoDS_Compound()
    builder.MakeCompound(compound)

    # Add each child shape to the compound
    child_shapes = []
    for node_id in node_ids:
        label = label_map.get(node_id)
        if label is None:
            continue
        child_shape = shape_tool.GetShape(label)
        if not child_shape.IsNull():
            builder.Add(compound, child_shape)
            child_shapes.append((node_id, label))

    if not child_shapes:
        raise ValueError("No valid shapes to group")

    # Add the compound as a new shape in the document
    new_label = shape_tool.AddShape(compound, True)
    TDataStd_Name.Set_s(new_label, TCollection_ExtendedString(group_name))

    # Register in label_map
    tag = _label_tag_path(new_label)
    new_node_id = f"xde-{tag}"
    label_map[new_node_id] = new_label

    # Add children as components of the new assembly
    for node_id, label in child_shapes:
        child_shape = shape_tool.GetShape(label)
        shape_tool.AddComponent(new_label, child_shape, TopLoc_Location())

    # Remove old labels (they're now part of the group)
    for node_id, label in child_shapes:
        shape_tool.RemoveShape(label, True)
        label_map.pop(node_id, None)

    # Rebuild the label_map for the new group's children
    it = TDF_ChildIterator(new_label)
    while it.More():
        child = it.Value()
        child_tag = _label_tag_path(child)
        child_node_id = f"xde-{child_tag}"
        label_map[child_node_id] = child
        it.Next()

    shape_tool.UpdateAssemblies()
    return new_node_id


def ungroup_node(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
    node_id: str,
) -> None:
    """
    Dissolve a group — reparent its children to the group's parent,
    then remove the group label.
    """
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    label = label_map.get(node_id)
    if label is None:
        raise KeyError(f"Node {node_id!r} not found")

    # Get the group's components
    components = TDF_LabelSequence()
    shape_tool.GetComponents(label, components)

    if components.Length() == 0:
        return

    # Get the parent label (the group's parent)
    parent = label.Father()

    # For each component, add it as a free shape (or as component of parent)
    for i in range(1, components.Length() + 1):
        comp_label = components.Value(i)
        comp_shape = shape_tool.GetShape(comp_label)
        if comp_shape.IsNull():
            continue

        # Re-add as a top-level shape
        new_label = shape_tool.AddShape(comp_shape, False)

        # Copy name if it has one
        name_attr = TDataStd_Name()
        if comp_label.FindAttribute(TDataStd_Name.GetID_s(), name_attr):
            TDataStd_Name.Set_s(new_label, name_attr.Get())

        # Register in label_map
        tag = _label_tag_path(new_label)
        child_node_id = f"xde-{tag}"
        label_map[child_node_id] = new_label

    # Remove the group
    shape_tool.RemoveShape(label, True)
    label_map.pop(node_id, None)

    shape_tool.UpdateAssemblies()


def move_node(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
    node_id: str,
    target_parent_id: str | None,
    insert_index: int | None = None,
) -> None:
    """
    Move a node to a new parent. If target_parent_id is None, move to root level.
    """
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    label = label_map.get(node_id)
    if label is None:
        raise KeyError(f"Node {node_id!r} not found")

    shape = shape_tool.GetShape(label)
    if shape.IsNull():
        return

    # Get name before removal
    name_attr = TDataStd_Name()
    has_name = label.FindAttribute(TDataStd_Name.GetID_s(), name_attr)
    name_str = name_attr.Get() if has_name else None

    # Remove from current location
    shape_tool.RemoveShape(label, True)
    label_map.pop(node_id, None)

    if target_parent_id is not None:
        # Move into target parent as a component
        target_label = label_map.get(target_parent_id)
        if target_label is None:
            raise KeyError(f"Target parent {target_parent_id!r} not found")
        new_label = shape_tool.AddComponent(target_label, shape, TopLoc_Location())
    else:
        # Move to root level
        new_label = shape_tool.AddShape(shape, False)

    # Restore name
    if name_str is not None:
        TDataStd_Name.Set_s(new_label, name_str)

    # Update label_map
    tag = _label_tag_path(new_label)
    new_node_id = f"xde-{tag}"
    label_map[new_node_id] = new_label

    shape_tool.UpdateAssemblies()


def apply_operations(
    doc: TDocStd_Document,
    label_map: dict[str, TDF_Label],
    operations: list[dict],
) -> None:
    """Apply a batch of operations sequentially."""
    for op_data in operations:
        op = op_data["op"]
        if op == "rename":
            rename_node(doc, label_map, op_data["node_id"], op_data["name"])
        elif op == "delete":
            delete_nodes(doc, label_map, op_data["node_ids"])
        elif op == "group":
            group_nodes(doc, label_map, op_data["node_ids"], op_data.get("name", "Group"))
        elif op == "ungroup":
            ungroup_node(doc, label_map, op_data["node_id"])
        elif op == "move":
            move_node(
                doc,
                label_map,
                op_data["node_id"],
                op_data.get("target_parent_id"),
                op_data.get("insert_index"),
            )
        else:
            raise ValueError(f"Unknown operation: {op!r}")
