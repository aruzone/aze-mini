import { cookies } from 'next/headers';

/** The one name the token is stored under, read by the middleware too. */
export const SESSION_COOKIE = 'aze_session';

/**
 * A day, matching the expiry AuthService signs into the token. A cookie that
 * outlived the token would leave a User looking signed in right up until the
 * first call came back 401.
 */
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * How the token is stored. `httpOnly` is the point of the whole arrangement:
 * browser script cannot read the cookie, so an injected script cannot steal the
 * credential, and every call to the API is made by the server instead.
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
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** The token this request carries, if it carries one. */
export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function startSession(token: string): Promise<void> {
  (await cookies()).set(sessionCookie(token));
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
