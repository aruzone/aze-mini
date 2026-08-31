import { createHash, randomBytes } from 'node:crypto';

/**
 * The one shape both token machines use (ADR-0009, ADR-0011): a refresh token
 * and an email token are the same thing on the wire — an opaque 256-bit
 * CSPRNG string the database only ever holds the digest of.
 *
 * SHA-256 rather than bcrypt on purpose: the token is high-entropy, so there
 * is nothing to brute-force from a leaked table, and a slow hash would only
 * buy latency on a public endpoint.
 */
export function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
