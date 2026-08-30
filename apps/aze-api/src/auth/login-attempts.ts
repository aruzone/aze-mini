import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../config/redis-client';
import { Inject } from '@nestjs/common';

/**
 * How many failures against one User, from one source, before that pair is
 * refused. Low enough to make guessing a password pointless, high enough that
 * someone who mistypes theirs a few times never learns this exists.
 */
export const MAX_FAILED_LOGINS = 5;

/**
 * How many failures one source may accumulate across all Users. The limit
 * above is per User, so without this a single host could work through a list
 * of emails five guesses at a time and never be refused.
 */
export const MAX_FAILED_LOGINS_PER_SOURCE = 20;

/** How long failures are remembered, and so how long a refusal lasts. */
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// Two counts per failure, kept under keys that cannot collide. The counts
// live in Redis, so two replicas share one budget instead of handing an
// attacker spread across both twice the attempts (ADR-0010).
const sourceKey = (source: string) => `login:fail:source:${source}`;
const userKey = (source: string, email: string) => `login:fail:user:${source}:${email}`;

/**
 * Brute-force protection on login. Failures are counted two ways, because one
 * way alone leaves an obvious hole:
 *
 * - per source **and** User, which stops a password being guessed;
 * - per source alone, which stops one host working through a list of Users.
 *
 * Counting per source only would mean one person mistyping their password on a
 * shared address — an office, a NAT, a mobile network — locking out everyone
 * behind it after five tries. The second limit still does that at twenty, so
 * this raises the bar rather than removing the problem; a deployment serving
 * large shared addresses should raise it further. Counting per User only would
 * leave working through a list of them unlimited.
 *
 * Only failures count, so signing in successfully never uses the per-User
 * budget up. It deliberately does not clear the source's count: an attacker
 * holding one valid credential would otherwise wipe the trail of every User
 * they had already tried.
 *
 * The counters are Redis `INCR` with an expiry set on the first failure, which
 * preserves the window rule — it runs from the first failure, so a caller
 * cannot hold a count open indefinitely by failing once every fourteen
 * minutes. And the limiter fails closed (ADR-0010): a Redis that cannot answer
 * refuses the sign-in with a 503 rather than waving it through, because a rate
 * limiter that fails open is one an attacker disables by taking Redis down.
 */
@Injectable()
export class LoginAttempts {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async refuseIfExhausted(source: string, email: string): Promise<void> {
    await this.refuseIf(userKey(source, email), MAX_FAILED_LOGINS);
    await this.refuseIf(sourceKey(source), MAX_FAILED_LOGINS_PER_SOURCE);
  }

  async recordFailure(source: string, email: string): Promise<void> {
    await this.increment(userKey(source, email));
    await this.increment(sourceKey(source));
  }

  async succeeded(source: string, email: string): Promise<void> {
    try {
      await this.redis.del(userKey(source, email));
    } catch {
      // A success that cannot clear its count only shortens the budget; the
      // refusal still expires with the window. Never block a signed-in User
      // on the cleanup.
    }
  }

  private async refuseIf(key: string, limit: number): Promise<void> {
    let count: string | null;
    try {
      count = await this.redis.get(key);
    } catch {
      throw this.unavailable();
    }

    if (!count || Number(count) < limit) {
      return;
    }

    let ttl: number;
    try {
      ttl = await this.redis.pttl(key);
    } catch {
      throw this.unavailable();
    }

    const seconds = Math.max(1, Math.ceil(ttl / 1000));
    throw new HttpException(
      `Too many failed sign-in attempts. Try again in ${seconds} second${
        seconds === 1 ? '' : 's'
      }.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async increment(key: string): Promise<void> {
    try {
      // INCR is atomic, so the count can never be lost to a race between two
      // replicas. The window starts at the first failure: the expiry is only
      // set when the counter is created.
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.pexpire(key, LOGIN_ATTEMPT_WINDOW_MS);
      }
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable(): HttpException {
    return new HttpException(
      'Sign-in is temporarily unavailable. Try again shortly.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
