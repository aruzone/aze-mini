import axios from 'axios';
import { anyStatus, asUser, registerUser } from '../support/users';

describe('the current User', () => {
  it('reads the User the token identifies', async () => {
    const user = await registerUser();

    const res = await axios.get('/api/users/me', asUser(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: user.id, email: user.email });
  });

  it('never returns the password field', async () => {
    const user = await registerUser();

    const res = await axios.get('/api/users/me', asUser(user.accessToken));

    expect(res.data.password).toBeUndefined();
  });

  it('offers no route to another User', async () => {
    const user = await registerUser();
    const other = await registerUser();

    const byId = await axios.get(`/api/users/${other.id}`, asUser(user.accessToken));
    const all = await axios.get('/api/users', asUser(user.accessToken));

    expect(byId.status).toBe(404);
    expect(all.status).toBe(404);
  });

  it('offers no way to register a User through the users resource', async () => {
    const res = await axios.post(
      '/api/users',
      { email: 'mallory@example.com', password: 'plain text' },
      anyStatus,
    );

    expect(res.status).toBe(404);
  });
});
