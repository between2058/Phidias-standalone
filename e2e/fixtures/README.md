# E2E Test Fixtures

## Required Files

### `test-model.glb`

A valid GLB file with at least one mesh, used for:
- Segment workspace tests (PHI-INT-N-028 through N-033)
- Smart Organize tests (PHI-INT-N-038, N-040)

Requirements:
- Format: binary glTF 2.0 (.glb)
- Size: ideally < 5 MB to keep test upload time short
- Content: a simple multi-part mesh so P3SAM can segment it into ≥ 3 parts
- Recommended: a cube with several named sub-meshes, or any real 3D model

How to obtain:
1. Download a free GLB from Sketchfab or similar (ensure license allows use)
2. Or export a simple model from Blender as GLB
3. Place the file at this path: `e2e/fixtures/test-model.glb`

Tests that depend on this file will `test.skip` with a clear message if it is absent.

### `test-image.png`

A small PNG image used as input for image-to-3D model generation.
The inline `TINY_PNG` buffer defined in each spec file is sufficient for most tests,
but if you want to test with a more representative image, place a PNG here.
