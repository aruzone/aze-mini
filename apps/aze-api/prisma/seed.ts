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
    description: 'Lay-flat dot grid pages with a linen-wrapped cover.',
    price: 18,
    category: 'Stationery',
    tags: ['paper', 'everyday', 'portable'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000201',
        rating: 5,
        comment: 'The binding stays flat through a full page of notes.',
      },
      {
        id: '0195f0e1-0000-7000-8000-000000000202',
        rating: 4,
        comment: 'Excellent paper; a ribbon marker would make it perfect.',
      },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000102',
    name: 'Meridian Fountain Pen',
    description: 'A balanced brass pen with a smooth medium nib.',
    price: 58,
    category: 'Stationery',
    tags: ['everyday', 'portable', 'focused-work'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000203',
        rating: 5,
        comment: 'Comfortable through long planning sessions.',
      },
      {
        id: '0195f0e1-0000-7000-8000-000000000204',
        rating: 4,
        comment: 'A reassuring weight without feeling bulky.',
      },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000103',
    name: 'Arc Task Lamp',
    description: 'Dimmable warm-to-cool light with a compact weighted base.',
    price: 129,
    category: 'Lighting',
    tags: ['lighting', 'focused-work', 'adjustable'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000205',
        rating: 5,
        comment: 'Bright enough for detail work without harsh glare.',
      },
      {
        id: '0195f0e1-0000-7000-8000-000000000206',
        rating: 4,
        comment: 'The dimmer remembers the last setting.',
      },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000104',
    name: 'Wool Felt Desk Mat',
    description: 'Soft merino felt that defines the workspace and protects the desk.',
    price: 64,
    category: 'Workspace',
    tags: ['focused-work', 'natural-materials'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000207',
        rating: 5,
        comment: 'Quiet under the keyboard and generous without taking over.',
      },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000105',
    name: 'Oak Monitor Riser',
    description: 'Solid oak elevation with room to stow a keyboard below.',
    price: 119,
    category: 'Workspace',
    tags: ['organization', 'natural-materials', 'focused-work'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000208',
        rating: 5,
        comment: 'Puts the screen at the right height and clears visual clutter.',
      },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000106',
    name: 'Cable Dock Set',
    description: 'Weighted magnetic anchors that keep charging leads within reach.',
    price: 24,
    category: 'Organization',
    tags: ['organization', 'everyday'],
    reviews: [],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000107',
    name: 'Commuter Tech Pouch',
    description: 'A structured recycled-canvas case for chargers, pens and adapters.',
    price: 48,
    category: 'Workday Carry',
    tags: ['organization', 'portable', 'everyday'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000209',
        rating: 4,
        comment: 'Small enough for my tote and everything has a place.',
      },
    ],
  },
  {
    id: '0195f0e1-0000-7000-8000-000000000108',
    name: 'Ceramic Catchall Tray',
    description: 'A low-profile stoneware tray for keys, clips and daily essentials.',
    price: 32,
    category: 'Organization',
    tags: ['organization', 'natural-materials', 'everyday'],
    reviews: [
      {
        id: '0195f0e1-0000-7000-8000-000000000210',
        rating: 5,
        comment: 'Looks composed on the desk and keeps small items together.',
      },
    ],
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
      // Reconnect on update so a fixed review id cannot retain a stale product link.
      const reviewFields = {
        rating: review.rating,
        comment: review.comment,
        product: { connect: { id: product.id } },
      };
      await db.review.upsert({
        where: { id: review.id },
        update: reviewFields,
        create: { id: review.id, ...reviewFields },
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
