import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (pathname === '/sign-in' && hasSessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const protectedPathPrefixes = [
    '/dashboard',
    '/exports',
    '/generate',
    '/ingest',
    '/profile',
    '/vault',
  ];
  const isProtectedPath = protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedPath && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/sign-in',
    '/dashboard/:path*',
    '/exports/:path*',
    '/generate/:path*',
    '/ingest/:path*',
    '/profile/:path*',
    '/vault/:path*',
  ],
};
