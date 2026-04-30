import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest, logger } from '../../_proxy';
import type { JobSubmitResponse } from '../../_types';

const P3SAM_BASE = process.env.P3SAM_API_URL ?? 'http://172.18.246.141:5001';

interface SegmentErrorResponse {
  error_code?: string;
  message?: string;
}

/**
 * POST /api/phidias/segment/3d → POST http://P3SAM/segment
 * Returns job_id for async polling. Use GET /api/phidias/segment/3d/jobs/{job_id} to poll.
 */
export async function POST(request: NextRequest) {
  try {
    const response = await proxyRequest(request, `${P3SAM_BASE}/segment`, { service: 'p3sam-segment' });

    // Handle error responses with proper error code mapping
    if (!response.ok) {
      const status = response.status;

      // 413: File too large
      if (status === 413) {
        return NextResponse.json(
          {
            status: 'error',
            error_code: 'FILE_TOO_LARGE',
            message: 'GLB file is too large. Try simplifying the model or reducing mesh density.',
          },
          { status: 413 }
        );
      }

      // Try to parse upstream error for better error messages
      try {
        const errorData = await response.json() as SegmentErrorResponse;
        return NextResponse.json(
          {
            status: 'error',
            error_code: errorData.error_code || 'INFERENCE_ERROR',
            message: errorData.message || `Upstream error: ${status}`,
          },
          { status }
        );
      } catch {
        // If we can't parse JSON, return generic error
        return NextResponse.json(
          {
            status: 'error',
            error_code: 'INFERENCE_ERROR',
            message: `Segmentation service error: ${status}`,
          },
          { status }
        );
      }
    }

    // P3SAM now returns {job_id, status, queue_position}
    const data = await response.json() as JobSubmitResponse;
    return NextResponse.json(data);
  } catch (error) {
    // Handle network/connection errors
    logger.error('Segment 3D proxy error', error, {
      service: 'p3sam-segment',
      path: '/api/phidias/segment/3d',
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
