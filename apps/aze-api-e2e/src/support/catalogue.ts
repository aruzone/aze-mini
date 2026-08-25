import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { apiKey } from './api-key';
import { anyStatus, asUser } from './users';

/**
 * Creating catalogue rows is the setup nearly every spec here shares, and the
 * names have to be unique because the suite keeps the database it is given.
 * `POST /products` is the machine-to-machine route, so it is the one call that
 * offers the key rather than a token.
 */
const withKey = { headers: { 'x-api-key': apiKey() }, ...anyStatus };

export async function createCategory(accessToken: string): Promise<number> {
  const res = await axios.post(
    '/api/categories',
    { name: `Widgets ${randomUUID()}` },
    asUser(accessToken),
  );
  return res.data.id as number;
}

export async function createProduct(categoryId: number): Promise<string> {
  const res = await axios.post(
    '/api/products',
    { name: `Widget ${randomUUID()}`, price: 9.99, categoryId },
    withKey,
  );
  return res.data.id as string;
}

/** A product under a category of its own, for specs that need neither named. */
export async function createCatalogueProduct(accessToken: string): Promise<string> {
  return createProduct(await createCategory(accessToken));
}
