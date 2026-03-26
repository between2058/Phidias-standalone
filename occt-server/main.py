"""
OCCT Server — PythonOCC REST API for STEP file manipulation.

Endpoints:
  POST   /import          Upload STEP → parse → return hierarchy + meshes
  POST   /ops             Apply tree operations to stored B-Rep
  GET    /export/stp      Export current state as STEP file
  DELETE /session/{id}    Cleanup session
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.session import session_manager
from routers.import_router import router as import_router
from routers.ops_router import router as ops_router
from routers.export_router import router as export_router
from routers.session_router import router as session_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: begin TTL cleanup loop
    session_manager.start_cleanup_loop()
    print("[OCCT Server] Started — session TTL cleanup active")
    yield
    # Shutdown: stop cleanup loop
    session_manager.stop_cleanup_loop()
    print("[OCCT Server] Shutdown — cleaned up")


app = FastAPI(
    title="OCCT Server",
    description="PythonOCC REST API for STEP file import, editing, and export",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(import_router)
app.include_router(ops_router)
app.include_router(export_router)
app.include_router(session_router)


@app.get("/health")
async def health():
    return {"status": "ok", "sessions": session_manager.count}
