import { SESSION_COOKIE, sessionCookie } from './session';

describe('the session cookie', () => {
  it('is not readable by browser script', () => {
    expect(sessionCookie('a-token').httpOnly).toBe(true);
  });

  // The token the API issues lasts a day (AuthService). A cookie outliving it
  // leaves a User looking signed in until the first call fails with a 401.
  it('expires no later than the token inside it', () => {
    expect(sessionCookie('a-token').maxAge).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it('is withheld from requests a third-party site initiates', () => {
    expect(sessionCookie('a-token').sameSite).toBe('lax');
  });

  it('carries the token under one known name', () => {
    expect(sessionCookie('a-token')).toMatchObject({
      name: SESSION_COOKIE,
      value: 'a-token',
    });
  });

  // Everything above is undone by sending the cookie over plain HTTP, but a
  // local clone has no TLS, so `secure` follows the environment rather than
  // being pinned either way.
  it('is confined to HTTPS outside development', () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(sessionCookie('a-token').secure).toBe(true);
      process.env.NODE_ENV = 'development';
      expect(sessionCookie('a-token').secure).toBe(false);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
