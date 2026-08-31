import type { Response } from 'express';
import { appConfig } from '../config/configuration';

/** The one name the refresh token travels under. httpOnly, never in a body. */
export const REFRESH_COOKIE = 'aze_refresh';

/**
 * The one wording every dead-session refusal answers with, so the controller,
 * the refresh machine and the access-token issuer cannot drift apart and tell
 * a client three different stories about the same state.
 */
export const SESSION_REFUSED = 'The session is no longer valid. Sign in again.';

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
    // No TLS on a local clone, so this follows the environment rather than
    // being pinned on — where it would stop the cookie being set at all.
    secure: appConfig().environment === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    // Express counts maxAge in milliseconds; every lifetime in the config is
    // seconds, and handing it the seconds unconverted expired the cookie in a
    // thousandth of its configured life.
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearRefreshCookie(reply: Response): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}
