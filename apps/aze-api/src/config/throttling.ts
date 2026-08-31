import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type Redis from 'ioredis';
import { REDIS_CLIENT, RedisClientModule } from './redis-client';
import { appConfig } from './configuration';

/**
 * The perimeter throttle (ADR-0010): one ceiling per source per minute across
 * every route, backed by Redis so the budget is shared by all replicas.
 *
 * The storage wrapper is what makes the policy deliberate: the raw adapter
 * rejects on a Redis error and Nest turns that into a 500. Here a limiter
 * that cannot count answers 503 instead — a limiter that fails open is one an
 * attacker disables by taking Redis down. This is the mirror of the cache's
 * fail-open (ADR-0005): speed fails open, authorization fails closed, and the
 * two are never one policy.
 */
export class FailClosedThrottleStorage extends ThrottlerStorageRedisService {
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await super.increment(key, ttl, limit, blockDuration, throttlerName);
    } catch {
      throw new HttpException(
        'The request cannot be verified right now. Try again shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

/**
 * The perimeter defaults, overridable per route through @Throttle().
 *
 * The storage takes the shared `REDIS_CLIENT` rather than a URL of its own:
 * built from a URL, the adapter would open a second connection on ioredis's
 * defaults — offline queue on, twenty retries — and a command issued while
 * Redis is down would queue for a reconnection instead of failing. The
 * limiter would then stall rather than close, which is the one thing
 * ADR-0010 says it must never do.
 */
export const throttlingModule = ThrottlerModule.forRootAsync({
  imports: [RedisClientModule],
  inject: [REDIS_CLIENT],
  useFactory: (redis: Redis) => ({
    throttlers: [
      {
        name: 'default',
        ttl: 60_000,
        limit: appConfig().throttlePerMinute,
      },
    ],
    storage: new FailClosedThrottleStorage(redis),
  }),
});
