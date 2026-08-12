import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { anyStatus, asUser } from '../support/users';

// Registered Users are left behind: the users resource is a current-User read
// only, so nothing here can delete one. Each run registers under a fresh uuid
// address, so runs never collide.
describe('registration and login', () => {
  const email = `ada-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';
  let userId: string;

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

  // That the users resource itself leaks no password is users.spec.ts's job;
  // what is asserted here is that the token registration issued reaches it.
  it('issues a token that identifies the registered User', async () => {
    const login = await axios.post('/api/auth/login', { email, password });

    const me = await axios.get('/api/users/me', asUser(login.data.accessToken));

    expect(me.status).toBe(200);
    expect(me.data).toMatchObject({ id: userId, email });
  });
});
