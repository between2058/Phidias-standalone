import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';

const RECONVIAGEN_BASE = process.env.RECONVIAGEN_API_URL ?? 'http://172.18.246.141:52070';

/**
 * Proxy ReconViaGen / Trellis.2 calls:
 *   POST /api/phidias/reconviagen/generate-single → /generate
 *   POST /api/phidias/reconviagen/generate-multi  → /generate-multiview
 *   POST /api/phidias/reconviagen/generate-batch  → /generate (sequential)
 *   GET  /api/phidias/reconviagen/download/{id}/…  → /download/{id}/…
 */

// Map Phidias endpoint names to Trellis.2 endpoint names
const ENDPOINT_MAP: Record<string, string> = {
  'generate-single': 'generate',
  'generate-multi': 'generate-multiview',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyRequest(request, RECONVIAGEN_BASE + '/' + params.path.join('/'));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  const mappedPath = ENDPOINT_MAP[path] ?? path;
  const targetUrl = RECONVIAGEN_BASE + '/' + mappedPath;

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
    message: `Trellis.2 ${path === 'generate-single' ? 'single' : 'multi'} image generation complete`,
  };

  return NextResponse.json(mappedData);
}
