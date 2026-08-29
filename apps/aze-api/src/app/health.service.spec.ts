import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service';
import { DatabaseService } from '../database/database.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const database = { $queryRaw: jest.fn() };
  const cache = { check: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DatabaseService, useValue: database },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe('liveness', () => {
    it('answers live without consulting a dependency', () => {
      expect(service.liveness()).toEqual({ status: 'live' });
      expect(database.$queryRaw).not.toHaveBeenCalled();
      expect(cache.check).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('is ready when the database answers and the cache is up', async () => {
      database.$queryRaw.mockResolvedValue([]);
      cache.check.mockResolvedValue('up');

      await expect(service.readiness()).resolves.toEqual({
        status: 'ready',
        checks: { database: 'up', cache: 'up' },
      });
    });

    // The cache fails open (ADR-0005): a deployment without its cache serves
    // every request, just slower. Readiness reports it and never gates on it.
    it('stays ready when only the cache is down', async () => {
      database.$queryRaw.mockResolvedValue([]);
      cache.check.mockResolvedValue('down');

      await expect(service.readiness()).resolves.toEqual({
        status: 'ready',
        checks: { database: 'up', cache: 'down' },
      });
    });

    it('is not ready when the database does not answer', async () => {
      database.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED'));
      cache.check.mockResolvedValue('up');

      await expect(service.readiness()).resolves.toEqual({
        status: 'not ready',
        checks: { database: 'down', cache: 'up' },
      });
    });
  });
});
