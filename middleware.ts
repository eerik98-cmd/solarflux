import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that never need a session check
const publicRoutes = ['/login', '/api/auth/', '/quote/', '/api/public/', '/contract-docs/'];

/**
 * Lightweight middleware — only redirects unauthenticated page requests to /login.
 * API auth is enforced inside each route handler via iron-session (Node runtime).
 * We intentionally avoid calling iron-session here because the middleware runs on
 * the Edge runtime where `next/headers` / Node crypto are unavailable.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Always allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // For page routes under /dashboard, check the session cookie exists
  // (actual validation happens server-side in route handlers / layouts)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/clients') || pathname.startsWith('/inventory') || pathname.startsWith('/installer')) {
    const sessionCookie = request.cookies.get('solarflux_session');
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
