import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
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

/** The perimeter defaults, overridable per route through @Throttle(). */
export const throttlingModule = ThrottlerModule.forRootAsync({
  useFactory: () => {
    const config = appConfig();
    return {
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: config.throttlePerMinute,
        },
      ],
      storage: new FailClosedThrottleStorage(config.redisUrl),
    };
  },
});
