import type { Response } from 'express';

/** The one name the refresh token travels under. httpOnly, never in a body. */
export const REFRESH_COOKIE = 'aze_refresh';

/**
 * The refresh token lives only in this cookie (ADR-0009). Path-scoped to the
 * auth routes so the browser sends it nowhere else, and httpOnly so page
 * script can never read it.
 */
export function setRefreshCookie(
  reply: Response,
  token: string,
  maxAgeSeconds: number,
): void {
  reply.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: maxAgeSeconds,
  });
}

export function clearRefreshCookie(reply: Response): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}
