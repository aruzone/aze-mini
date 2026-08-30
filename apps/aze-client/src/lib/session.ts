import { cookies } from 'next/headers';

/** The one name the access token is stored under, read by the middleware too. */
export const SESSION_COOKIE = 'aze_session';

/** The one name the refresh token is stored under. Same value the API sets. */
export const REFRESH_COOKIE = 'aze_refresh';

/** The access-token life, matching the API's `ACCESS_TOKEN_TTL_SECONDS` default. */
export const ACCESS_TOKEN_TTL_SECONDS = Number(
  process.env.AZE_ACCESS_TOKEN_TTL_SECONDS || 15 * 60,
);

/** The refresh-session life, matching the API's `REFRESH_TOKEN_TTL_SECONDS` default. */
export const REFRESH_TOKEN_TTL_SECONDS = Number(
  process.env.AZE_REFRESH_TOKEN_TTL_SECONDS || 30 * 24 * 60 * 60,
);

/**
 * How the access token is stored. `httpOnly` is the point of the whole
 * arrangement: browser script cannot read the cookie, so an injected script
 * cannot steal the credential, and every call to the API is made by the
 * server instead. The cookie now expires with the short-lived access token
 * (ADR-0009); the refresh cookie is what keeps the User signed in.
 */
export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    // No TLS on a local clone, so this follows the environment rather than
    // being pinned on — where it would stop the cookie being set at all.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  };
}

/**
 * The refresh token travels in its own httpOnly cookie, kept separate from the
 * session cookie. The path stays `/` because the middleware reads it on every
 * page request to refresh silently (ADR-0009) — but it is still httpOnly and
 * invisible to browser script, and it only ever leaves the server on its way
 * to the API's refresh and logout endpoints.
 */
export function refreshCookie(token: string) {
  return {
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  };
}

/** The access token this request carries, if it carries one. */
export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The refresh token this request carries, if it carries one. */
export async function currentRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function startSession(token: string, refreshToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(sessionCookie(token));
  jar.set(refreshCookie(refreshToken));
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
