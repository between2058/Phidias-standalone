import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest, logger } from '../../../../_proxy';

const P3SAM_BASE = process.env.P3SAM_API_URL ?? 'http://172.18.246.141:5001';

/**
 * GET /api/phidias/segment/3d/jobs/{job_id}
 * Poll for segmentation job status from P3SAM.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { job_id: string } },
) {
  try {
    const response = await proxyRequest(
      request,
      `${P3SAM_BASE}/jobs/${params.job_id}`,
      { service: 'p3sam-segment' }
    );

    // Proxy the response directly (including 404 for unknown jobs)
    return response;
  } catch (error) {
    logger.error('Segment 3D Jobs - GET proxy error', error, {
      service: 'p3sam-segment',
      meta: { jobId: params.job_id },
    });
    return NextResponse.json(
      {
        status: 'error',
        error_code: 'CONNECTION_ERROR',
        message: 'Failed to connect to segmentation service',
      },
      { status: 503 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { job_id: string } },
) {
  try {
    return proxyRequest(request, `${P3SAM_BASE}/jobs/${params.job_id}`, { service: 'p3sam-segment' });
  } catch (error) {
    logger.error('Segment 3D Jobs - DELETE proxy error', error, {
      service: 'p3sam-segment',
      meta: { jobId: params.job_id },
    });
    return NextResponse.json(
      { error_code: 'CONNECTION_ERROR', message: 'Failed to connect to segmentation service' },
      { status: 503 }
    );
  }
}
