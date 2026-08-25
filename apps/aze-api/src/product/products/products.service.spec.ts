import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/runtime/library';
import { ProductsService } from './products.service';
import { ProductCache } from './product-cache';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';

const TAG_A = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';
const TAG_B = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e70';

const connectFoundNothing = () =>
  new PrismaClientKnownRequestError('An operation failed', {
    code: 'P2025',
    clientVersion: '6.19.2',
    meta: { modelName: 'Product', cause: 'No record was found for a nested connect.' },
  });

describe('ProductsService', () => {
  let service: ProductsService;

  const mockDatabaseService = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productCategory: { findUnique: jest.fn() },
    tag: { findMany: jest.fn() },
    review: { count: jest.fn() },
  };

  const mockConfigService = { get: jest.fn() };

  const mockProductCache = {
    readOne: jest.fn(),
    readList: jest.fn(),
    forget: jest.fn(),
    forgetList: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    // The cache seam is exercised on its own in product-cache.spec.ts. Here it
    // stands in as a cache that never has the answer, so these keep describing
    // what the service asks the database.
    mockProductCache.readOne.mockImplementation(
      async (_id: string, load: () => Promise<unknown>) => ({ value: await load(), hit: false }),
    );
    mockProductCache.readList.mockImplementation(
      async (_sort: string, _limit: number, load: () => Promise<unknown>) => ({
        value: await load(),
        hit: false,
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProductCache, useValue: mockProductCache },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // The flat id is the wire contract; Prisma's nested connect is this service's
  // business. These pin the translation between the two.
  describe('create', () => {
    it('connects the category the flat id names', async () => {
      await service.create({ name: 'Widget', price: 9.99, categoryId: 3 });

      expect(mockDatabaseService.product.create).toHaveBeenCalledWith({
        data: { name: 'Widget', price: 9.99, category: { connect: { id: 3 } } },
      });
    });

    it('sends no categoryId column of its own', async () => {
      await service.create({ name: 'Widget', price: 9.99, categoryId: 3 });

      const { data } = mockDatabaseService.product.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('categoryId');
    });
  });

  describe('update', () => {
    it('leaves the category alone when the patch does not name one', async () => {
      await service.update('product-1', { name: 'Widget II' });

      expect(mockDatabaseService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { name: 'Widget II' },
      });
    });

    it('reconnects the category when the patch names one', async () => {
      await service.update('product-1', { categoryId: 7 });

      expect(mockDatabaseService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { category: { connect: { id: 7 } } },
      });
    });
  });

  // A cache nobody invalidates is a bug with a timer on it. These pin which
  // writes forget what — the reading half is product-cache.spec.ts.
  describe('caching', () => {
    it('reads one product through the cache, keyed by its id', async () => {
      mockDatabaseService.product.findUnique.mockResolvedValue({ id: 'product-1' });

      const read = await service.findOne('product-1');

      expect(mockProductCache.readOne).toHaveBeenCalledWith('product-1', expect.any(Function));
      expect(read).toEqual({ value: { id: 'product-1' }, hit: false });
    });

    it('reads the list through the cache, keyed by sort and limit', async () => {
      mockDatabaseService.product.findMany.mockResolvedValue([]);

      await service.findAll('desc', 25);

      expect(mockProductCache.readList).toHaveBeenCalledWith('desc', 25, expect.any(Function));
    });

    it('still answers 404 for a product that is not there', async () => {
      mockDatabaseService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('product-1')).rejects.toThrow(
        new NotFoundException('Product with ID product-1 not found'),
      );
    });

    it('forgets the lists a new product belongs in', async () => {
      await service.create({ name: 'Widget', price: 9.99, categoryId: 3 });

      expect(mockProductCache.forgetList).toHaveBeenCalled();
    });

    it('forgets a product it has updated', async () => {
      await service.update('product-1', { name: 'Widget II' });

      expect(mockProductCache.forget).toHaveBeenCalledWith('product-1');
    });

    it('forgets a product it has deleted', async () => {
      await service.remove('product-1');

      expect(mockProductCache.forget).toHaveBeenCalledWith('product-1');
    });

    // Invalidating after a write that failed would throw away a cache entry
    // that still matches the row, for no gain.
    it('forgets nothing when the write did not happen', async () => {
      mockDatabaseService.product.update.mockRejectedValue(new Error('the pool is gone'));

      await expect(service.update('product-1', { name: 'Widget II' })).rejects.toThrow();
      expect(mockProductCache.forget).not.toHaveBeenCalled();
    });
  });

  // Prisma says only that a connect found nothing. Which id it was is the
  // difference between a caller fixing their request and filing a bug.
  describe('when a connect finds nothing', () => {
    it('names the category the request asked for', async () => {
      mockDatabaseService.product.create.mockRejectedValue(connectFoundNothing());
      mockDatabaseService.productCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Widget', price: 9.99, categoryId: 999999 }),
      ).rejects.toThrow(new NotFoundException('Product category with ID 999999 not found'));
    });

    it('names only the tags that are absent', async () => {
      mockDatabaseService.product.create.mockRejectedValue(connectFoundNothing());
      mockDatabaseService.productCategory.findUnique.mockResolvedValue({ id: 3 });
      mockDatabaseService.tag.findMany.mockResolvedValue([{ id: TAG_A }]);

      await expect(
        service.create({ name: 'Widget', price: 9.99, categoryId: 3, tagIds: [TAG_A, TAG_B] }),
      ).rejects.toThrow(new NotFoundException(`Tag with ID ${TAG_B} not found`));
    });

    // The ids were all real, so the missing row is the Product the route named.
    // The filter answers that one, and it can only do so if it still arrives.
    it('rethrows when every id the request named exists', async () => {
      const original = connectFoundNothing();
      mockDatabaseService.product.update.mockRejectedValue(original);
      mockDatabaseService.productCategory.findUnique.mockResolvedValue({ id: 3 });

      await expect(service.update('product-1', { categoryId: 3 })).rejects.toBe(original);
    });

    it('leaves a failure that is not a missing record alone', async () => {
      const original = new Error('the connection pool is gone');
      mockDatabaseService.product.create.mockRejectedValue(original);

      await expect(
        service.create({ name: 'Widget', price: 9.99, categoryId: 3 }),
      ).rejects.toBe(original);
      expect(mockDatabaseService.productCategory.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deleting a product reviews still point at', () => {
    it('refuses, naming how many reviews are in the way', async () => {
      mockDatabaseService.review.count.mockResolvedValue(2);

      await expect(service.remove('product-1')).rejects.toThrow(
        new ConflictException('Product with ID product-1 still has 2 reviews'),
      );
    });

    it('never reaches the database with the delete', async () => {
      mockDatabaseService.review.count.mockResolvedValue(2);

      await expect(service.remove('product-1')).rejects.toBeInstanceOf(ConflictException);
      expect(mockDatabaseService.product.delete).not.toHaveBeenCalled();
    });

    // A refused delete changed nothing, so forgetting the cached product would
    // throw away a still-correct entry.
    it('leaves the cached product alone', async () => {
      mockDatabaseService.review.count.mockResolvedValue(2);

      await expect(service.remove('product-1')).rejects.toBeInstanceOf(ConflictException);
      expect(mockProductCache.forget).not.toHaveBeenCalled();
    });

    it('counts only the reviews of the product being deleted', async () => {
      mockDatabaseService.review.count.mockResolvedValue(0);

      await service.remove('product-1');

      expect(mockDatabaseService.review.count).toHaveBeenCalledWith({
        where: { productId: 'product-1' },
      });
    });

    it('deletes a product no review points at, and forgets it', async () => {
      mockDatabaseService.review.count.mockResolvedValue(0);
      mockDatabaseService.product.delete.mockResolvedValue({ id: 'product-1' });

      await expect(service.remove('product-1')).resolves.toEqual({ id: 'product-1' });
      expect(mockProductCache.forget).toHaveBeenCalledWith('product-1');
    });
  });
});
