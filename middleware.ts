import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/session';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/session', '/api/auth/login'];

// Define protected routes (dashboard and all subroutes)
const protectedRoutes = ['/dashboard', '/api/'];

/**
 * Middleware to protect routes and enforce authentication
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }
  
  // Allow public routes (login page)
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    try {
      const user = await getCurrentUser();
      
      // If not authenticated and trying to access protected routes
      if (!user) {
        // For API routes, return 401 JSON response
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
        
        // For page routes, redirect to login with return URL
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
      }
      
      return NextResponse.next();
    } catch (error) {
      console.error('Middleware authentication error:', error);
      // On error, redirect to login for safety
      if (!pathname.startsWith('/api/')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
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
