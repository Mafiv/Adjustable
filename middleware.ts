import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (pathname === '/sign-in' && hasSessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const protectedPaths = ['/'];
  const isProtectedPath = protectedPaths.includes(pathname);

  if (isProtectedPath && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/sign-in', '/'],
};
