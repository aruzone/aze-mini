import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { anyStatus, registerUser } from '../support/users';

describe('the hardening every response inherits', () => {
  describe('security headers', () => {
    it('are on a route that answers JSON', async () => {
      const res = await axios.get('/api');

      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
    });

    // The refusal path goes through ApiExceptionFilter rather than a
    // controller, and a filter that wrote the response itself could have
    // skipped everything the middleware put on it.
    it('are on a refusal as well as an answer', async () => {
      const res = await axios.get('/api/users/me', anyStatus);

      expect(res.status).toBe(401);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('say nothing about what is serving them', async () => {
      const res = await axios.get('/api');

      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    // Nothing the API returns is meant to be rendered inside someone's frame.
    it('refuse to be framed', async () => {
      const res = await axios.get('/api');

      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });
    // Swagger registers its own Express route. Headers added after it never
    // reach the page — and it is the only response here a browser renders.
    it('are on the documentation page, not only the JSON routes', async () => {
      const res = await axios.get('/api/docs');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    // Swagger UI is built from inline script, so that page alone gets a policy
    // permitting it. The document beside it is JSON and gets no such licence.
    it('relax for the page that renders, and nothing else', async () => {
      const page = await axios.get('/api/docs');
      const document = await axios.get('/api/docs-json');

      expect(page.headers['content-security-policy']).toContain("'unsafe-inline'");
      expect(document.headers['content-security-policy']).not.toContain("'unsafe-inline'");
    });
  });

  describe('the allowed origin', () => {
    // The docs page is a browser client of this API like any other, and it is
    // registered after the CORS middleware for exactly that reason.
    it('reaches the documentation page too', async () => {
      const res = await axios.get('/api/docs', {
        headers: { origin: 'http://localhost:3000' },
      });

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    // The default is the client a local clone starts, and the e2e suite runs
    // against a clone that configured nothing.
    it('lets the client the Starter ships call the API', async () => {
      const res = await axios.get('/api', {
        headers: { origin: 'http://localhost:3000' },
      });

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('does not answer an origin nobody allowed', async () => {
      const res = await axios.get('/api', {
        headers: { origin: 'https://not-the-client.example.com' },
      });

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // Guessing a password is cheap, and without this nothing would slow it down.
  // The count is per source *and* User, so exhausting one User's budget here
  // leaves every other spec in this suite — which shares this source address —
  // able to sign in.
  describe('failed sign-ins', () => {
    const guessAt = (email: string) =>
      axios.post('/api/auth/login', { email, password: 'not the password' }, anyStatus);

    it('are refused once there have been too many against one User', async () => {
      const user = await registerUser();

      const statuses: number[] = [];
      for (let attempt = 0; attempt < 7; attempt++) {
        statuses.push((await guessAt(user.email)).status);
      }

      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses.at(-1)).toBe(429);
    });

    // The refusal has to say how long, or a caller can only poll to find out.
    it('say how long the wait is', async () => {
      const user = await registerUser();
      let refusal = await guessAt(user.email);
      while (refusal.status !== 429) {
        refusal = await guessAt(user.email);
      }

      expect(refusal.data.message).toMatch(/try again in \d+ seconds?/i);
    });

    // A User locked out from one source must still be able to sign in, or
    // anyone could deny anyone else their own account by guessing badly.
    it('leave the User able to sign in from anywhere else', async () => {
      const user = await registerUser();
      for (let attempt = 0; attempt < 6; attempt++) {
        await guessAt(user.email);
      }

      const elsewhere = await axios.post(
        '/api/auth/login',
        { email: user.email, password: user.password },
        { ...anyStatus, headers: { 'x-forwarded-for': `198.51.100.${randomUUID().charCodeAt(0) % 200}` } },
      );

      // TRUST_PROXY is unset here, so the header is ignored and this is the
      // same source — which is the point: an unconfigured API must not let a
      // caller pick their own identity.
      expect(elsewhere.status).toBe(429);
    });
  });
});
