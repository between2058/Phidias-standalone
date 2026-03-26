"""In-memory session manager with TTL-based cleanup."""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from OCP.TDocStd import TDocStd_Document
    from OCP.TDF import TDF_Label


@dataclass
class Session:
    id: str
    doc: TDocStd_Document
    label_map: dict[str, TDF_Label] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.last_accessed = time.time()


class SessionManager:
    def __init__(self, ttl_seconds: int = 3600) -> None:
        self._sessions: dict[str, Session] = {}
        self._ttl = ttl_seconds
        self._cleanup_task: asyncio.Task | None = None

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(self, doc: TDocStd_Document, label_map: dict[str, TDF_Label]) -> str:
        sid = uuid.uuid4().hex
        self._sessions[sid] = Session(id=sid, doc=doc, label_map=label_map)
        return sid

    def get(self, session_id: str) -> Session:
        sess = self._sessions.get(session_id)
        if sess is None:
            raise KeyError(f"Session {session_id!r} not found or expired")
        sess.touch()
        return sess

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    # ── TTL cleanup ───────────────────────────────────────────────────────────

    def cleanup_expired(self) -> int:
        now = time.time()
        expired = [
            sid
            for sid, sess in self._sessions.items()
            if now - sess.last_accessed > self._ttl
        ]
        for sid in expired:
            del self._sessions[sid]
        return len(expired)

    async def _periodic_cleanup(self) -> None:
        while True:
            await asyncio.sleep(60)
            n = self.cleanup_expired()
            if n:
                print(f"[SessionManager] Cleaned up {n} expired session(s)")

    def start_cleanup_loop(self) -> None:
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    def stop_cleanup_loop(self) -> None:
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None

    @property
    def count(self) -> int:
        return len(self._sessions)


# Singleton
session_manager = SessionManager()
