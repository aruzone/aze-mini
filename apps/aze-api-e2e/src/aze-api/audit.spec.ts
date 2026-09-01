import { randomUUID } from 'node:crypto';
import axios from 'axios';
// The trail has no route by design; this spec reads it through the API's
// generated Prisma client rather than inventing an admin interface for tests.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { PrismaClient } from '../../../aze-api/generated/prisma';
import { anyStatus } from '../support/users';

const database = new PrismaClient();

describe('audit trail', () => {
  const email = `audit-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';
  let userId: string;

  beforeAll(async () => {
    const registered = await axios.post('/api/auth/register', { email, password });
    userId = registered.data.userId;
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('records a successful login under the acting User', async () => {
    const startedAt = new Date();

    await axios.post('/api/auth/login', { email, password });

    await expect(
      database.auditEvent.findFirst({
        where: {
          occurredAt: { gte: startedAt },
          event: 'auth.login.succeeded',
          actorUserId: userId,
          subjectType: 'User',
          subjectId: userId,
        },
      }),
    ).resolves.not.toBeNull();
  });

  it('records a failed login without naming an actor', async () => {
    const startedAt = new Date();

    const response = await axios.post(
      '/api/auth/login',
      { email: `unknown-${randomUUID()}@example.com`, password },
      anyStatus,
    );

    expect(response.status).toBe(401);
    await expect(
      database.auditEvent.findFirst({
        where: {
          occurredAt: { gte: startedAt },
          event: 'auth.login.failed',
          actorUserId: null,
          subjectType: 'Authentication',
          subjectId: 'login',
        },
      }),
    ).resolves.not.toBeNull();
  });

  it('records a request refused for having no token', async () => {
    const startedAt = new Date();

    const response = await axios.get('/api/users/me', anyStatus);

    expect(response.status).toBe(401);
    await expect(
      database.auditEvent.findFirst({
        where: {
          occurredAt: { gte: startedAt },
          event: 'authz.refused',
          actorUserId: null,
          subjectType: 'HttpRequest',
          subjectId: 'GET /api/users/me',
        },
      }),
    ).resolves.not.toBeNull();
  });

  it('rolls a mutation back when its audit append fails', async () => {
    const before = await database.auditEvent.count({
      where: { event: 'auth.registered', subjectType: 'User', subjectId: userId },
    });

    await expect(
      database.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { name: 'must roll back' },
        });
        await tx.auditEvent.create({
          data: {
            event: 'auth.registered',
            actorUserId: userId,
            // Deliberately violates the database constraint so the real
            // transaction proves the preceding mutation cannot commit alone.
            subjectType: null as never,
            subjectId: userId,
          },
        });
      }),
    ).rejects.toThrow();

    await expect(
      database.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ).resolves.toEqual({ name: null });
    await expect(
      database.auditEvent.count({
        where: { event: 'auth.registered', subjectType: 'User', subjectId: userId },
      }),
    ).resolves.toBe(before);
  });
});
