import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE, SESSION_COOKIE, refreshCookie, sessionCookie } from './lib/session';
import { refreshSession } from './lib/api';

/** The only routes a visitor without a session may reach. */
const PUBLIC_ROUTES = ['/login', '/verify', '/reset', '/forgot-password'];

/**
 * The strict CSP the one rendered page runs under (docs/deployment.md §8).
 * The nonce is minted per request; Next reads it out of the request's CSP
 * header and stamps it on the scripts it injects, so only the app's own
 * bootstrap script may execute — and an injected `<script>` may not.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    `default-src 'self'`,
    // `strict-dynamic` lets the nonce-stamped bootstrap script load Next's own
    // chunks, while everything else still needs the nonce.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join('; ');
}

/**
 * The redirect happens here rather than in each page, so a page added later is
 * protected by existing rather than by remembering to check. A cookie being
 * present says nothing about its validity — the API is what verifies it, and
 * every page's own fetch answers 401 if the token expired or was forged.
 *
 * With the short-lived access token (ADR-0009), an expired session cookie no
 * longer means the User left: the middleware silently exchanges the refresh
 * cookie for a fresh pair and lets the request through with the new token,
 * so a signed-in User never sees the sign-in screen just because a quarter
 * of an hour passed.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Silent rotation first, while the cookie mutation below still lands in the
  // request headers the page will read.
  let refreshed: Awaited<ReturnType<typeof refreshSession>> = null;
  let refreshFailed = false;
  if (!sessionToken && refreshToken) {
    refreshed = await refreshSession(refreshToken);
    refreshFailed = refreshed === null;
  }

  const responseCookies: Array<ReturnType<typeof sessionCookie>> = [];
  if (refreshed) {
    // The browser carries the fresh pair on from here.
    responseCookies.push(sessionCookie(refreshed.auth.accessToken));
    if (refreshed.refreshToken) {
      responseCookies.push(refreshCookie(refreshed.refreshToken));
    }
  }

  if (refreshFailed) {
    // The refresh session is dead — expired, revoked, or replayed. Nothing
    // left to hold on to.
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  if (!sessionToken && !refreshToken && !PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // The policy rides on the request for Next to read the nonce out of and
  // stamp on the scripts it injects, and on the response for the browser to
  // enforce. One header, both directions — nothing else needs to carry it.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  responseCookies.forEach((cookie) => response.cookies.set(cookie));
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  // Everything but Next's own assets and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
