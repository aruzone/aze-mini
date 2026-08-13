import { compare } from 'bcryptjs';
import { PrismaClient } from '../generated/prisma';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from './seed';

// Enough of a Prisma client to record what the seed asked for. Every write is
// an upsert, so recording the calls is enough to say whether a second run
// would duplicate anything.
function fakeDb() {
  const calls: { model: string; args: { where: unknown; create?: { name?: string } } }[] = [];
  const model = (name: string, row: (args: { create?: { name?: string } }) => unknown) => ({
    upsert: jest.fn(async (args) => {
      calls.push({ model: name, args });
      return row(args);
    }),
  });

  return {
    calls,
    user: model('user', () => ({ id: 'user-1', email: DEMO_EMAIL })),
    productCategory: model('productCategory', (args) => ({
      id: 1,
      name: args.create?.name,
    })),
    tag: model('tag', (args) => ({ id: `tag-${args.create?.name}`, name: args.create?.name })),
    product: model('product', () => ({ id: 'product-1' })),
    review: model('review', () => ({ id: 'review-1' })),
  };
}

describe('the Demo seed', () => {
  it('stores a hash of the demo password, never the password itself', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    const stored = db.user.upsert.mock.calls[0][0].create.password;
    expect(stored).not.toBe(DEMO_PASSWORD);
    expect(await compare(DEMO_PASSWORD, stored)).toBe(true);
  });

  it('creates the User the printed credentials describe', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    expect(db.user.upsert.mock.calls[0][0].where).toEqual({ email: DEMO_EMAIL });
  });

  // Re-running must leave the same rows, so every write is keyed on something
  // stable rather than inserting blind.
  it('writes every record against a stable key', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    expect(db.calls.length).toBeGreaterThan(0);
    for (const { model, args } of db.calls) {
      expect([model, args.where]).not.toEqual([model, undefined]);
      expect([model, Object.keys(args.where as object).length]).toEqual([model, 1]);
    }
  });

  it('never re-hashes into a second User on a repeat run', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);
    await seedDemo(db as unknown as PrismaClient);

    const [first, second] = db.user.upsert.mock.calls.map((call) => call[0].where);
    expect(first).toEqual(second);
    expect(db.user.upsert).toHaveBeenCalledTimes(2);
  });

  it('replaces a product’s tags on a repeat run rather than adding to them', async () => {
    const db = fakeDb();

    await seedDemo(db as unknown as PrismaClient);

    for (const call of db.product.upsert.mock.calls) {
      const { update } = call[0];
      if (update.tags) {
        expect(Object.keys(update.tags)).toEqual(['set']);
      }
    }
  });

  it('exercises the category, tag and review relations', async () => {
    const db = fakeDb();

    const counts = await seedDemo(db as unknown as PrismaClient);

    expect(counts.categories).toBeGreaterThan(1);
    expect(counts.tags).toBeGreaterThan(1);
    expect(counts.reviews).toBeGreaterThan(1);
    expect(counts.products).toBeGreaterThan(1);

    const product = db.product.upsert.mock.calls[0][0].create;
    expect(product.category.connect).toBeDefined();
    expect(product.tags.connect.length).toBeGreaterThan(0);
    expect(db.review.upsert.mock.calls[0][0].create.product.connect).toBeDefined();
  });
});
