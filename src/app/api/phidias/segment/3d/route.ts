import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '../../_proxy';

const P3SAM_BASE = process.env.P3SAM_API_URL ?? 'http://172.18.246.141:5001';

/**
 * POST /api/phidias/segment/3d → POST http://P3SAM/segment
 */
export async function POST(request: NextRequest) {
  const response = await proxyRequest(request, `${P3SAM_BASE}/segment`);
  if (!response.ok) return response;

  const data = await response.json();
  return NextResponse.json({
    status: 'success',
    request_id: data.request_id,
    num_parts: data.num_parts,
    segmented_glb_url: data.segmented_glb,
    message: 'P3-SAM segmentation complete',
  });
}
