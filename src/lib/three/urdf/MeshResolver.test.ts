import { describe, it, expect } from 'vitest';
import { MeshResolver } from './MeshResolver';

describe('MeshResolver', () => {
  const r = new MeshResolver({ baseUrl: '/api/library/records/rec_x' });

  it('resolves package:// to proxied files endpoint', () => {
    expect(r.resolve('package://meshes/foo.stl'))
      .toBe('/api/library/records/rec_x/files/meshes/foo.stl');
  });

  it('resolves file:// stripping the scheme', () => {
    expect(r.resolve('file:///abs/meshes/foo.stl'))
      .toBe('/api/library/records/rec_x/files/abs/meshes/foo.stl');
  });

  it('resolves relative paths against the URDF directory', () => {
    expect(r.resolve('assets/foo.glb', 'model.urdf'))
      .toBe('/api/library/records/rec_x/files/assets/foo.glb');
  });

  it('passes through http:// URLs unchanged', () => {
    expect(r.resolve('http://cdn.example.com/mesh.glb'))
      .toBe('http://cdn.example.com/mesh.glb');
  });

  it('resolves bare relative path when no urdfPath given', () => {
    expect(r.resolve('mesh.glb'))
      .toBe('/api/library/records/rec_x/files/mesh.glb');
  });

  it('strips trailing slash from baseUrl', () => {
    const r2 = new MeshResolver({ baseUrl: '/api/library/records/rec_x/' });
    expect(r2.resolve('package://meshes/foo.stl'))
      .toBe('/api/library/records/rec_x/files/meshes/foo.stl');
  });
});
