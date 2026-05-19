import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_proxy';

// Allow large request bodies for GLB file uploads
export const maxDuration = 120; // seconds
export const dynamic = 'force-dynamic';

const ARTICULATION_API_URL =
  process.env.ARTICULATION_API_URL || 'http://localhost:52071';

// Pull the path from the catch-all `params.path` instead of regex-stripping
// `request.nextUrl.pathname`. The Next.js `/phidias/:path*` → `/api/phidias/:path*`
// rewrite preserves the original URL in `nextUrl.pathname`, so the old strip
// regex never matched on rewritten requests and the proxy forwarded the wrong
// upstream path (e.g. `/api/phidias/articulation/export-usdz` instead of
// `/api/export-usdz`), causing the Physics tab to 404. `params.path` is always
// just the wildcard segments. Same shape as the sibling qwen/reconviagen routes.
function buildTarget(request: NextRequest, segments: string[]): string {
  const url = new URL(request.url);
  const subPath = segments.length ? '/' + segments.join('/') : '';
  const target = `${ARTICULATION_API_URL}/api${subPath}${url.search}`;
  console.log(`[articulation proxy] ${request.nextUrl.pathname} → ${target}`);
  return target;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyRequest(request, buildTarget(request, params.path));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyRequest(request, buildTarget(request, params.path));
}
