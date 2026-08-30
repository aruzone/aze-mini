import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { appConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';

/** The defaults behind the environment-configurable lifetimes (ADR-0011). */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60;
export const VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export type EmailTokenType = 'RESET' | 'VERIFICATION';

/**
 * The one token machine behind both email flows (ADR-0011).
 *
 * Tokens are opaque 32-byte CSPRNG strings, base64url-encoded, stored as a
 * SHA-256 digest — the token is high-entropy, so an unsalted fast hash cannot
 * be brute-forced from a leaked table, and bcrypt's cost would buy nothing on
 * a hot public endpoint. Single-use is enforced in the same transaction that
 * flips the state: the consume write only lands on a still-unused, unexpired
 * token, and the count of that write is the verdict. A newly issued token of
 * a type supersedes the User's previous unused one of the same type, which
 * bounds table growth and prevents token confusion between flows.
 */
@Injectable()
export class EmailTokens {
  constructor(private readonly databaseService: DatabaseService) {}

  /** Returns the raw token exactly once — the caller's only chance to email it. */
  async issue(userId: string, type: EmailTokenType): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const ttlSeconds = this.ttlFor(type);

    await this.databaseService.$transaction(async (tx) => {
      // Supersede: the previous unused token of this type stops working the
      // moment a new one is asked for.
      await tx.emailToken.deleteMany({
        where: { userId, type, usedAt: null },
      });
      await tx.emailToken.create({
        data: {
          tokenHash: this.hash(token),
          userId,
          type,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        },
      });
    });

    return token;
  }

  /** Marks the token used and answers the User it belongs to, or null. */
  async consume(token: string, type: EmailTokenType): Promise<string | null> {
    return this.databaseService.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.emailToken.updateMany({
        where: {
          tokenHash: this.hash(token),
          type,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const row = await tx.emailToken.findUnique({
        where: { tokenHash: this.hash(token) },
      });
      return row?.userId ?? null;
    });
  }

  private ttlFor(type: EmailTokenType): number {
    const config = appConfig();
    return type === 'RESET'
      ? config.emailResetTtlSeconds
      : config.emailVerificationTtlSeconds;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
