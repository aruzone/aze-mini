import { catalogueFixtureName } from '../support/catalogue-namespace';
import axios from 'axios';
import { apiKey } from '../support/api-key';
import { anyStatus, asUser, registerUser } from '../support/users';

const withKey = { headers: { 'x-api-key': apiKey() }, ...anyStatus };

describe('request body validation', () => {
  it('refuses a body missing a required field, naming it', async () => {
    const res = await axios.post('/api/products', { price: 9.99 }, withKey);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.data.message)).toMatch(/name/);
  });

  it('refuses a field of the wrong type, naming it', async () => {
    const user = await registerUser();

    const res = await axios.post(
      '/api/categories',
      { name: 42 },
      asUser(user.accessToken),
    );

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.data.message)).toMatch(/name/);
  });

  // Binding a Prisma input to the body let a caller set any column. The id and
  // the timestamps are the database's to issue, and saying so is the point.
  it.each(['id', 'createdAt', 'updatedAt'])(
    'refuses the caller-supplied %s rather than passing it through',
    async (column) => {
      const user = await registerUser();

      const res = await axios.post(
        '/api/categories',
        { name: `Widgets ${randomUUID()}`, [column]: 'chosen by the caller' },
        asUser(user.accessToken),
      );

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.data.message)).toMatch(new RegExp(column));
    },
  );

  it('returns a structured body a caller can read the failures out of', async () => {
    const res = await axios.post('/api/products', {}, withKey);

    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({
      statusCode: 400,
      message: expect.any(Array),
    });
    expect(res.data.message.length).toBeGreaterThan(1);
  });

  it('accepts a body that matches the contract', async () => {
    const user = await registerUser();
    const category = await axios.post(
      '/api/categories',
      { name: catalogueFixtureName('Widgets') },
      asUser(user.accessToken),
    );

    const res = await axios.post(
      '/api/products',
      { name: catalogueFixtureName('Widget'), price: 9.99, categoryId: category.data.id },
      withKey,
    );

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ categoryId: category.data.id });
  });

  it('refuses a registration whose email is not one', async () => {
    const res = await axios.post(
      '/api/auth/register',
      { email: 'not-an-email', password: 'correct horse battery staple' },
      anyStatus,
    );

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.data.message)).toMatch(/email/);
  });
});
