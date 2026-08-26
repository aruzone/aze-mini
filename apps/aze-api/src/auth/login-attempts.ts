import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

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

/** How often expired counts are swept up. See `prune`. */
const PRUNE_INTERVAL_MS = 60 * 1000;

type Failures = { count: number; expiresAt: number };

// Two counts per failure, kept in one map under keys that cannot collide.
const sourceKey = (source: string) => `source:${source}`;
const userKey = (source: string, email: string) => `user:${source}:${email}`;

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
 * The counts live in this process, which is the honest limit of them: two
 * replicas mean two counts, and an attacker spread across both gets twice the
 * attempts. `docs/deployment.md` says so. Moving the map to Redis is the fix,
 * and is a decision about failure behaviour rather than a swap — this must not
 * inherit the cache's fail-open policy (ADR-0005), because a rate limiter that
 * fails open is one an attacker disables by taking Redis down.
 */
@Injectable()
export class LoginAttempts {
  private readonly failures = new Map<string, Failures>();
  private lastPrunedAt = Date.now();

  /** How many counts are being held. For the test that keeps pruning honest. */
  get size(): number {
    return this.failures.size;
  }

  refuseIfExhausted(source: string, email: string): void {
    this.refuseIf(userKey(source, email), MAX_FAILED_LOGINS);
    this.refuseIf(sourceKey(source), MAX_FAILED_LOGINS_PER_SOURCE);
  }

  recordFailure(source: string, email: string): void {
    this.prune();
    this.increment(userKey(source, email));
    this.increment(sourceKey(source));
  }

  succeeded(source: string, email: string): void {
    this.failures.delete(userKey(source, email));
  }

  private refuseIf(key: string, limit: number): void {
    const record = this.current(key);
    if (!record || record.count < limit) {
      return;
    }

    const seconds = Math.ceil((record.expiresAt - Date.now()) / 1000);
    throw new HttpException(
      `Too many failed sign-in attempts. Try again in ${seconds} second${
        seconds === 1 ? '' : 's'
      }.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private increment(key: string): void {
    const record = this.current(key);
    // The window runs from the first failure, so a caller cannot hold a count
    // open indefinitely by failing once every fourteen minutes.
    this.failures.set(key, {
      count: (record?.count ?? 0) + 1,
      expiresAt: record?.expiresAt ?? Date.now() + LOGIN_ATTEMPT_WINDOW_MS,
    });
  }

  private current(key: string): Failures | undefined {
    const record = this.failures.get(key);
    if (!record) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      this.failures.delete(key);
      return undefined;
    }
    return record;
  }

  // Nothing else sweeps this map, and an attacker rotating addresses is what
  // would grow it. Correctness does not depend on the sweep — `current()`
  // ignores anything expired whether or not it is still in the map — so this
  // only reclaims memory, and doing it on every failure would be O(n) per
  // write: quadratic work handed to exactly the caller causing it. Once a
  // minute reclaims the same memory and costs nothing per attempt.
  private prune(): void {
    const now = Date.now();
    if (now - this.lastPrunedAt < PRUNE_INTERVAL_MS) {
      return;
    }
    this.lastPrunedAt = now;

    for (const [key, record] of this.failures) {
      if (record.expiresAt <= now) {
        this.failures.delete(key);
      }
    }
  }
}
