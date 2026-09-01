import { EmailTokens, RESET_TOKEN_TTL_SECONDS, VERIFICATION_TOKEN_TTL_SECONDS } from './email-tokens';
import { createHash } from 'node:crypto';

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

const NOW = new Date('2026-08-30T12:00:00.000Z');
const USER_ID = 'user-1';

function mockDelegate() {
  let nextId = 1;
  const rows: Array<Record<string, unknown>> = [];

  return {
    rows,
    findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) =>
      rows.find((row) => row.tokenHash === where.tokenHash) ?? null,
    ),
    deleteMany: jest.fn(async ({ where }: { where: { userId: string; type: string; usedAt: null } }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (
          rows[i].userId === where.userId &&
          rows[i].type === where.type &&
          rows[i].usedAt === null
        ) {
          rows.splice(i, 1);
        }
      }
      return { count: before - rows.length };
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `row-${nextId++}`,
        usedAt: null,
        createdAt: NOW,
        ...data,
      };
      rows.push(row);
      return row;
    }),
    updateMany: jest.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let changed = 0;
        for (const row of rows) {
          const matches = Object.entries(where).every(([key, expected]) => {
            if (expected === null) return row[key] === null || row[key] === undefined;
            if (expected && typeof expected === 'object' && 'gt' in (expected as object)) {
              return (row[key] as Date) > (expected as { gt: Date }).gt;
            }
            return row[key] === expected;
          });
          if (matches) {
            Object.assign(row, data);
            changed++;
          }
        }
        return { count: changed };
      },
    ),
  };
}

/** What the stand-in Prisma delegate offers the service. */
type MockDelegate = {
  rows: Array<Record<string, unknown>>;
  findUnique: jest.Mock;
  deleteMany: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
};

function makeService() {
  const delegate = mockDelegate();
  const service = new EmailTokens(
    {
      $transaction: (work: (tx: unknown) => Promise<unknown>) =>
        work({ emailToken: delegate }),
      emailToken: delegate,
    } as never,
    { appendBestEffort: jest.fn() } as never,
  );
  return { service, delegate: delegate as unknown as MockDelegate };
}

describe('EmailTokens', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('issuing', () => {
    it('stores only the hash of the token it returns', async () => {
      const { service, delegate } = makeService();

      const token = await service.issue(USER_ID, 'VERIFICATION');

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(delegate.rows).toHaveLength(1);
      expect(delegate.rows[0]).toMatchObject({
        tokenHash: sha256(token),
        userId: USER_ID,
        type: 'VERIFICATION',
        usedAt: null,
      });
      expect(JSON.stringify(delegate.rows)).not.toContain(token);
    });

    it('gives a reset token sixty minutes and a verification token twenty-four hours', async () => {
      const { service, delegate } = makeService();

      await service.issue(USER_ID, 'RESET');
      await service.issue(USER_ID, 'VERIFICATION');

      const expiry = (type: string) =>
        new Date(delegate.rows.find((row) => row.type === type)?.expiresAt as Date).getTime();
      expect(expiry('RESET') - NOW.getTime()).toBe(RESET_TOKEN_TTL_SECONDS * 1000);
      expect(expiry('VERIFICATION') - NOW.getTime()).toBe(VERIFICATION_TOKEN_TTL_SECONDS * 1000);
    });

    it('supersedes the previous unused token of the same type', async () => {
      const { service, delegate } = makeService();

      const first = await service.issue(USER_ID, 'RESET');
      const second = await service.issue(USER_ID, 'RESET');

      expect(delegate.rows).toHaveLength(1);
      await expect(service.consume(first, 'RESET')).resolves.toBeNull();
      await expect(service.consume(second, 'RESET')).resolves.toBe(USER_ID);
    });

    it('leaves tokens of the other type alone', async () => {
      const { service, delegate } = makeService();

      await service.issue(USER_ID, 'VERIFICATION');
      await service.issue(USER_ID, 'RESET');

      expect(delegate.rows).toHaveLength(2);
    });
  });

  describe('consuming', () => {
    it('marks the token used and answers the User it belongs to', async () => {
      const { service, delegate } = makeService();
      const token = await service.issue(USER_ID, 'RESET');

      await expect(service.consume(token, 'RESET')).resolves.toBe(USER_ID);
      expect(delegate.rows[0].usedAt).toEqual(NOW);
    });

    it('refuses a token that was already used', async () => {
      const { service } = makeService();
      const token = await service.issue(USER_ID, 'RESET');

      await service.consume(token, 'RESET');
      await expect(service.consume(token, 'RESET')).resolves.toBeNull();
    });

    it('refuses a token of the wrong type', async () => {
      const { service } = makeService();
      const token = await service.issue(USER_ID, 'VERIFICATION');

      await expect(service.consume(token, 'RESET')).resolves.toBeNull();
    });

    it('refuses an expired token', async () => {
      const { service, delegate } = makeService();
      const token = await service.issue(USER_ID, 'RESET');
      delegate.rows[0].expiresAt = new Date(NOW.getTime() - 1);

      await expect(service.consume(token, 'RESET')).resolves.toBeNull();
    });

    it('refuses a token that was never issued', async () => {
      const { service } = makeService();

      await expect(service.consume('never-issued', 'RESET')).resolves.toBeNull();
    });
  });
});
