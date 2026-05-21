export interface MeshResolverOptions {
  baseUrl: string;
}

export class MeshResolver {
  constructor(private opts: MeshResolverOptions) {}

  resolve(meshPath: string, urdfPath?: string): string {
    const base = this.opts.baseUrl.replace(/\/$/, '');
    const filesBase = `${base}/files`;

    if (meshPath.startsWith('package://')) {
      return `${filesBase}/${meshPath.slice('package://'.length)}`;
    }
    if (meshPath.startsWith('file://')) {
      const stripped = meshPath.slice('file://'.length).replace(/^\/+/, '');
      return `${filesBase}/${stripped}`;
    }
    if (meshPath.startsWith('http://') || meshPath.startsWith('https://')) {
      return meshPath;
    }
    if (urdfPath) {
      const dir = urdfPath.includes('/') ? urdfPath.substring(0, urdfPath.lastIndexOf('/')) : '';
      return dir ? `${filesBase}/${dir}/${meshPath}` : `${filesBase}/${meshPath}`;
    }
    return `${filesBase}/${meshPath}`;
  }
}
