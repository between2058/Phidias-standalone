import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_proxy';

// Allow large request bodies for GLB file uploads
export const maxDuration = 120; // seconds
export const dynamic = 'force-dynamic';

const ARTICULATION_API_URL =
  process.env.ARTICULATION_API_URL || 'http://localhost:52071';

function buildTarget(request: NextRequest): string {
  const url = new URL(request.url);
  // request.url may contain the full pathname or just the catch-all segment
  // depending on Next.js version. Use nextUrl.pathname for reliability.
  const pathname = request.nextUrl.pathname;
  const subPath = pathname.replace(/^\/api\/phidias\/articulation/, '');
  const target = `${ARTICULATION_API_URL}/api${subPath}${url.search}`;
  console.log(`[articulation proxy] ${pathname} → ${target}`);
  return target;
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, buildTarget(request));
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, buildTarget(request));
}
