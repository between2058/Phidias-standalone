import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';

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
  return proxyRequest(request, QWEN_BASE + qwenPath(params.path));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join('/');
  const targetUrl = QWEN_BASE + qwenPath(params.path);

  // For generic endpoints, use standard proxy
  if (!['text2img', 'edit', 'angle/multi'].includes(path)) {
    return proxyRequest(request, targetUrl);
  }

  const response = await proxyRequest(request, targetUrl);
  if (!response.ok) return response;

  const data = await response.json();

  if (path === 'text2img') {
    return NextResponse.json({
      status: 'success',
      request_id: data.request_id || '',
      urls: data.urls || [],
      seeds: data.seeds || [],
    });
  }

  if (path === 'edit') {
    const urls = data.result_urls || (data.result_url ? [data.result_url] : []);
    return NextResponse.json({
      status: 'success',
      request_id: data.request_id || '',
      input_url: data.input_url || '',
      urls: urls,
      seeds: data.seeds || [],
    });
  }

  if (path === 'angle/multi') {
    return NextResponse.json({
      status: 'success',
      request_id: data.request_id || '',
      input_url: data.input_url || '',
      results: {
        right: data.results?.right,
        back: data.results?.back,
        left: data.results?.left,
      },
    });
  }

  return NextResponse.json(data);
}
