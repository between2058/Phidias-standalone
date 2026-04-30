import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';

const TRELLIS2_BASE = process.env.TRELLIS2_API_URL ?? 'http://172.18.246.141:52070';

/**
 * Proxy Trellis.2 calls:
 *   POST /api/phidias/trellis2/generate        → /generate
 *   POST /api/phidias/trellis2/generate-multi   → /generate-multiview
 *   GET  /api/phidias/trellis2/download/{id}/…  → /download/{id}/…
 *   GET  /api/phidias/trellis2/health           → /health
 */

// Map Phidias endpoint names to Trellis.2 endpoint names
const ENDPOINT_MAP: Record<string, string> = {
  'generate': 'generate',
  'generate-multi': 'generate-multiview',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyRequest(request, TRELLIS2_BASE + '/' + params.path.join('/'));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  const mappedPath = ENDPOINT_MAP[path] ?? path;
  const targetUrl = TRELLIS2_BASE + '/' + mappedPath;

  // For non-generation endpoints, use standard proxy
  if (!ENDPOINT_MAP[path]) {
    return proxyRequest(request, targetUrl);
  }

  // For generation endpoints, map Trellis.2 response to Phidias schema
  const response = await proxyRequest(request, targetUrl);
  if (!response.ok) return response;

  const data = await response.json();

  // Trellis.2 returns { request_id, glb_url } directly
  const mappedData = {
    status: 'success',
    request_id: data.request_id ?? '',
    glb_url: data.glb_url ?? '',
    gaussian_video: data.gaussian_video ?? '',
    radiance_video: data.radiance_video ?? '',
    mesh_video: data.mesh_video ?? '',
    ply_url: data.ply_url ?? '',
    message: `Trellis.2 generation complete`,
  };

  return NextResponse.json(mappedData);
}
