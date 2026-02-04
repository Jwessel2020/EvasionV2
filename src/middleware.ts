/**
 * Next.js Middleware
 * Handles authentication and route protection
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/map',
  '/routes',
  '/events',
  '/forums',
  '/garage',
  '/profile',
  '/settings',
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
];

export async function middleware(request: NextRequest) {
  // Update Supabase session
  const response = await updateSession(request);
  
  const { pathname } = request.nextUrl;
  
  // Check if accessing protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Check if accessing auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Get session from cookie (simplified check)
  // Also check for dev auth cookie in development
  const hasSession = request.cookies.has('sb-access-token') || 
                     request.cookies.get('sb-localhost-auth-token') ||
                     request.cookies.has('evasion-dev-auth');
  
  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !hasSession) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Redirect to dashboard if accessing auth route with session
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
