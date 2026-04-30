import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, createRequestLogger } from '@/lib/server/logger';

// Re-export logger for use by route handlers
export { logger } from '@/lib/server/logger';

/**
 * Generic reverse-proxy helper for Next.js App Router API routes.
 * Streams the upstream response body directly — efficient for large files (GLB, MP4).
 * Includes structured logging for all requests.
 */
export async function proxyRequest(
  request: NextRequest,
  targetUrl: string,
  options?: {
    service?: string;
    doNotLogBody?: boolean;
  },
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const service = options?.service || extractServiceName(targetUrl);
  const path = extractPath(targetUrl);
  const startTime = performance.now();

  const requestLogger = createRequestLogger(requestId, service, {
    method: request.method,
    path: request.nextUrl.pathname,
  });

  // Log request start
  requestLogger.start();

  try {
    // Build headers
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      // Strip hop-by-hop headers that must not be forwarded
      if (!['host', 'connection', 'transfer-encoding'].includes(lower)) {
        headers.set(key, value);
      }
    });

    // Add correlation ID for distributed tracing
    headers.set('X-Request-ID', requestId);

    // Add API key for upstream services (hardcoded; move to env var after k8s ConfigMap is updated)
    headers.set('x-api-key', 'PHIDIAS');

    // Prepare body
    let body: RequestInit['body'] = undefined;
    if (!['GET', 'HEAD'].includes(request.method)) {
      // Use request.body (ReadableStream) directly for efficient streaming
      body = request.body;
    }

    // Log upstream target
    requestLogger.upstream(targetUrl);

    // Execute upstream request
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      // @ts-expect-error - 'duplex' is required in Node.js when body is a stream
      duplex: body ? 'half' : undefined,
    });

    const duration = Math.round(performance.now() - startTime);

    // Prepare response headers
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!['transfer-encoding', 'connection'].includes(lower)) {
        responseHeaders.set(key, value);
      }
    });

    // Add correlation ID to response
    responseHeaders.set('X-Request-ID', requestId);

    // Log completion
    requestLogger.success(upstream.status, duration, {
      upstreamUrl: targetUrl,
      upstreamPath: path,
      contentType: upstream.headers.get('content-type'),
      contentLength: upstream.headers.get('content-length'),
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (error) {
    const duration = Math.round(performance.now() - startTime);

    // Log error
    requestLogger.error(502, duration, error, {
      upstreamUrl: targetUrl,
      upstreamPath: path,
    });

    // Return error response
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 502 }
    );
  }
}

/**
 * Extract service name from target URL for logging
 */
function extractServiceName(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Map common hostnames to service names
    if (hostname.includes('qwen')) return 'qwen';
    if (hostname.includes('reconviagen')) return 'reconviagen';
    if (hostname.includes('p3sam') || hostname.includes('sam')) return 'p3sam';
    if (hostname.includes('segment')) return 'segment';
    if (hostname.includes('smart')) return 'smart-organize';

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extract path from target URL for logging
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}
