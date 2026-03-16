import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';

const RECONVIAGEN_BASE = process.env.RECONVIAGEN_API_URL ?? 'http://172.18.246.141:52069';

/**
 * Proxy all ReconViaGen calls 1-to-1:
 *   POST /api/phidias/reconviagen/generate-single → /generate-single
 *   POST /api/phidias/reconviagen/generate-multi  → /generate-multi
 *   POST /api/phidias/reconviagen/generate-batch  → /generate-batch
 *   GET  /api/phidias/reconviagen/download/{id}/… → /download/{id}/…
 */
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
  const targetUrl = RECONVIAGEN_BASE + '/' + path;

  // For non-generation endpoints, use standard proxy
  if (path !== 'generate-single' && path !== 'generate-multi') {
    return proxyRequest(request, targetUrl);
  }

  // For generation endpoints, we need to map the response to match Phidias Python Router
  const response = await proxyRequest(request, targetUrl);
  if (!response.ok) return response;

  const data = await response.json();

  // Extract request_id from glb_file path if possible, just like Python does
  const glbFile = data.glb_file || '';
  const pathParts = glbFile.split('/');
  const requestId = (glbFile.startsWith('/download/') && pathParts.length >= 4) ? pathParts[2] : '';

  const mappedData = {
    status: 'success',
    request_id: requestId,
    glb_url: data.glb_file,
    gaussian_video: data.gaussian_video,
    radiance_video: data.radiance_video,
    mesh_video: data.mesh_video,
    ply_url: data.ply_file,
    message: `ReconViaGen ${path === 'generate-single' ? 'single' : 'multi'} image generation complete`
  };

  return NextResponse.json(mappedData);
}
