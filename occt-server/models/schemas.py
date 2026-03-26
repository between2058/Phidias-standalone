"""Pydantic models for request/response validation."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel


# ─── Shared node/mesh types (mirror client CADNode / CADMesh) ─────────────────

class CADNodeSchema(BaseModel):
    id: str
    name: str
    meshIndices: list[int]
    children: list[CADNodeSchema]


class BRepFace(BaseModel):
    first: int
    last: int
    color: list[float] | None = None


class CADMeshSchema(BaseModel):
    index: int
    name: str
    color: list[float] | None = None
    positions: list[float]
    normals: list[float] | None = None
    indices: list[int]
    brepFaces: list[BRepFace] = []


# ─── Import response ─────────────────────────────────────────────────────────

class ImportResponse(BaseModel):
    session_id: str
    root: CADNodeSchema
    meshes: list[CADMeshSchema]


# ─── Operations ──────────────────────────────────────────────────────────────

class RenameOp(BaseModel):
    op: Literal["rename"]
    node_id: str
    name: str


class DeleteOp(BaseModel):
    op: Literal["delete"]
    node_ids: list[str]


class GroupOp(BaseModel):
    op: Literal["group"]
    node_ids: list[str]
    name: str = "Group"


class UngroupOp(BaseModel):
    op: Literal["ungroup"]
    node_id: str


class MoveOp(BaseModel):
    op: Literal["move"]
    node_id: str
    target_parent_id: str | None = None
    insert_index: int | None = None


class OpsRequest(BaseModel):
    session_id: str
    operations: list[RenameOp | DeleteOp | GroupOp | UngroupOp | MoveOp]


class OpsResponse(BaseModel):
    root: CADNodeSchema
    meshes: list[CADMeshSchema]
