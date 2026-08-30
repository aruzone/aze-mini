import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RefreshSessions } from './refresh-sessions';

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

const NOW = new Date('2026-08-30T12:00:00.000Z');
const ABSOLUTE = new Date('2026-09-29T12:00:00.000Z');
const IDLE = new Date('2026-09-06T12:00:00.000Z');

/**
 * A stand-in for the Prisma delegate with just enough behaviour for the
 * transaction below to run against: rows held in a map, keyed as the schema
 * keys them.
 */
type MockTokenRow = Record<string, unknown>;

/** What the stand-in Prisma delegate offers the service. */
type MockDelegate = {
  rows: Map<string, MockTokenRow>;
  findUnique: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
  $transaction: (work: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

function mockDelegate(): MockDelegate {
  let nextId = 1;
  const rows = new Map<string, MockTokenRow>();

  const asRow = (data: MockTokenRow): MockTokenRow => ({
    id: `row-${nextId++}`,
    createdAt: NOW,
    rotatedAt: null,
    revokedAt: null,
    ...data,
  });

  let self: MockDelegate;
  // Faithful where it matters: a throw inside the transaction rolls every
  // write it made back — the real client does, and a revocation written
  // before the throw must not survive it.
  const $transaction = async (work: (tx: unknown) => Promise<unknown>) => {
    const snapshot = new Map([...rows].map(([key, row]) => [key, { ...row }]));
    try {
      return await work({ refreshToken: self });
    } catch (error) {
      rows.clear();
      for (const [key, row] of snapshot) {
        rows.set(key, row);
      }
      throw error;
    }
  };
  return (self = {
    rows,
    findUnique: jest.fn(({ where }: { where: { tokenHash?: string; id?: string } }) =>
      rows.get(where.tokenHash ? `hash:${where.tokenHash}` : `id:${where.id}`) ?? null,
    ),
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      const row = asRow(data);
      rows.set(`hash:${data.tokenHash}`, row);
      rows.set(`id:${row.id}`, row);
      return row;
    }),
    // The one write the service guards a race with: only a still-unrotated,
    // unrevoked row may be marked rotated, and the count says whether it was.
    updateMany: jest.fn(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let changed = 0;
      for (const row of rows.values()) {
        const matches = Object.entries(where).every(([key, expected]) =>
          expected === null ? row[key] === null || row[key] === undefined : row[key] === expected,
        );
        if (matches) {
          Object.assign(row, data);
          changed++;
        }
      }
      return { count: changed };
    }),
    $transaction,
  });
  return self;
}
describe('RefreshSessions', () => {
  let sessions: RefreshSessions;
  let delegate: MockDelegate;
  let userId: string;


  beforeEach(() => {
    delegate = mockDelegate();
    userId = 'user-1';
    // The DatabaseService the service sees: the transaction plus the token
    // delegate hanging off it, the way PrismaClient names its models.
    sessions = new RefreshSessions({ ...delegate, refreshToken: delegate } as never);
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The stand-in keys every row twice — by hash and by id — so count distinct rows.
  const storedRows = () => {
    const seen = new Set<unknown>();
    return [...delegate.rows.values()].filter((row) => {
      if (!row.tokenHash || seen.has(row.id)) {
        return false;
      }
      seen.add(row.id);
      return true;
    });
  };
  describe('issuing', () => {
    it('stores the hash of the token it returns, never the token', async () => {
      const token = await sessions.issue(userId);

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(storedRows()).toHaveLength(1);
      expect(storedRows()[0]).toMatchObject({
        tokenHash: sha256(token),
        userId,
        revokedAt: null,
        rotatedAt: null,
      });
      expect(JSON.stringify(storedRows())).not.toContain(token);
    });

    it('bounds the chain: absolute expiry from now, idle expiry from now', async () => {
      await sessions.issue(userId);

      expect(storedRows()[0]).toMatchObject({ expiresAt: ABSOLUTE, idleExpiresAt: IDLE });
    });
  });

  describe('rotating', () => {
    it('answers a new token in the same family and marks the old one rotated', async () => {
      const presented = await sessions.issue(userId);

      const rotated = await sessions.rotate(presented);

      expect(rotated.userId).toBe(userId);
      expect(rotated.refreshToken).not.toEqual(presented);
      expect(storedRows()).toHaveLength(2);
      const [oldRow, newRow] = storedRows().sort(
        (a, b) => Number(!!b.rotatedAt) - Number(!!a.rotatedAt),
      );
      expect(oldRow.rotatedAt).toEqual(NOW);
      expect(newRow).toMatchObject({
        tokenHash: sha256(rotated.refreshToken),
        familyId: oldRow.familyId,
        // The absolute ceiling is the family's, not a fresh thirty days: a
        // chain does not live forever because it keeps being used.
        expiresAt: ABSOLUTE,
        idleExpiresAt: IDLE,
      });
    });

    it('refuses a token that was never issued', async () => {
      await expect(sessions.rotate('never-issued')).rejects.toThrow(UnauthorizedException);
      expect(storedRows()).toHaveLength(0);
    });

    it('refuses a rotated token, revoking its whole family', async () => {
      const presented = await sessions.issue(userId);
      const { refreshToken: replacement } = await sessions.rotate(presented);

      // The old token now belongs to an attacker who copied it before the
      // legitimate client rotated.
      await expect(sessions.rotate(presented)).rejects.toThrow(UnauthorizedException);

      const family = [...new Set(storedRows().map((row) => row.familyId))];
      expect(family).toHaveLength(1);
      expect(storedRows().every((row) => row.revokedAt)).toBe(true);
      // The revocation kills the replacement too — the thief holding it cannot
      // quietly outrun the detection.
      await expect(sessions.rotate(replacement)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a revoked token, revoking its whole family', async () => {
      const presented = await sessions.issue(userId);
      const [row] = storedRows();
      row.revokedAt = NOW;

      await expect(sessions.rotate(presented)).rejects.toThrow(UnauthorizedException);
      expect(storedRows().every((row) => row.revokedAt)).toBe(true);
    });

    it('refuses an idle-expired token without touching the family', async () => {
      const presented = await sessions.issue(userId);
      const [row] = storedRows();
      row.idleExpiresAt = new Date(NOW.getTime() - 1);

      await expect(sessions.rotate(presented)).rejects.toThrow(UnauthorizedException);
      expect(storedRows()[0].revokedAt).toBeNull();
    });

    it('refuses an absolutely-expired token', async () => {
      const presented = await sessions.issue(userId);
      const [row] = storedRows();
      row.expiresAt = new Date(NOW.getTime() - 1);

      await expect(sessions.rotate(presented)).rejects.toThrow(UnauthorizedException);
    });

    it('loses the race, not the family: a concurrent rotation of one token revokes it', async () => {
      // Two clients present the same token at once. The winner rotates it; the
      // loser's write finds the row already rotated and must answer the reuse
      // branch — revoke the family — rather than mint a second child.
      const presented = await sessions.issue(userId);
      const loser = sessions.rotate(presented);
      const winner = sessions.rotate(presented);
      // Order is not the point: one exchange wins, the other is answered as
      // a replay.
      const settled = await Promise.allSettled([loser, winner]);
      expect(settled.map((outcome) => outcome.status).sort()).toEqual(['fulfilled', 'rejected']);
      // The raced token, presented once more, is detected as reuse and kills
      // the whole family — including the winner's child.
      await expect(sessions.rotate(presented)).rejects.toThrow(UnauthorizedException);
      expect(storedRows().every((row) => row.revokedAt)).toBe(true);
    });
  });
  describe('revoking', () => {
    it('logout revokes the family the presented token belongs to', async () => {
      const presented = await sessions.issue(userId);
      const { refreshToken } = await sessions.rotate(presented);

      await sessions.revokeFamily(refreshToken);

      expect(storedRows().every((row) => row.revokedAt)).toBe(true);
      await expect(sessions.rotate(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('logout refuses a token it never issued', async () => {
      await expect(sessions.revokeFamily('never-issued')).rejects.toThrow(UnauthorizedException);
    });

    it('a password reset revokes every family the User has', async () => {
      const first = await sessions.issue(userId);
      const second = await sessions.issue(userId);

      await sessions.revokeAllFor(userId);

      expect(storedRows().every((row) => row.revokedAt)).toBe(true);
      await expect(sessions.rotate(first)).rejects.toThrow(UnauthorizedException);
      await expect(sessions.rotate(second)).rejects.toThrow(UnauthorizedException);
    });

    it('leaves other Users\' sessions alone', async () => {
      await sessions.issue(userId);
      const other = await sessions.issue('user-2');

      await sessions.revokeAllFor(userId);

      expect(storedRows().find((row) => row.tokenHash === sha256(other)).revokedAt).toBeNull();
    });
  });
});
