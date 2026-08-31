import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** How long a single Redis command may wait before it is abandoned. */
const COMMAND_TIMEOUT_MS = 1_000;

/** An outage produces one error per reconnect attempt. One line a minute is enough. */
const LOG_INTERVAL_MS = 60_000;

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * The one Redis connection shared by the limiter and the throttler.
 *
 * This client is deliberately configured the opposite way from the cache
 * store (ADR-0005): commands fail fast and loud instead of being answered
 * as misses. Everything riding on this client is authorization, not speed,
 * so a Redis that is down must surface as a refusal, never as silence.
 */
const redisFactory = (configService: ConfigService): Redis => {
  const logger = new Logger('RedisClient');
  const url = configService.get<string>('redisUrl') as string;
  const client = new Redis(url, {
    // Without this, a command issued while the connection is down waits in an
    // offline queue for a reconnection that may never come. Failing the
    // command is what lets the fail-closed contract actually close.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: COMMAND_TIMEOUT_MS,
    connectTimeout: COMMAND_TIMEOUT_MS,
  });

  // An EventEmitter with no 'error' listener throws whatever it is handed.
  let lastLoggedAt = 0;
  client.on('error', (error: Error) => {
    const now = Date.now();
    if (now - lastLoggedAt < LOG_INTERVAL_MS) {
      return;
    }
    lastLoggedAt = now;
    // Through Nest's logger, so this line lands in the same JSON stream as
    // every other one (ADR-0008) rather than beside it.
    logger.warn(
      `Redis at ${url} is not answering (${error.message}); throttled routes answer 503 until it recovers`,
    );
  });

  return client;
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: redisFactory,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisClientModule {}
