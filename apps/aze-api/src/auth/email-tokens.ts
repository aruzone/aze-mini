import { Injectable } from '@nestjs/common';
import { appConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';
import { hashToken, mintToken } from './opaque-token';
import { AuditService } from '../audit/audit.service';

/** The defaults behind the environment-configurable lifetimes (ADR-0011). */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60;
export const VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export type EmailTokenType = 'RESET' | 'VERIFICATION';

/**
 * The one token machine behind both email flows (ADR-0011).
 *
 * Tokens are minted and hashed by `opaque-token.ts`, the shape this shares
 * with the refresh machine. Single-use is enforced in the same transaction that
 * flips the state: the consume write only lands on a still-unused, unexpired
 * token, and the count of that write is the verdict. A newly issued token of
 * a type supersedes the User's previous unused one of the same type, which
 * bounds table growth and prevents token confusion between flows.
 */
@Injectable()
export class EmailTokens {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Returns the raw token exactly once — the caller's only chance to email it. */
  async issue(userId: string, type: EmailTokenType): Promise<string> {
    const token = mintToken();
    const ttlSeconds = this.ttlFor(type);

    await this.databaseService.$transaction(async (tx) => {
      // Supersede: the previous unused token of this type stops working the
      // moment a new one is asked for.
      await tx.emailToken.deleteMany({
        where: { userId, type, usedAt: null },
      });
      await tx.emailToken.create({
        data: {
          tokenHash: hashToken(token),
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
          tokenHash: hashToken(token),
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
        where: { tokenHash: hashToken(token) },
      });
      return row?.userId ?? null;
    });
  }

  async recordCompletion(userId: string, type: EmailTokenType): Promise<void> {
    await this.audit.appendBestEffort({
      event: type === 'RESET' ? 'auth.password.reset' : 'auth.email.verified',
      actorUserId: userId,
      subjectType: 'User',
      subjectId: userId,
    });
  }

  private ttlFor(type: EmailTokenType): number {
    const config = appConfig();
    return type === 'RESET'
      ? config.emailResetTtlSeconds
      : config.emailVerificationTtlSeconds;
  }
}
