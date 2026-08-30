import { HttpException, HttpStatus } from '@nestjs/common';
import {
  LOGIN_ATTEMPT_WINDOW_MS,
  LoginAttempts,
  MAX_FAILED_LOGINS,
  MAX_FAILED_LOGINS_PER_SOURCE,
} from './login-attempts';

const SOURCE = '203.0.113.7';
const OTHER_SOURCE = '198.51.100.2';
const EMAIL = 'ada@example.com';
const OTHER_EMAIL = 'grace@example.com';

const refusal = expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS });

/**
 * A Redis stand-in with just the commands the limiter uses: INCR, PEXPIRE,
 * PTTL, GET, DEL — counters held in a map, expiry held beside them. Expired
 * keys answer as absent, which is the behaviour the real TTL gives for free.
 */
function mockRedis() {
  const store = new Map<string, { count: number; expiresAt: number | null }>();
  let error: Error | null = null;

  const live = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  return {
    failWith(message: string) {
      error = new Error(message);
    },
    recover() {
      error = null;
    },
    store,
    incr: jest.fn(async (key: string) => {
      if (error) throw error;
      const entry = live(key) ?? { count: 0, expiresAt: null };
      entry.count += 1;
      store.set(key, entry);
      return entry.count;
    }),
    pexpire: jest.fn(async (key: string, ms: number) => {
      if (error) throw error;
      const entry = store.get(key);
      if (entry) {
        entry.expiresAt = Date.now() + ms;
        return 1;
      }
      return 0;
    }),
    pttl: jest.fn(async (key: string) => {
      if (error) throw error;
      const entry = live(key);
      if (!entry || entry.expiresAt === null) return -1;
      return entry.expiresAt - Date.now();
    }),
    get: jest.fn(async (key: string) => {
      if (error) throw error;
      return live(key) ? String(live(key)?.count) : null;
    }),
    del: jest.fn(async (key: string) => {
      if (error) throw error;
      return store.delete(key) ? 1 : 0;
    }),
  };
}

type MockRedis = ReturnType<typeof mockRedis>;

describe('LoginAttempts', () => {
  let attempts: LoginAttempts;
  let redis: MockRedis;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T09:00:00.000Z'));
    redis = mockRedis();
    attempts = new LoginAttempts(redis as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const failTimes = async (times: number, source = SOURCE, email = EMAIL) => {
    for (let i = 0; i < times; i++) {
      await attempts.recordFailure(source, email);
    }
  };

  describe(`guessing one User's password`, () => {
    it('lets a User who mistypes it try again', async () => {
      await failTimes(MAX_FAILED_LOGINS - 1);
      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
    });

    it('refuses once the attempts run out', async () => {
      await failTimes(MAX_FAILED_LOGINS);
      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).rejects.toThrow(refusal);
    });

    // The refusal is what a caller acts on, so it says how long for rather
    // than leaving them to poll and find out.
    it('says how long the wait is', async () => {
      await failTimes(MAX_FAILED_LOGINS);

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).rejects.toMatchObject({
        response: expect.stringContaining('seconds'),
      });
    });

    // Four wrong and then right is a User, not an attacker.
    it('forgets the failures once they get in', async () => {
      await failTimes(MAX_FAILED_LOGINS - 1);
      await attempts.succeeded(SOURCE, EMAIL);

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
    });

    it('lets them back in once the window has passed', async () => {
      await failTimes(MAX_FAILED_LOGINS);
      jest.setSystemTime(Date.now() + LOGIN_ATTEMPT_WINDOW_MS + 1);

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
    });

    // Someone else failing against the same User from somewhere else must not
    // lock this source out — that would be a way to deny a User their own
    // sign-in from anywhere.
    it('counts each source separately', async () => {
      await failTimes(MAX_FAILED_LOGINS, OTHER_SOURCE, EMAIL);

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
    });

    // A shared address — an office, a NAT, a mobile network — must not mean one
    // User mistyping their password locks their colleagues out of their own.
    it('counts each User separately within one source', async () => {
      await failTimes(MAX_FAILED_LOGINS, SOURCE, OTHER_EMAIL);

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
    });
  });

  // The per-User count alone would let one host work through a list of emails,
  // five guesses at each, without ever being refused.
  describe('working through a list of Users', () => {
    it('refuses one source once its cross-User budget runs out', async () => {
      await failTimes(MAX_FAILED_LOGINS_PER_SOURCE, SOURCE, EMAIL);
      await failTimes(MAX_FAILED_LOGINS, SOURCE, OTHER_EMAIL);

      await expect(attempts.refuseIfExhausted(SOURCE, OTHER_EMAIL)).rejects.toThrow(refusal);
      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).rejects.toThrow(refusal);
      // A different source is untouched by the first one's budget.
      await expect(attempts.refuseIfExhausted(OTHER_SOURCE, EMAIL)).resolves.toBeUndefined();
    });

    it('keeps the source count when one User succeeds', async () => {
      await failTimes(MAX_FAILED_LOGINS_PER_SOURCE - 1, SOURCE, EMAIL);
      await attempts.succeeded(SOURCE, EMAIL);

      // One more failure anywhere on this source hits the ceiling.
      await failTimes(1, SOURCE, OTHER_EMAIL);
      await expect(attempts.refuseIfExhausted(SOURCE, OTHER_EMAIL)).rejects.toThrow(refusal);
    });

    it('lets a User back in without wiping the source trail', async () => {
      await failTimes(MAX_FAILED_LOGINS - 1, SOURCE, EMAIL);
      await attempts.succeeded(SOURCE, EMAIL);
      await failTimes(1, SOURCE, OTHER_EMAIL);

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
      await expect(attempts.refuseIfExhausted(SOURCE, OTHER_EMAIL)).resolves.toBeUndefined();
    });
  });

  // The window runs from the first failure, so failing once every fourteen
  // minutes never accumulates into a refusal.
  it('runs the window from the first failure', async () => {
    await attempts.recordFailure(SOURCE, EMAIL);
    jest.setSystemTime(Date.now() + LOGIN_ATTEMPT_WINDOW_MS - 1);
    await attempts.recordFailure(SOURCE, EMAIL);
    jest.setSystemTime(Date.now() + LOGIN_ATTEMPT_WINDOW_MS + 1);

    await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).resolves.toBeUndefined();
  });

  // Authorization fails closed (ADR-0010): a limiter that cannot count must
  // refuse, never wave through — an open limiter is one an attacker disables
  // by taking Redis down.
  describe('when Redis is down', () => {
    it('answers 503 on the refusal check instead of allowing the attempt', async () => {
      redis.failWith('connection down');

      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('answers 503 on recording a failure', async () => {
      redis.failWith('connection down');

      await expect(attempts.recordFailure(SOURCE, EMAIL)).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('counts normally once Redis recovers', async () => {
      redis.failWith('connection down');
      await expect(attempts.recordFailure(SOURCE, EMAIL)).rejects.toThrow(HttpException);
      redis.recover();

      await failTimes(MAX_FAILED_LOGINS);
      await expect(attempts.refuseIfExhausted(SOURCE, EMAIL)).rejects.toThrow(refusal);
    });
  });
});
