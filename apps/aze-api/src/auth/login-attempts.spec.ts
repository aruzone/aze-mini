import { HttpStatus } from '@nestjs/common';
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

describe('LoginAttempts', () => {
  let attempts: LoginAttempts;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T09:00:00.000Z'));
    attempts = new LoginAttempts();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const failTimes = (times: number, source = SOURCE, email = EMAIL) => {
    for (let i = 0; i < times; i++) {
      attempts.recordFailure(source, email);
    }
  };

  describe(`guessing one User's password`, () => {
    it('lets a User who mistypes it try again', () => {
      failTimes(MAX_FAILED_LOGINS - 1);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).not.toThrow();
    });

    it('refuses once the attempts run out', () => {
      failTimes(MAX_FAILED_LOGINS);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).toThrow(refusal);
    });

    // The refusal is what a caller acts on, so it says how long for rather
    // than leaving them to poll and find out.
    it('says how long the wait is', () => {
      failTimes(MAX_FAILED_LOGINS);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).toThrow(/\d+ seconds?/);
    });

    // Four wrong and then right is a User, not an attacker.
    it('forgets the failures once they get in', () => {
      failTimes(MAX_FAILED_LOGINS - 1);

      attempts.succeeded(SOURCE, EMAIL);
      failTimes(MAX_FAILED_LOGINS - 1);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).not.toThrow();
    });

    it('lets them back in once the window has passed', () => {
      failTimes(MAX_FAILED_LOGINS);

      jest.advanceTimersByTime(LOGIN_ATTEMPT_WINDOW_MS + 1);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).not.toThrow();
    });

    // Someone else failing against the same User from somewhere else must not
    // lock this source out — that would be a way to deny a User their own
    // sign-in from anywhere.
    it('counts each source separately', () => {
      failTimes(MAX_FAILED_LOGINS, OTHER_SOURCE);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).not.toThrow();
    });

    // A shared address — an office, a NAT, a mobile network — must not mean one
    // User mistyping their password locks their colleagues out of their own.
    it('counts each User separately within one source', () => {
      failTimes(MAX_FAILED_LOGINS, SOURCE, OTHER_EMAIL);

      expect(() => attempts.refuseIfExhausted(SOURCE, EMAIL)).not.toThrow();
    });
  });

  // The per-User count alone would let one host work through a list of emails,
  // five guesses at each, without ever being refused.
  describe('working through a list of Users', () => {
    const failAgainstDistinctUsers = (times: number) => {
      for (let i = 0; i < times; i++) {
        attempts.recordFailure(SOURCE, `user-${i}@example.com`);
      }
    };

    it('refuses the source once it has failed enough times overall', () => {
      failAgainstDistinctUsers(MAX_FAILED_LOGINS_PER_SOURCE);

      expect(() => attempts.refuseIfExhausted(SOURCE, 'someone-else@example.com')).toThrow(
        refusal,
      );
    });

    it('leaves the source alone below that', () => {
      failAgainstDistinctUsers(MAX_FAILED_LOGINS_PER_SOURCE - 1);

      expect(() => attempts.refuseIfExhausted(SOURCE, 'someone-else@example.com')).not.toThrow();
    });

    // Getting into one of them does not clear the trail of the rest, or an
    // attacker holding a single valid credential would reset it at will.
    it('is not cleared by getting into one of them', () => {
      failAgainstDistinctUsers(MAX_FAILED_LOGINS_PER_SOURCE);

      attempts.succeeded(SOURCE, EMAIL);

      expect(() => attempts.refuseIfExhausted(SOURCE, 'someone-else@example.com')).toThrow(
        refusal,
      );
    });

    it('does not touch a different source', () => {
      failAgainstDistinctUsers(MAX_FAILED_LOGINS_PER_SOURCE);

      expect(() => attempts.refuseIfExhausted(OTHER_SOURCE, EMAIL)).not.toThrow();
    });
  });

  // The map is the only thing here that grows, and an attacker rotating
  // addresses is what would grow it.
  it('does not remember what has expired', () => {
    failTimes(1);
    jest.advanceTimersByTime(LOGIN_ATTEMPT_WINDOW_MS + 1);

    attempts.recordFailure(OTHER_SOURCE, OTHER_EMAIL);

    // One source key and one User key, both belonging to the live failure.
    expect(attempts.size).toBe(2);
  });
});
