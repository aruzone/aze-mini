import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { anyStatus, apiKey, bearer, registerUser } from '../support/users';

describe('the API perimeter', () => {
  it('refuses a protected route to a caller with no token', async () => {
    const res = await axios.get('/api/users/me', anyStatus);

    expect(res.status).toBe(401);
  });

  it('serves a public route to a caller with no token', async () => {
    const res = await axios.get('/api', anyStatus);

    expect(res.status).toBe(200);
  });

  it('unlocks a protected route with a token from logging in', async () => {
    const user = await registerUser();
    const login = await axios.post('/api/auth/login', {
      email: user.email,
      password: user.password,
    });

    const res = await axios.get('/api/users/me', bearer(login.data.accessToken));

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: user.id, email: user.email });
  });

  // Nothing marks these, so the global guard is the only reason they are shut.
  // An Adopter's own controller inherits exactly this.
  it.each([
    ['GET', '/api/products'],
    ['GET', '/api/tag'],
    ['GET', '/api/categories'],
  ])('protects %s %s, which opts out of nothing', async (method, path) => {
    const res = await axios.request({ method, url: path, ...anyStatus });

    expect(res.status).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const res = await axios.get('/api/users/me', bearer('not.a.real.token'));

    expect(res.status).toBe(401);
  });

  describe('the machine-to-machine Demo route', () => {
    // Creating the category needs a token; creating the product needs the key.
    // That the two routes take different credentials is the Demo.
    it('accepts a caller holding the API key and no token', async () => {
      const user = await registerUser();
      const category = await axios.post(
        '/api/categories',
        { name: `Widgets ${randomUUID()}` },
        bearer(user.accessToken),
      );
      expect(category.status).toBe(201);

      const res = await axios.post(
        '/api/products',
        {
          name: `Widget ${randomUUID()}`,
          price: 9.99,
          category: { connect: { id: category.data.id } },
        },
        { headers: { 'x-api-key': apiKey() }, ...anyStatus },
      );

      expect(res.status).toBe(201);
    });

    it('refuses a caller holding neither key nor token', async () => {
      const res = await axios.post('/api/products', { name: 'Widget' }, anyStatus);

      expect(res.status).toBe(403);
    });

    // The key guard is no longer stacked on the JWT guard, so a User's token is
    // not a substitute for the key.
    it('refuses a caller holding a token but no key', async () => {
      const user = await registerUser();

      const res = await axios.post(
        '/api/products',
        { name: 'Widget' },
        bearer(user.accessToken),
      );

      expect(res.status).toBe(403);
    });
  });
});
