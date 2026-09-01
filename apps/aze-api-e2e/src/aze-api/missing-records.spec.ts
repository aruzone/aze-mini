import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { apiKey } from '../support/api-key';
import { catalogueFixtureName } from '../support/catalogue-namespace';
import { createCategory as newCategory } from '../support/catalogue';
import { anyStatus, asUser, registerUser } from '../support/users';

const withKey = { headers: { 'x-api-key': apiKey() }, ...anyStatus };

// Nothing issues uuid v7s but the database, so these name rows that cannot exist.
const ABSENT_UUID = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';
const ABSENT_CATEGORY_ID = 999999;

const message = (data: unknown) => JSON.stringify((data as { message: unknown }).message);

// These specs need the User and the category name as well as the id, so they
// wrap the shared helper rather than calling it bare.
async function createCategory() {
  const user = await registerUser();
  const id = await newCategory(user.accessToken);
  const res = await axios.get(`/api/categories/${id}`, asUser(user.accessToken));
  return { id, name: res.data.name as string, user };
}

async function createProduct() {
  const category = await createCategory();
  const res = await axios.post(
    '/api/products',
    { name: catalogueFixtureName('Widget'), price: 9.99, categoryId: category.id },
    withKey,
  );
  return { id: res.data.id as string, category };
}

// A body that passes validation can still name a row that is not there. That is
// the caller's mistake, and answering 500 tells them the Starter is broken.
describe('a write naming a record that does not exist', () => {
  it('refuses a product whose category is absent, naming the id', async () => {
    const res = await axios.post(
      '/api/products',
      { name: `Widget ${randomUUID()}`, price: 9.99, categoryId: ABSENT_CATEGORY_ID },
      withKey,
    );

    expect(res.status).toBe(404);
    expect(message(res.data)).toMatch(new RegExp(String(ABSENT_CATEGORY_ID)));
  });

  it('refuses a product whose tag is absent, naming the id', async () => {
    const category = await createCategory();

    const res = await axios.post(
      '/api/products',
      {
        name: `Widget ${randomUUID()}`,
        price: 9.99,
        categoryId: category.id,
        tagIds: [ABSENT_UUID],
      },
      withKey,
    );

    expect(res.status).toBe(404);
    expect(message(res.data)).toMatch(ABSENT_UUID);
  });

  it('refuses a review of a product that is absent, naming the id', async () => {
    const user = await registerUser();

    const res = await axios.post(
      '/api/review',
      { rating: 5, productId: ABSENT_UUID },
      asUser(user.accessToken),
    );

    expect(res.status).toBe(404);
    expect(message(res.data)).toMatch(ABSENT_UUID);
  });

  it('refuses a tag linked to a product that is absent, naming the id', async () => {
    const user = await registerUser();

    const res = await axios.post(
      '/api/tag',
      { name: `seasonal ${randomUUID()}`, productIds: [ABSENT_UUID] },
      asUser(user.accessToken),
    );

    expect(res.status).toBe(404);
    expect(message(res.data)).toMatch(ABSENT_UUID);
  });

  // Here the ids the body names are all real; the missing row is the one the
  // route names, and the filter is what answers for it.
  it('refuses a patch of a product that is absent', async () => {
    const user = await registerUser();
    const category = await createCategory();

    const res = await axios.patch(
      `/api/products/${ABSENT_UUID}`,
      { categoryId: category.id },
      asUser(user.accessToken),
    );

    expect(res.status).toBe(404);
  });

  it('refuses a delete of a product that is absent', async () => {
    const user = await registerUser();

    const res = await axios.delete(`/api/products/${ABSENT_UUID}`, asUser(user.accessToken));

    expect(res.status).toBe(404);
  });

  // The duplicate is a conflict whether the caller is told so by the service,
  // as registration does, or by the filter reading the unique index.
  it('answers a duplicate category name with a conflict', async () => {
    const category = await createCategory();

    const res = await axios.post(
      '/api/categories',
      { name: category.name },
      asUser(category.user.accessToken),
    );

    expect(res.status).toBe(409);
    expect(message(res.data)).toMatch(/name/);
  });

  it('answers a duplicate registration with a conflict', async () => {
    const user = await registerUser();

    const res = await axios.post(
      '/api/auth/register',
      { email: user.email, password: user.password },
      anyStatus,
    );

    expect(res.status).toBe(409);
  });

  // The naming above happens in a catch, so a write that names real rows has to
  // keep working.
  it('still accepts a write whose relations all exist', async () => {
    const product = await createProduct();
    const user = await registerUser();

    const res = await axios.post(
      '/api/review',
      { rating: 5, productId: product.id },
      asUser(user.accessToken),
    );

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ productId: product.id });
  });
});
