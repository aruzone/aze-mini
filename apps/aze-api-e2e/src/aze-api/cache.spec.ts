import axios, { AxiosResponse } from 'axios';
import { createCatalogueProduct } from '../support/catalogue';
import { asUser, registerUser } from '../support/users';

const cacheHeader = (res: AxiosResponse) => res.headers['x-cache'];

/**
 * Reads a list twice and answers with the second read.
 *
 * Every list key hangs off one generation, which any product written anywhere
 * in this suite forgets. The suite runs one spec file at a time for that
 * reason, and this loop covers what serialising cannot: a write from outside
 * the suite entirely.
 */
async function readListTwice(query: string, token: string): Promise<AxiosResponse> {
  let second = await axios.get(query, asUser(token));

  for (let attempt = 0; attempt < 5 && cacheHeader(second) !== 'HIT'; attempt++) {
    await axios.get(query, asUser(token));
    second = await axios.get(query, asUser(token));
  }

  return second;
}

// The claim is that a repeated read is served from Redis rather than Postgres.
// That is only worth making if a caller can see it, so the cached routes say
// which of the two answered them.
describe('the cached read path', () => {
  let token: string;

  beforeAll(async () => {
    token = (await registerUser()).accessToken;
  });

  it('serves a second read of the same product from the cache', async () => {
    const id = await createCatalogueProduct(token);

    const first = await axios.get(`/api/products/${id}`, asUser(token));
    const second = await axios.get(`/api/products/${id}`, asUser(token));

    expect(cacheHeader(first)).toBe('MISS');
    expect(cacheHeader(second)).toBe('HIT');
    expect(second.data).toEqual(first.data);
  });

  it('serves a second read of the same list from the cache', async () => {
    const second = await readListTwice('/api/products?sort=asc&limit=5', token);

    expect(cacheHeader(second)).toBe('HIT');
  });

  // A cache that is not invalidated is worse than no cache: it answers with a
  // price that is no longer the price.
  it('forgets a product the moment it changes', async () => {
    const id = await createCatalogueProduct(token);
    await axios.get(`/api/products/${id}`, asUser(token));

    const updated = await axios.patch(`/api/products/${id}`, { price: 19.99 }, asUser(token));
    expect(updated.status).toBe(200);

    const afterWrite = await axios.get(`/api/products/${id}`, asUser(token));

    expect(cacheHeader(afterWrite)).toBe('MISS');
    expect(afterWrite.data.price).toBe(19.99);
  });

  it('forgets a product that has been deleted', async () => {
    const id = await createCatalogueProduct(token);
    await axios.get(`/api/products/${id}`, asUser(token));

    await axios.delete(`/api/products/${id}`, asUser(token));
    const afterDelete = await axios.get(`/api/products/${id}`, asUser(token));

    expect(afterDelete.status).toBe(404);
  });

  // Lists are keyed by sort and limit, so a write cannot name the keys it
  // invalidates. Every one of them has to go, whichever was asked for.
  it('forgets every list, whatever it was sorted and limited by', async () => {
    expect(cacheHeader(await readListTwice('/api/products?sort=desc&limit=3', token))).toBe('HIT');

    await createCatalogueProduct(token);

    const afterWrite = await axios.get('/api/products?sort=desc&limit=3', asUser(token));
    expect(cacheHeader(afterWrite)).toBe('MISS');
  });

  it('caches nothing about a product that does not exist', async () => {
    const absent = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';

    const first = await axios.get(`/api/products/${absent}`, asUser(token));
    const second = await axios.get(`/api/products/${absent}`, asUser(token));

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(cacheHeader(second)).toBeUndefined();
  });
});
