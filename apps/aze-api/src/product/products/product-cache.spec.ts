import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../cache/cache.service';
import {
  PRODUCT_CACHE_TTL_MS,
  PRODUCT_LIST_GENERATION_KEY,
  ProductCache,
} from './product-cache';

const PRODUCT = { id: 'product-1', name: 'Widget', price: 9.99 };

describe('ProductCache', () => {
  let cache: ProductCache;

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockCacheService.get.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductCache, { provide: CacheService, useValue: mockCacheService }],
    }).compile();

    cache = module.get<ProductCache>(ProductCache);
  });

  describe('reading one product', () => {
    it('answers from the cache without troubling the database', async () => {
      mockCacheService.get.mockResolvedValue(PRODUCT);
      const load = jest.fn();

      const read = await cache.readOne('product-1', load);

      expect(read).toEqual({ value: PRODUCT, hit: true });
      expect(load).not.toHaveBeenCalled();
    });

    it('loads and records the product when the cache does not have it', async () => {
      const read = await cache.readOne('product-1', async () => PRODUCT);

      expect(read).toEqual({ value: PRODUCT, hit: false });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'products:product-1',
        PRODUCT,
        PRODUCT_CACHE_TTL_MS,
      );
    });

    // A 404 is an answer about the database, not a value to keep. Recording it
    // would keep answering 404 for a product created a moment later.
    it('records nothing when the load fails', async () => {
      const absent = new NotFoundException('Product with ID product-1 not found');

      await expect(
        cache.readOne('product-1', () => Promise.reject(absent)),
      ).rejects.toBe(absent);
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('reading the list', () => {
    it('keys each combination of sort and limit apart', async () => {
      mockCacheService.get.mockImplementation(async (key: string) =>
        key === PRODUCT_LIST_GENERATION_KEY ? 'generation-1' : undefined,
      );

      await cache.readList('asc', 10, async () => [PRODUCT]);
      await cache.readList('desc', 10, async () => [PRODUCT]);

      const keys = mockCacheService.set.mock.calls.map(([key]) => key);
      expect(keys).toEqual([
        'products:list:generation-1:asc:10',
        'products:list:generation-1:desc:10',
      ]);
    });

    // Every sort and limit an Adopter's callers ask for is a key of its own, so
    // a write cannot name them all. They are keyed under a generation instead:
    // forgetting that one key orphans the whole set at once.
    it('orphans every earlier key when the generation changes', async () => {
      mockCacheService.get.mockImplementation(async (key: string) =>
        key === PRODUCT_LIST_GENERATION_KEY ? 'generation-1' : undefined,
      );
      await cache.readList('asc', 10, async () => [PRODUCT]);

      mockCacheService.get.mockImplementation(async (key: string) =>
        key === PRODUCT_LIST_GENERATION_KEY ? 'generation-2' : undefined,
      );
      await cache.readList('asc', 10, async () => [PRODUCT]);

      const keys = mockCacheService.set.mock.calls.map(([key]) => key);
      expect(keys[0]).not.toEqual(keys[1]);
    });

    it('mints a generation when there is none, and reports the read as a miss', async () => {
      const read = await cache.readList('asc', 10, async () => [PRODUCT]);

      expect(read.hit).toBe(false);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        PRODUCT_LIST_GENERATION_KEY,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('answers from the cache when the generation still names a stored list', async () => {
      mockCacheService.get.mockImplementation(async (key: string) =>
        key === PRODUCT_LIST_GENERATION_KEY ? 'generation-1' : [PRODUCT],
      );
      const load = jest.fn();

      const read = await cache.readList('asc', 10, load);

      expect(read).toEqual({ value: [PRODUCT], hit: true });
      expect(load).not.toHaveBeenCalled();
    });
  });

  describe('invalidating', () => {
    it('forgets the product and the lists it appears in', async () => {
      await cache.forget('product-1');

      expect(mockCacheService.del.mock.calls.map(([key]) => key)).toEqual([
        'products:product-1',
        PRODUCT_LIST_GENERATION_KEY,
      ]);
    });

    // A product that has just been created is in no product key, but it belongs
    // in every list.
    it('forgets only the lists when nothing named a product', async () => {
      await cache.forgetList();

      expect(mockCacheService.del.mock.calls.map(([key]) => key)).toEqual([
        PRODUCT_LIST_GENERATION_KEY,
      ]);
    });
  });
});
