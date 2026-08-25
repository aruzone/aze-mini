import axios from 'axios';
import { createCatalogueProduct, createCategory, createProduct } from '../support/catalogue';
import { asUser, registerUser } from '../support/users';

const message = (data: unknown) => JSON.stringify((data as { message: unknown }).message);

// Every relation is RESTRICT, so the database turns these deletes down. The
// caller asked for something the schema forbids, which is their mistake to fix
// and so a 4xx — not the 500 a raw driver refusal would reach them as.
describe('deleting a row other rows still point at', () => {
  it('refuses to delete a category a product still belongs to', async () => {
    const user = await registerUser();
    const categoryId = await createCategory(user.accessToken);
    await createProduct(categoryId);

    const res = await axios.delete(`/api/categories/${categoryId}`, asUser(user.accessToken));

    expect(res.status).toBe(409);
    expect(message(res.data)).toMatch(/1 product/);
  });

  it('refuses to delete a product a review still points at', async () => {
    const user = await registerUser();
    const productId = await createCatalogueProduct(user.accessToken);
    await axios.post('/api/review', { rating: 5, productId }, asUser(user.accessToken));

    const res = await axios.delete(`/api/products/${productId}`, asUser(user.accessToken));

    expect(res.status).toBe(409);
    expect(message(res.data)).toMatch(/1 review/);
  });

  it('deletes a category no product belongs to', async () => {
    const user = await registerUser();
    const categoryId = await createCategory(user.accessToken);

    const res = await axios.delete(`/api/categories/${categoryId}`, asUser(user.accessToken));

    expect(res.status).toBe(200);
  });

  // The refusal is about what points at the row now, not about what ever did,
  // so clearing the way has to make the same delete succeed.
  it('deletes the category once its products are gone', async () => {
    const user = await registerUser();
    const categoryId = await createCategory(user.accessToken);
    const productId = await createProduct(categoryId);

    const refused = await axios.delete(`/api/categories/${categoryId}`, asUser(user.accessToken));
    expect(refused.status).toBe(409);

    await axios.delete(`/api/products/${productId}`, asUser(user.accessToken));
    const res = await axios.delete(`/api/categories/${categoryId}`, asUser(user.accessToken));

    expect(res.status).toBe(200);
  });
});
