import axios from 'axios';
import { anyStatus, bearer, registerUser } from '../support/users';

describe('the current User', () => {
  it('reads the User the token identifies', async () => {
    const user = await registerUser();

    const res = await axios.get('/api/users/me', bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: user.id, email: user.email });
  });

  // The uuid comes off the token and goes to the database as it stands;
  // coercing it numerically would ask for "NaN" and match nothing.
  it('resolves the uuid the token carries, not a coercion of it', async () => {
    const user = await registerUser();

    const res = await axios.get('/api/users/me', bearer(user.accessToken));

    expect(res.data.id).toBe(user.id);
    expect(res.data.id).not.toBe('NaN');
  });

  it('never returns the password field', async () => {
    const user = await registerUser();

    const res = await axios.get('/api/users/me', bearer(user.accessToken));

    expect(res.data.password).toBeUndefined();
  });

  it('offers no route to another User', async () => {
    const user = await registerUser();
    const other = await registerUser();

    const byId = await axios.get(`/api/users/${other.id}`, bearer(user.accessToken));
    const all = await axios.get('/api/users', bearer(user.accessToken));

    expect(byId.status).toBe(404);
    expect(all.status).toBe(404);
  });

  it('offers no way to create an account through the users resource', async () => {
    const res = await axios.post(
      '/api/users',
      { email: 'mallory@example.com', password: 'plain text' },
      anyStatus,
    );

    expect(res.status).toBe(404);
  });
});
