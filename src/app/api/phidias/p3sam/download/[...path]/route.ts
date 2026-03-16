import { NextRequest } from 'next/server';
import { proxyRequest } from '../../../_proxy';

const P3SAM_BASE = process.env.P3SAM_API_URL ?? 'http://172.18.246.141:5001';

/**
 * GET /api/phidias/p3sam/download/{request_id}/{file_name}
 *   → GET http://P3SAM/download/{request_id}/{file_name}
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, `${P3SAM_BASE}/download/${params.path.join('/')}`);
}
