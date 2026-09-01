// eslint-disable-next-line @nx/enforce-module-boundaries
import { PrismaClient } from '../../../aze-api/generated/prisma';
import { cleanupE2ECatalogue } from './catalogue-cleanup';
import {
  catalogueFixtureName,
  E2E_CATALOGUE_NAME_PREFIX,
} from './catalogue-namespace';

describe('E2E catalogue cleanup', () => {
  it('reserves an explicit namespace that Demo and Adopter names do not enter', () => {
    const fixtureName = catalogueFixtureName('Widget');

    expect(fixtureName.startsWith(`${E2E_CATALOGUE_NAME_PREFIX}Widget `)).toBe(true);
    expect('Professional Demo Headphones'.startsWith(E2E_CATALOGUE_NAME_PREFIX)).toBe(false);
    expect('Adopter catalogue record'.startsWith(E2E_CATALOGUE_NAME_PREFIX)).toBe(false);
  });

  it('selects only namespaced rows and deletes their dependencies in transaction order', async () => {
    const operations: string[] = [];
    let productTagQuery: unknown;
    const productFindMany = jest.fn(async () => {
      operations.push('select products');
      return [{ id: 'e2e-product' }];
    });
    const categoryFindMany = jest.fn(async () => {
      operations.push('select categories');
      return [{ id: 83 }];
    });
    const transaction = {
      product: {
        findMany: productFindMany,
        deleteMany: jest.fn(async () => {
          operations.push('delete products');
          return { count: 1 };
        }),
      },
      productCategory: {
        findMany: categoryFindMany,
        deleteMany: jest.fn(async () => {
          operations.push('delete categories');
          return { count: 1 };
        }),
      },
      review: {
        deleteMany: jest.fn(async () => {
          operations.push('delete reviews');
          return { count: 1 };
        }),
      },
      $executeRaw: jest.fn(async (query: unknown) => {
        productTagQuery = query;
        operations.push('delete product tags');
        return 1;
      }),
    };
    const database = {
      $transaction: jest.fn(
        async (operation: (client: typeof transaction) => Promise<void>) => {
          operations.push('begin');
          await operation(transaction);
          operations.push('commit');
        },
      ),
      $disconnect: jest.fn(async () => {
        operations.push('disconnect');
      }),
    } as unknown as PrismaClient;

    await cleanupE2ECatalogue(database);

    const namespacedSelection = {
      where: { name: { startsWith: E2E_CATALOGUE_NAME_PREFIX } },
      select: { id: true },
    };
    expect(productFindMany).toHaveBeenCalledWith(namespacedSelection);
    expect(categoryFindMany).toHaveBeenCalledWith(namespacedSelection);
    expect(transaction.review.deleteMany).toHaveBeenCalledWith({
      where: { productId: { in: ['e2e-product'] } },
    });
    expect(productTagQuery).toMatchObject({ values: ['e2e-product'] });
    expect(transaction.product.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['e2e-product'] } },
    });
    expect(transaction.productCategory.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [83] } },
    });
    expect(operations).toEqual([
      'begin',
      'select products',
      'select categories',
      'delete reviews',
      'delete product tags',
      'delete products',
      'delete categories',
      'commit',
      'disconnect',
    ]);
  });

  it('does not issue broad deletes when the namespace selection is empty', async () => {
    const transaction = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      productCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      review: {
        deleteMany: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const database = {
      $transaction: jest.fn(
        async (operation: (client: typeof transaction) => Promise<void>) =>
          operation(transaction),
      ),
      $disconnect: disconnect,
    } as unknown as PrismaClient;

    await cleanupE2ECatalogue(database);

    expect(transaction.review.deleteMany).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(transaction.product.deleteMany).not.toHaveBeenCalled();
    expect(transaction.productCategory.deleteMany).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects and surfaces a transaction failure', async () => {
    const failure = new Error('cleanup failed');
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const database = {
      $transaction: jest.fn().mockRejectedValue(failure),
      $disconnect: disconnect,
    } as unknown as PrismaClient;

    await expect(cleanupE2ECatalogue(database)).rejects.toBe(failure);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
