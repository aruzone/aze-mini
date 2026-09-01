import { compare } from 'bcryptjs';
import { PrismaClient } from '../generated/prisma';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from './seed';

/**
 * A fake that models what upsert means: rows live in a table keyed by the
 * `where` clause, so a second write against the same key replaces the first
 * and a write against a fresh key adds a row.
 *
 * That is what makes "re-running is safe" a claim this spec could disprove —
 * a seed that inserted blind, or keyed on something generated, would double
 * its row counts on the second run rather than leaving them alone.
 */
function fakeDb() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  let nextNumericId = 1;

  const table = (name: string) => {
    const existing = tables.get(name);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Record<string, unknown>>();
    tables.set(name, created);
    return created;
  };

  const model = (name: string, id: (create: Record<string, unknown>) => unknown) => ({
    upsert: jest.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const rows = table(name);
        const key = JSON.stringify(where);
        const found = rows.get(key);
        const row = found ? { ...found, ...update } : { ...create, id: id(create) };
        rows.set(key, row);
        return row;
      },
    ),
  });

  return {
    rowsIn: (name: string) => table(name).size,
    user: model('user', (create) => create.id),
    productCategory: model('productCategory', () => nextNumericId++),
    tag: model('tag', (create) => `tag-${create.name}`),
    product: model('product', (create) => create.id),
    review: model('review', (create) => create.id),
  };
}

const MODELS = ['user', 'productCategory', 'tag', 'product', 'review'];

function relationIds(value: unknown, operation: 'connect' | 'set') {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected a ${operation} relation`);
  }
  let ids: unknown;
  if (operation === 'connect' && 'connect' in value) {
    ids = value.connect;
  }
  if (operation === 'set' && 'set' in value) {
    ids = value.set;
  }
  if (!Array.isArray(ids)) {
    throw new Error(`Expected ${operation} to contain relation ids`);
  }
  return ids;
}

describe('the Demo seed', () => {
  it('stores a hash of the demo password, never the password itself', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    const stored = db.user.upsert.mock.calls[0][0].create.password as string;
    expect(stored).not.toBe(DEMO_PASSWORD);
    expect(await compare(DEMO_PASSWORD, stored)).toBe(true);
  });

  it('creates the User the printed credentials describe', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    expect(db.user.upsert.mock.calls[0][0].where).toEqual({ email: DEMO_EMAIL });
    expect(db.rowsIn('user')).toBe(1);
  });

  it('seeds a cohesive workspace catalogue with exact relationship totals', async () => {
    const db = fakeDb();

    const counts = await seedDemo(db as unknown as PrismaClient);

    expect(counts).toEqual({ categories: 5, tags: 8, products: 8, reviews: 10 });
    expect(
      db.productCategory.upsert.mock.calls.map(([{ create }]) => create.name),
    ).toEqual(['Stationery', 'Lighting', 'Workspace', 'Organization', 'Workday Carry']);
    expect(db.tag.upsert.mock.calls.map(([{ create }]) => create.name)).toEqual([
      'paper',
      'everyday',
      'portable',
      'focused-work',
      'lighting',
      'adjustable',
      'natural-materials',
      'organization',
    ]);

    const products = db.product.upsert.mock.calls.map(
      ([{ create }]) =>
        create as {
          id: string;
          name: string;
          description: string;
          price: number;
          tags: { connect: Array<{ id: string }> };
        },
    );
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Field Notebook',
          description: 'Lay-flat dot grid pages with a linen-wrapped cover.',
          price: 18,
        }),
        expect.objectContaining({
          name: 'Arc Task Lamp',
          description: 'Dimmable warm-to-cool light with a compact weighted base.',
          price: 129,
        }),
        expect.objectContaining({
          name: 'Commuter Tech Pouch',
          description: 'A structured recycled-canvas case for chargers, pens and adapters.',
          price: 48,
        }),
      ]),
    );

    const tagLinks = products.flatMap((product) => product.tags.connect);
    expect(tagLinks).toHaveLength(22);
    expect(tagLinks.filter(({ id }) => id === 'tag-everyday')).toHaveLength(5);

    const reviews = db.review.upsert.mock.calls.map(
      ([{ create }]) =>
        create as {
          id: string;
          rating: number;
          comment: string;
          product: { connect: { id: string } };
        },
    );
    const reviewedProductIds = new Set(reviews.map((review) => review.product.connect.id));
    const cableDock = products.find((product) => product.name === 'Cable Dock Set');
    if (!cableDock) {
      throw new Error('Expected the catalogue to include Cable Dock Set');
    }
    expect(reviewedProductIds.has(cableDock.id)).toBe(false);

    const reviewById = new Map(reviews.map((review) => [review.id, review]));
    expect(reviewById.get('0195f0e1-0000-7000-8000-000000000201')).toEqual(
      expect.objectContaining({
        rating: 5,
        comment: 'The binding stays flat through a full page of notes.',
      }),
    );
    expect(
      reviewById.get('0195f0e1-0000-7000-8000-000000000203')?.product.connect.id,
    ).toBe('0195f0e1-0000-7000-8000-000000000102');
    expect(
      reviewById.get('0195f0e1-0000-7000-8000-000000000210')?.product.connect.id,
    ).toBe('0195f0e1-0000-7000-8000-000000000108');
  });

  it('leaves the same rows and relationships behind when it runs twice', async () => {
    const db = fakeDb();

    const firstCounts = await seedDemo(db as unknown as PrismaClient);
    const firstRows = Object.fromEntries(MODELS.map((model) => [model, db.rowsIn(model)]));
    const firstProductCalls = db.product.upsert.mock.calls.slice();
    const firstReviewCalls = db.review.upsert.mock.calls.slice();

    const secondCounts = await seedDemo(db as unknown as PrismaClient);
    const secondRows = Object.fromEntries(MODELS.map((model) => [model, db.rowsIn(model)]));
    const repeatedProductCalls = db.product.upsert.mock.calls.slice(firstProductCalls.length);
    const repeatedReviewCalls = db.review.upsert.mock.calls.slice(firstReviewCalls.length);

    expect(firstRows).toEqual({
      user: 1,
      productCategory: 5,
      tag: 8,
      product: 8,
      review: 10,
    });
    expect(secondCounts).toEqual(firstCounts);
    expect(secondRows).toEqual(firstRows);

    expect(
      repeatedProductCalls.map(([{ where, update }]) => ({
        where,
        category: update.category,
        tags: relationIds(update.tags, 'set'),
      })),
    ).toEqual(
      firstProductCalls.map(([{ where, create }]) => ({
        where,
        category: create.category,
        tags: relationIds(create.tags, 'connect'),
      })),
    );

    expect(
      repeatedReviewCalls.map(([{ where, update }]) => ({
        where,
        product: update.product,
      })),
    ).toEqual(
      firstReviewCalls.map(([{ where, create }]) => ({
        where,
        product: create.product,
      })),
    );
  });
});
