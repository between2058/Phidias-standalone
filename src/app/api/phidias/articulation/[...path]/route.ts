import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_proxy';

const ARTICULATION_API_URL =
  process.env.ARTICULATION_API_URL || 'http://localhost:52071';

function buildTarget(request: NextRequest): string {
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/phidias\/articulation/, '');
  const target = `${ARTICULATION_API_URL}/api${subPath}${url.search}`;
  return target;
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, buildTarget(request));
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, buildTarget(request));
}
