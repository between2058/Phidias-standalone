import os
import tempfile

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    try:
        import bpy

        with tempfile.TemporaryDirectory() as tmpdir:
            glb_path = os.path.join(tmpdir, "input.glb")
            fbx_path = os.path.join(tmpdir, "output.fbx")

            contents = await file.read()
            with open(glb_path, "wb") as f:
                f.write(contents)

            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=glb_path)
            bpy.ops.export_scene.fbx(
                filepath=fbx_path,
                path_mode="COPY",
                embed_textures=True,
            )

            return FileResponse(
                fbx_path,
                media_type="application/octet-stream",
                filename="output.fbx",
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
