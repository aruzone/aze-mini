import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from './lib/session';

/** The only routes a visitor without a session may reach. */
const PUBLIC_ROUTES = ['/login'];

/**
 * The redirect happens here rather than in each page, so a page added later is
 * protected by existing rather than by remembering to check. This only looks at
 * whether a cookie is present: the API is what actually verifies the token, and
 * every page's own fetch answers 401 if it has expired or was forged.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const login = new URL('/login', request.url);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything but Next's own assets and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
