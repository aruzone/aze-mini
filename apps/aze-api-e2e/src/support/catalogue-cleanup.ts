// eslint-disable-next-line @nx/enforce-module-boundaries
import { Prisma, PrismaClient } from '../../../aze-api/generated/prisma';
import { E2E_CATALOGUE_NAME_PREFIX } from './catalogue-namespace';

const e2eName = { startsWith: E2E_CATALOGUE_NAME_PREFIX } as const;

export async function cleanupE2ECatalogue(
  database: PrismaClient = new PrismaClient(),
): Promise<void> {
  try {
    await database.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { name: e2eName },
        select: { id: true },
      });
      const categories = await transaction.productCategory.findMany({
        where: { name: e2eName },
        select: { id: true },
      });
      const productIds = products.map(({ id }) => id);
      const categoryIds = categories.map(({ id }) => id);

      if (productIds.length > 0) {
        await transaction.review.deleteMany({ where: { productId: { in: productIds } } });
        // Prisma exposes no delegate for its implicit many-to-many join table.
        await transaction.$executeRaw(
          Prisma.sql`DELETE FROM "_ProductToTag" WHERE "A" IN (${Prisma.join(productIds)})`,
        );
        await transaction.product.deleteMany({ where: { id: { in: productIds } } });
      }

      if (categoryIds.length > 0) {
        await transaction.productCategory.deleteMany({ where: { id: { in: categoryIds } } });
      }
    });
  } finally {
    await database.$disconnect();
  }
}
