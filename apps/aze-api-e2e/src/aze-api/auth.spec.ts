import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { anyStatus } from '../support/users';

describe('registration and login', () => {
  const email = `ada-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await axios.delete(`/api/users/${userId}`, anyStatus);
    }
  });

  it('registers a visitor without a token and returns no password', async () => {
    const res = await axios.post('/api/auth/register', { email, password, name: 'Ada' });

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ email, accessToken: expect.any(String) });
    expect(res.data.password).toBeUndefined();

    userId = res.data.userId;
    expect(userId).toEqual(expect.any(String));
  });

  it('logs the registered User in against the stored hash', async () => {
    const res = await axios.post('/api/auth/login', { email, password });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ userId, email, accessToken: expect.any(String) });
    expect(res.data.password).toBeUndefined();
  });

  it('logs in with the email in any case it was typed', async () => {
    const res = await axios.post('/api/auth/login', {
      email: email.toUpperCase(),
      password,
    });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ userId });
  });

  it.each([
    ['no password', { email: `noone-${randomUUID()}@example.com` }],
    ['no email', { password }],
  ])('rejects a registration with %s', async (_case, body) => {
    const res = await axios.post('/api/auth/register', body, anyStatus);

    expect(res.status).toBe(400);
  });

  // A 500 here would say the email is registered; an unregistered one 400s.
  it('rejects a login with no password without revealing whether the email exists', async () => {
    const registered = await axios.post('/api/auth/login', { email }, anyStatus);
    const unregistered = await axios.post(
      '/api/auth/login',
      { email: `noone-${randomUUID()}@example.com` },
      anyStatus,
    );

    expect(registered.status).toBe(400);
    expect(unregistered.status).toBe(400);
  });

  it('rejects the wrong password', async () => {
    const res = await axios.post(
      '/api/auth/login',
      { email, password: 'wrong horse' },
      anyStatus,
    );

    expect(res.status).toBe(401);
  });

  it('rejects an email that is already registered', async () => {
    const res = await axios.post(
      '/api/auth/register',
      { email, password: 'another one' },
      anyStatus,
    );

    expect(res.status).toBe(409);
    expect(res.data.message).toMatch(/already registered/i);
  });

  it('offers no way to create an account through the users resource', async () => {
    const res = await axios.post(
      '/api/users',
      { email: `mallory-${randomUUID()}@example.com`, password: 'plain text' },
      anyStatus,
    );

    expect(res.status).toBe(404);
  });

  // These calls carry no token because nothing guards the users resource yet —
  // that is ADR-0002's job, tracked in #5. What is asserted here is only that
  // no password crosses the wire; expect to add tokens when the guard lands.
  it('never returns the password field from the users resource', async () => {
    const list = await axios.get('/api/users');
    expect(list.status).toBe(200);
    expect(list.data.length).toBeGreaterThan(0);
    for (const user of list.data) {
      expect(user.password).toBeUndefined();
    }

    const one = await axios.get(`/api/users/${userId}`);
    expect(one.data).toMatchObject({ id: userId, email });
    expect(one.data.password).toBeUndefined();

    const patched = await axios.patch(`/api/users/${userId}`, {
      name: 'Ada Lovelace',
      password: 'plain text',
    });
    expect(patched.data).toMatchObject({ name: 'Ada Lovelace' });
    expect(patched.data.password).toBeUndefined();
  });

  it('leaves the password unchanged when the users resource is asked to set one', async () => {
    const res = await axios.post('/api/auth/login', { email, password });

    expect(res.status).toBe(200);
  });
});
