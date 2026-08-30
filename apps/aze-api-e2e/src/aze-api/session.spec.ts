import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { anyStatus } from '../support/users';

const PASSWORD = 'correct horse battery staple';

/** The refresh cookie the API sets on a register or login, raw. */
function refreshCookieOf(res: { headers: Record<string, unknown> }): string | undefined {
  const setCookies = (res.headers['set-cookie'] ?? []) as string[];
  return setCookies
    .map((cookie) => cookie.split(';')[0])
    .find((pair) => pair.startsWith('aze_refresh='));
}

function withCookie(cookie: string) {
  return { headers: { cookie }, ...anyStatus };
}

// One User per spec file; the refresh family is this spec's to spend.
describe('the refresh session', () => {
  const email = `ada-${randomUUID()}@example.com`;
  let userId: string;
  let firstRefresh: string;

  it('registers and hands out a refresh cookie', async () => {
    const res = await axios.post('/api/auth/register', { email, password: PASSWORD });

    expect(res.status).toBe(201);
    userId = res.data.userId;
    firstRefresh = refreshCookieOf(res) as string;

    expect(firstRefresh).toMatch(/^aze_refresh=/);
  });

  it('exchanges the refresh cookie for a fresh access token', async () => {
    const res = await axios.post('/api/auth/refresh', undefined, withCookie(firstRefresh));

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ userId, email, accessToken: expect.any(String) });

    // Rotation: the presented cookie is replaced, not reused.
    const rotated = refreshCookieOf(res) as string;
    expect(rotated).toBeDefined();
    expect(rotated).not.toEqual(firstRefresh);

    // The old token is now a replay: it revokes the family it belongs to.
    const replay = await axios.post('/api/auth/refresh', undefined, withCookie(firstRefresh));
    expect(replay.status).toBe(401);

    // And the replay killed the rotated token too.
    const after = await axios.post('/api/auth/refresh', undefined, withCookie(rotated));
    expect(after.status).toBe(401);
  });

  it('refuses a refresh with no cookie at all', async () => {
    const res = await axios.post('/api/auth/refresh', undefined, anyStatus);
    expect(res.status).toBe(401);
  });

  it('revokes the family on logout and clears the cookie', async () => {
    const login = await axios.post('/api/auth/login', { email, password: PASSWORD });
    expect(login.status).toBe(200);
    const cookie = refreshCookieOf(login) as string;

    const logout = await axios.post('/api/auth/logout', undefined, withCookie(cookie));
    expect(logout.status).toBe(200);
    // Logout clears the cookie: a bare, empty aze_refresh with a past
    // expiry, which is how a browser is told to forget one.
    expect(refreshCookieOf(logout)).toMatch(/^aze_refresh=$/);

    const after = await axios.post('/api/auth/refresh', undefined, withCookie(cookie));
    expect(after.status).toBe(401);
  });

  // A reset that never happened must not be detectable through the answer.
  describe('forgot-password', () => {
    it('answers identically for a registered and an unregistered email', async () => {
      const registered = await axios.post(
        '/api/auth/forgot-password',
        { email },
        anyStatus,
      );
      const unregistered = await axios.post(
        '/api/auth/forgot-password',
        { email: `noone-${randomUUID()}@example.com` },
        anyStatus,
      );

      expect(registered.status).toBe(unregistered.status);
      expect(registered.data.message).toEqual(unregistered.data.message);
    });
  });
});
