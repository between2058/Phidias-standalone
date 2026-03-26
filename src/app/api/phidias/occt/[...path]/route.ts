import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_proxy';

const OCCT_BASE = process.env.OCCT_API_URL ?? 'http://172.18.246.141:8200';

/**
 * Proxy all OCCT server calls 1-to-1:
 *   POST /api/phidias/occt/import       → /import
 *   POST /api/phidias/occt/ops          → /ops
 *   GET  /api/phidias/occt/export/stp   → /export/stp
 *   DELETE /api/phidias/occt/session/xxx → /session/xxx
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, OCCT_BASE + '/' + params.path.join('/'));
}

export async function POST(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, OCCT_BASE + '/' + params.path.join('/'));
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, OCCT_BASE + '/' + params.path.join('/'));
}
