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

  it('leaves the same rows behind when it runs twice', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);
    const afterFirst = MODELS.map((model) => [model, db.rowsIn(model)]);

    await seedDemo(db as unknown as PrismaClient);
    const afterSecond = MODELS.map((model) => [model, db.rowsIn(model)]);

    expect(afterSecond).toEqual(afterFirst);
  });

  // `connect` would add a second link for a tag the product already carries.
  it('replaces a product’s tags on a repeat run rather than adding to them', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    for (const [{ update }] of db.product.upsert.mock.calls) {
      expect(Object.keys(update.tags as object)).toEqual(['set']);
    }
  });

  it('exercises the category, tag and review relations', async () => {
    const db = fakeDb();

    const counts = await seedDemo(db as unknown as PrismaClient);

    expect(counts.categories).toBeGreaterThan(1);
    expect(counts.tags).toBeGreaterThan(1);
    expect(counts.reviews).toBeGreaterThan(1);
    expect(counts.products).toBeGreaterThan(1);

    const product = db.product.upsert.mock.calls[0][0].create as {
      category: { connect: unknown };
      tags: { connect: unknown[] };
    };
    expect(product.category.connect).toBeDefined();
    expect(product.tags.connect.length).toBeGreaterThan(0);

    const review = db.review.upsert.mock.calls[0][0].create as {
      product: { connect: unknown };
    };
    expect(review.product.connect).toBeDefined();
  });
});
