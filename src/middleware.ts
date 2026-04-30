import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type PhidiasMode = 'client' | 'server';

/**
 * Middleware to restrict routes based on PHIDIAS_MODE:
 *
 * - 'client' (phidias-standalone): Only /api-doc is blocked, full UI is accessible
 * - 'server' (phidias-api): Only /api-doc and /api/* are accessible, all other UI routes are blocked
 */
export function middleware(request: NextRequest) {
  const mode = (process.env.PHIDIAS_MODE as PhidiasMode) || 'client';
  const { pathname } = request.nextUrl;

  // Always allow Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/__next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Always allow static assets in public/
  if (
    pathname.startsWith('/hdri') ||
    pathname.startsWith('/models') ||
    pathname.startsWith('/textures') ||
    pathname.startsWith('/images')
  ) {
    return NextResponse.next();
  }

  // Always allow /api/* routes (backend endpoints)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (mode === 'client') {
    // client mode: only block /api-doc
    if (pathname.startsWith('/api-doc')) {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  } else if (mode === 'server') {
    // server mode: block all non-API-Doc routes
    // Only allow /api-doc and /api/* (already handled above)
    if (!pathname.startsWith('/api-doc')) {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};