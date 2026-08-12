import { randomUUID } from 'node:crypto';
import axios from 'axios';

const anyStatus = { validateStatus: () => true };

// Registration is the only way an account comes into existence, so the uuid
// under test is one the database issued rather than one this spec invented.
async function registerUser() {
  const email = `ada-${randomUUID()}@example.com`;
  const res = await axios.post('/api/auth/register', {
    email,
    password: 'correct horse battery staple',
    name: 'Ada',
  });
  return { id: res.data.userId as string, email };
}

// A uuid coerced numerically reaches the database as "NaN" and matches nothing,
// so each of these routes answers about a User that was found by its real id.
describe('reaching a User by uuid', () => {
  it('fetches a User by uuid', async () => {
    const user = await registerUser();

    const res = await axios.get(`/api/users/${user.id}`, anyStatus);

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: user.id, email: user.email });

    await axios.delete(`/api/users/${user.id}`, anyStatus);
  });

  it('updates a User by uuid', async () => {
    const user = await registerUser();

    const res = await axios.patch(
      `/api/users/${user.id}`,
      { name: 'Ada Lovelace' },
      anyStatus,
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ id: user.id, name: 'Ada Lovelace' });

    await axios.delete(`/api/users/${user.id}`, anyStatus);
  });

  it('deletes a User by uuid', async () => {
    const user = await registerUser();

    const deleted = await axios.delete(`/api/users/${user.id}`, anyStatus);
    expect(deleted.status).toBe(200);

    const afterwards = await axios.get(`/api/users/${user.id}`, anyStatus);
    expect(afterwards.data).toBeFalsy();
  });
});
