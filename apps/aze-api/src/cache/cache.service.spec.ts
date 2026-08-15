import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_DEADLINE_MS, CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService, { provide: CACHE_MANAGER, useValue: mockCache }],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('returns what the store holds', async () => {
    mockCache.get.mockResolvedValue({ id: 'product-1' });

    await expect(service.get('products:product-1')).resolves.toEqual({ id: 'product-1' });
  });

  it('reports nothing rather than null for a key the store has never seen', async () => {
    mockCache.get.mockResolvedValue(undefined);

    await expect(service.get('products:product-1')).resolves.toBeUndefined();
  });

  it('writes with the time to live it was given', async () => {
    await service.set('products:product-1', { id: 'product-1' }, 60_000);

    expect(mockCache.set).toHaveBeenCalledWith('products:product-1', { id: 'product-1' }, 60_000);
  });

  // The cache is an optimisation, never the source of truth. A Redis that is
  // unreachable has to cost a request its speed and nothing else — see
  // docs/adr/0005-redis-cache-fails-open.md.
  describe('when the store fails', () => {
    const unreachable = new Error('connect ECONNREFUSED 127.0.0.1:6379');

    it('reads a miss instead of raising', async () => {
      mockCache.get.mockRejectedValue(unreachable);

      await expect(service.get('products:product-1')).resolves.toBeUndefined();
    });

    it('lets a write through unrecorded', async () => {
      mockCache.set.mockRejectedValue(unreachable);

      await expect(
        service.set('products:product-1', { id: 'product-1' }, 60_000),
      ).resolves.toBeUndefined();
    });

    it('lets an invalidation through unperformed', async () => {
      mockCache.del.mockRejectedValue(unreachable);

      await expect(service.del('products:product-1')).resolves.toBeUndefined();
    });

    // A socket that is accepted and then goes quiet is the failure a connect
    // timeout does not catch, and the only one that can hold a request open.
    it('stops waiting for a store that never answers', async () => {
      jest.useFakeTimers();
      mockCache.get.mockReturnValue(new Promise(() => undefined));

      const read = service.get('products:product-1');
      await jest.advanceTimersByTimeAsync(CACHE_DEADLINE_MS);

      await expect(read).resolves.toBeUndefined();
      jest.useRealTimers();
    });

    // Otherwise one read pays the deadline for the key, then again for the
    // list, then again for what the list is keyed by, and the next request
    // starts over.
    it('leaves the cache alone for a moment rather than failing key by key', async () => {
      mockCache.get.mockRejectedValueOnce(unreachable);
      await service.get('products:product-1');

      await expect(service.get('products:product-2')).resolves.toBeUndefined();
      expect(mockCache.get).toHaveBeenCalledTimes(1);
    });

    it('names the key and the operation in the log, since nothing else will', async () => {
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation();
      mockCache.del.mockRejectedValue(unreachable);

      await service.del('products:product-1');

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('products:product-1'),
        expect.anything(),
      );
    });
  });
});
