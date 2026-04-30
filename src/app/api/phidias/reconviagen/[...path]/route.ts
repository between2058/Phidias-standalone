import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';
import type { JobSubmitResponse } from '../../_types';

const RECONVIAGEN_BASE = process.env.RECONVIAGEN_API_URL ?? 'http://172.18.246.141:52069';

/**
 * Proxy all ReconViaGen calls:
 *   POST /api/phidias/reconviagen/generate-single → returns {job_id, status, queue_position}
 *   POST /api/phidias/reconviagen/generate-multi  → returns {job_id, status, queue_position}
 *   POST /api/phidias/reconviagen/generate-batch  → returns {job_id, status, queue_position}
 *   GET  /api/phidias/reconviagen/jobs/{job_id}   → poll for job status
 *   GET  /api/phidias/reconviagen/download/{id}/… → /download/{id}/…
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');

  // Job polling endpoint: /jobs/{job_id}
  if (path.startsWith('jobs/')) {
    return proxyRequest(request, RECONVIAGEN_BASE + '/' + path, { service: 'reconviagen' });
  }

  // Standard proxy for other GET endpoints (download, etc.)
  return proxyRequest(request, RECONVIAGEN_BASE + '/' + path, { service: 'reconviagen' });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  const targetUrl = RECONVIAGEN_BASE + '/' + path;

  // Generation endpoints now return {job_id, status, queue_position} for async processing
  if (['generate-single', 'generate-multi', 'generate-batch'].includes(path)) {
    const response = await proxyRequest(request, targetUrl, { service: 'reconviagen' });
    if (!response.ok) return response;

    // Return the job submission response directly
    const data = await response.json() as JobSubmitResponse;
    return NextResponse.json(data);
  }

  // For non-generation endpoints, use standard proxy
  return proxyRequest(request, targetUrl, { service: 'reconviagen' });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  // Cancel queued job: DELETE /reconviagen/jobs/{job_id} → DELETE /jobs/{job_id}
  if (path.startsWith('jobs/')) {
    return proxyRequest(request, RECONVIAGEN_BASE + '/' + path, { service: 'reconviagen' });
  }
  return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 });
}
