import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';
import type {
  JobSubmitResponse,
} from '../../_types';

const QWEN_BASE = process.env.QWEN_API_URL ?? 'http://172.18.246.141:8190';

/**
 * Map frontend URL path segments → Qwen API path.
 */
function qwenPath(segments: string[]): string {
  if (segments[0] === 'angle') return '/angle';
  return '/' + segments.join('/');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');

  // Job polling: GET /qwen/jobs/{job_id}
  if (path.startsWith('jobs/')) {
    return proxyRequest(request, QWEN_BASE + '/' + path, { service: 'qwen' });
  }

  return proxyRequest(request, QWEN_BASE + qwenPath(params.path), { service: 'qwen' });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  const targetUrl = QWEN_BASE + qwenPath(params.path);

  // text2img: frontend sends JSON; Qwen expects Form fields (application/x-www-form-urlencoded).
  // Qwen now returns {job_id, status, queue_position} for async processing.
  if (path === 'text2img') {
    const json = await request.json() as Record<string, unknown>;
    const formBody = new URLSearchParams();
    for (const [k, v] of Object.entries(json)) {
      if (v !== undefined && v !== null) {
        formBody.append(k, String(v));
      }
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    let upstream: Response;
    try {
      upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!upstream.ok) return new NextResponse(upstream.body, { status: upstream.status });
    // Qwen now returns job submission response
    const data = await upstream.json() as JobSubmitResponse;
    return NextResponse.json(data);
  }

  // edit / edit-multi / angle: all now return {job_id, status, queue_position}
  // Proxy the form-data request and return the job submission response
  if (['edit', 'edit-multi', 'angle', 'angle/multi'].includes(path)) {
    const response = await proxyRequest(request, targetUrl, { service: 'qwen' });
    if (!response.ok) return response;
    const data = await response.json() as JobSubmitResponse;
    return NextResponse.json(data);
  }

  // Passthrough: other paths
  return proxyRequest(request, targetUrl, { service: 'qwen' });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  // Cancel queued job: DELETE /qwen/jobs/{job_id} → DELETE /jobs/{job_id}
  if (path.startsWith('jobs/')) {
    return proxyRequest(request, QWEN_BASE + '/' + path, { service: 'qwen' });
  }
  return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 });
}
