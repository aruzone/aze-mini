import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { appConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';
import { isPrismaError, TRANSACTION_CONFLICT } from '../database/prisma-errors';

/**
 * The refresh-token machine (ADR-0009): issue → rotate → reuse-detect →
 * revoke, in this one file because it is the one pattern worth reading whole.
 *
 * A refresh token is an opaque 256-bit random string. The database holds only
 * its SHA-256 hash, so a leaked table leaks nothing that can be presented.
 * Every exchange issues a replacement inside the same family and marks the
 * presented token rotated; presenting a token that was already rotated or
 * revoked means someone is replaying it, and revokes the entire family —
 * which catches a stolen refresh token even when the attacker races the
 * legitimate client for the one allowed exchange.
 *
 * This is the one store read the token lifecycle puts on the refresh endpoint,
 * not on every authenticated request, and it is structurally fail-closed: a
 * session that cannot be verified against the rows is denied, never waved
 * through. The cache's fail-open policy (ADR-0005) does not apply here.
 */

/**
 * A replay detected inside the transaction, carrying the family that must
 * die for it. Thrown so the revocation can happen outside the transaction —
 * a throw rolls everything inside it back, revocation included.
 */
class Replayed {
  constructor(readonly familyId: string) {}
}
@Injectable()
export class RefreshSessions {
  private readonly absoluteTtlSeconds: number;
  private readonly idleTtlSeconds: number;

  constructor(private readonly databaseService: DatabaseService) {
    // Read once at construction: these are deployment configuration, not
    // per-request state, and the startup check has already refused a value
    // that is not a positive whole number.
    const config = appConfig();
    this.absoluteTtlSeconds = config.refreshTokenTtlSeconds;
    this.idleTtlSeconds = config.refreshIdleTtlSeconds;
  }

  /** A fresh family, for a fresh sign-in. Returns the token exactly once. */
  async issue(userId: string): Promise<string> {
    const token = this.mint();
    await this.databaseService.refreshToken.create({
      data: {
        tokenHash: this.hash(token),
        userId,
        familyId: randomUUID(),
        expiresAt: this.absoluteExpiry(),
        idleExpiresAt: this.idleExpiry(),
      },
    });
    return token;
  }

  /**
   * Exchange a presented token for a new one in its family. The absolute
   * expiry is inherited from the presented token — the ceiling belongs to the
   * family, so a chain does not live forever merely by staying in use — while
   * the idle expiry is renewed: using the chain is what keeps it alive.
   *
   * Serializable, deliberately: two presents of the same token are two
   * transactions reading one un-rotated row, and under the default isolation
   * both could pass the claim below. Serializable lets exactly one commit;
   * the other aborts and is answered as the replay it is.
   *
   * The family revocation for a detected replay lands *outside* the
   * transaction, on purpose: a throw rolls the transaction back, and a
   * revocation written before the throw would be rolled back with it — the
   * replay would be refused while the family it killed came back to life.
   */
  async rotate(presented: string): Promise<{ userId: string; refreshToken: string }> {
    try {
      return await this.databaseService.$transaction(
        async (tx) => {
          const row = await tx.refreshToken.findUnique({
            where: { tokenHash: this.hash(presented) },
          });
          if (!row) {
            throw this.refused();
          }

          const now = new Date();
          // An expired token is not a replay — a session idling out must not
          // kill its family — so expiry is answered before the claim. The
          // claim, not the read above, decides everything else: only a row
          // that is neither rotated nor revoked may be claimed, and two
          // presents of the same token see the same un-rotated row — one
          // write lands, the other finds zero and is the replay.
          if (row.idleExpiresAt <= now || row.expiresAt <= now) {
            throw this.refused();
          }
          const claimed = await tx.refreshToken.updateMany({
            where: { id: row.id, rotatedAt: null, revokedAt: null },
            data: { rotatedAt: now },
          });
          if (claimed.count !== 1) {
            throw new Replayed(row.familyId);
          }

          const refreshToken = this.mint();
          await tx.refreshToken.create({
            data: {
              tokenHash: this.hash(refreshToken),
              userId: row.userId,
              familyId: row.familyId,
              expiresAt: row.expiresAt,
              idleExpiresAt: this.idleExpiry(),
            },
          });
          return { userId: row.userId, refreshToken };
        },
        // Serializable: see the comment on this method.
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      // The revocation must commit, so it happens here, where nothing can
      // roll it back — see the comment on this method.
      if (error instanceof Replayed) {
        await this.revokeFamilyId(error.familyId);
        throw this.refused();
      }
      // Under Serializable the losing racer never sees the winner's write:
      // Postgres aborts its transaction (P2034) instead. The abort is the
      // replay, and the family dies the same way.
      if (isPrismaError(error, TRANSACTION_CONFLICT)) {
        const row = await this.databaseService.refreshToken.findUnique({
          where: { tokenHash: this.hash(presented) },
        });
        if (row) {
          await this.revokeFamilyId(row.familyId);
        }
        throw this.refused();
      }
      throw error;
    }
  }

  /** Logout: revoke the family the presented token belongs to. */
  async revokeFamily(presented: string): Promise<void> {
    const row = await this.databaseService.refreshToken.findUnique({
      where: { tokenHash: this.hash(presented) },
    });
    if (!row) {
      // Revoking nothing is not a success: a caller presenting a token that
      // was never issued is answered the way every other refusal here is.
      throw this.refused();
    }
    await this.revokeFamilyId(row.familyId);
  }

  /** A password reset: every family the User has dies, whoever holds them. */
  async revokeAllFor(userId: string): Promise<void> {
    await this.databaseService.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamilyId(familyId: string): Promise<void> {
    await this.databaseService.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private mint(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private absoluteExpiry(): Date {
    return new Date(Date.now() + this.absoluteTtlSeconds * 1000);
  }

  private idleExpiry(): Date {
    return new Date(Date.now() + this.idleTtlSeconds * 1000);
  }

  private refused(): UnauthorizedException {
    return new UnauthorizedException('The session is no longer valid. Sign in again.');
  }
}
