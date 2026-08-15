import { PrismaClient } from '../generated/prisma';
import { hashPassword } from '../src/auth/password';

/**
 * Demo — see docs/demo.md.
 *
 * Every record carries a fixed id or a unique name and is written with upsert,
 * so running the seed twice leaves the same rows rather than a second copy.
 *
 * The fixed ids are ordinary uuid7s whose timestamp is a moment already past
 * (2025-04-01), so no id generated from now on can collide with one. They
 * number by kind: 1 the User, 1xx products, 2xx reviews.
 */

export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_PASSWORD = 'demo-password-change-me';

const DEMO_USER_ID = '0195f0e1-0000-7000-8000-000000000001';

const PRODUCTS = [
  {
    id: '0195f0e1-0000-7000-8000-000000000101',
    name: 'Field Notebook',
    description: 'Pocket sized, squared paper',
    price: 12.5,
    category: 'Stationery',
    tags: ['paper', 'everyday'],
    reviews: [
      { id: '0195f0e1-0000-7000-8000-000000000201', rating: 5, comment: 'Survives a rucksack' },
      { id: '0195f0e1-0000-7000-8000-000000000202', rating: 4, comment: 'Wish it were A5' },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000102',
    name: 'Fountain Pen',
    description: 'Medium nib, converter filled',
    price: 45,
    category: 'Stationery',
    tags: ['everyday'],
    reviews: [
      { id: '0195f0e1-0000-7000-8000-000000000203', rating: 5, comment: 'Writes wet, dries fast' },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000103',
    name: 'Desk Lamp',
    description: 'Warm LED, weighted base',
    price: 89.99,
    category: 'Workspace',
    tags: ['lighting'],
    reviews: [],
  },
];

export async function seedDemo(db: PrismaClient) {
  // The password is rewritten, not left alone: the seed prints these
  // credentials as fact, and an existing Demo User whose password had been
  // changed would make that a lie.
  const password = await hashPassword(DEMO_PASSWORD);
  await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Demo User', password },
    create: { id: DEMO_USER_ID, email: DEMO_EMAIL, name: 'Demo User', password },
  });

  const categoryNames = [...new Set(PRODUCTS.map((product) => product.category))];
  const categories = new Map<string, number>();
  for (const name of categoryNames) {
    const category = await db.productCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories.set(name, category.id);
  }

  const tagNames = [...new Set(PRODUCTS.flatMap((product) => product.tags))];
  const tags = new Map<string, string>();
  for (const name of tagNames) {
    const tag = await db.tag.upsert({ where: { name }, update: {}, create: { name } });
    tags.set(name, tag.id);
  }

  for (const product of PRODUCTS) {
    const connectTags = product.tags.map((name) => ({ id: tags.get(name) }));
    const fields = {
      name: product.name,
      description: product.description,
      price: product.price,
      category: { connect: { id: categories.get(product.category) } },
    };

    await db.product.upsert({
      where: { id: product.id },
      // `set` rather than `connect`, so a re-run leaves one link per tag.
      update: { ...fields, tags: { set: connectTags } },
      create: { id: product.id, ...fields, tags: { connect: connectTags } },
    });

    for (const review of product.reviews) {
      await db.review.upsert({
        where: { id: review.id },
        update: { rating: review.rating, comment: review.comment },
        create: {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          product: { connect: { id: product.id } },
        },
      });
    }
  }

  return {
    categories: categories.size,
    tags: tags.size,
    products: PRODUCTS.length,
    reviews: PRODUCTS.reduce((total, product) => total + product.reviews.length, 0),
  };
}

async function main() {
  const db = new PrismaClient();
  try {
    const counts = await seedDemo(db);
    console.log(
      `Seeded ${counts.products} products across ${counts.categories} categories, ` +
        `${counts.tags} tags and ${counts.reviews} reviews.`,
    );
    console.log(`\n  Log in as  ${DEMO_EMAIL}\n  Password   ${DEMO_PASSWORD}\n`);
    console.log('This User is Demo. Delete it before deploying anywhere real.\n');
  } finally {
    await db.$disconnect();
  }
}

// Only when run as a script: importing this file for a test must not seed.
if (require.main === module) {
  main();
}
