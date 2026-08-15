import { Logger } from '@nestjs/common';
import { createKeyv, Keyv } from '@keyv/redis';

/** How long a command waits for a Redis that is not answering before giving up. */
const CONNECT_TIMEOUT_MS = 1_000;

/** An outage produces one error per reconnection attempt. One line a minute is enough to see it. */
const LOG_INTERVAL_MS = 60_000;

/**
 * The Redis store the cache is built on, configured to fail fast rather than
 * to wait. Every setting here exists so that a Redis which is down slows a
 * request by a bounded amount and no more — see ADR-0005.
 */
export function createRedisStore(url: string): Keyv {
  const logger = new Logger('CacheStore');

  const store = createKeyv(
    {
      url,
      // Without this, a command issued while the connection is down waits in an
      // offline queue for a reconnection that may never come, and the request
      // holding it waits with it. Failing the command is what lets the cache
      // layer fall through to Postgres.
      disableOfflineQueue: true,
      socket: { connectTimeout: CONNECT_TIMEOUT_MS },
    },
    {
      // The adapter's own fail-open switches: report a failure and answer as
      // though the key were absent, rather than raising into the request.
      throwOnErrors: false,
      throwOnConnectError: false,
      connectionTimeout: CONNECT_TIMEOUT_MS,
    },
  );

  // Two reasons this listener is not optional: an EventEmitter with no 'error'
  // listener throws the error it was handed, and an outage nobody logs looks
  // exactly like a cache that keeps missing.
  let lastLoggedAt = 0;
  store.on('error', (error: unknown) => {
    const now = Date.now();
    if (now - lastLoggedAt < LOG_INTERVAL_MS) {
      return;
    }
    lastLoggedAt = now;
    logger.warn(
      `Redis at ${url} is not answering; reads fall through to the database until it does`,
      error,
    );
  });

  return store;
}
