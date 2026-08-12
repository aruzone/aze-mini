import axios from 'axios';
import { anyStatus, registerUser } from '../support/users';

// These calls carry no token because nothing guards the users resource yet —
// that is ADR-0002's job, tracked in #5. Expect to add tokens when the guard
// lands; what is asserted here is only that each route reaches the User whose
// uuid it was given.
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
    expect(deleted.data).toMatchObject({ id: user.id });

    const afterwards = await axios.get(`/api/users/${user.id}`, anyStatus);
    expect(afterwards.status).toBe(200);
    expect(afterwards.data).toBeFalsy();
  });
});
