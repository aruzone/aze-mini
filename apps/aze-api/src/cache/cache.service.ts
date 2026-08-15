import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/**
 * How long any one cache operation is given before the request stops waiting
 * for it. Connect timeouts do not cover this: a Redis that accepts the socket
 * and then stops answering would otherwise hold a request open indefinitely.
 * Generous — Redis answers in single-digit milliseconds or it is not helping.
 */
export const CACHE_DEADLINE_MS = 250;

/**
 * How long the cache is left alone after a failure. Without this, one read can
 * spend several deadlines in a row — a key, then a list, then what the list is
 * keyed by — and every request pays the same tax over again.
 */
export const CACHE_COOLDOWN_MS = 5_000;

/**
 * The one place the Starter talks to the cache.
 *
 * Every method fails open: a Redis that is unreachable, or slow enough to be
 * indistinguishable from it, costs a request the speed the cache was there to
 * give it and nothing else. That decision, and what it costs, is ADR-0005.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private unavailableUntil = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.attempt('read', key, () => this.cache.get<T>(key));
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.attempt('write', key, () => this.cache.set(key, value, ttlMs));
  }

  async del(key: string): Promise<void> {
    await this.attempt('invalidation', key, () => this.cache.del(key));
  }

  private async attempt<T>(
    operation: string,
    key: string,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    // One failure is taken as evidence about Redis rather than about this key,
    // so the requests behind it go straight to the database instead of queueing
    // up behind the same deadline. The first one after the cooldown finds out
    // whether Redis has come back.
    if (Date.now() < this.unavailableUntil) {
      return undefined;
    }

    try {
      return await withinDeadline(work());
    } catch (error) {
      this.unavailableUntil = Date.now() + CACHE_COOLDOWN_MS;
      this.report(operation, key, error);
      return undefined;
    }
  }

  // A swallowed failure that is never mentioned is indistinguishable from a
  // cache that is simply cold, and the two want very different responses.
  // Connection failures are reported once a minute by the store itself; this
  // is for the ones that reach the caller.
  private report(operation: string, key: string, error: unknown) {
    this.logger.warn(
      `Cache ${operation} for ${key} failed; serving from the database instead`,
      error,
    );
  }
}

async function withinDeadline<T>(work: Promise<T>): Promise<T> {
  // The race answers first, but the operation carries on underneath it. Its
  // failure needs a handler of its own or it surfaces as an unhandled
  // rejection long after the request it belonged to has been answered.
  work.catch(() => undefined);

  let expire: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    expire = setTimeout(
      () => reject(new Error(`the cache did not answer within ${CACHE_DEADLINE_MS}ms`)),
      CACHE_DEADLINE_MS,
    );
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(expire);
  }
}
