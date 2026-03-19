import { NextRequest } from 'next/server';
import { proxyRequest } from '../../_proxy';

const CONVERT_BASE = process.env.CONVERT_API_URL ?? 'http://localhost:8100';

export async function POST(request: NextRequest) {
    return proxyRequest(request, `${CONVERT_BASE}/convert`);
}
