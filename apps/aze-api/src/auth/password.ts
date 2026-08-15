import { hash } from 'bcryptjs';

const SALT_ROUNDS = 10;

// bcrypt reads only the first 72 bytes, so without a cap a longer password
// would be interchangeable with any other sharing its first 72 bytes.
export const MAX_PASSWORD_BYTES = 72;

/**
 * The one place a password becomes a hash. Registration and the Demo seed both
 * come through here, so the User the seed writes is indistinguishable from one
 * a visitor registered — see ADR-0003 for why bcryptjs.
 *
 * Imports nothing from Nest: the seed runs as a plain script, so the cap is a
 * plain Error here. Callers facing HTTP check it first and answer 400.
 */
export const hashPassword = (password: string) => {
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    throw new Error(`A password may be at most ${MAX_PASSWORD_BYTES} bytes long`);
  }
  return hash(password, SALT_ROUNDS);
};
