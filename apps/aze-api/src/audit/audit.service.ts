import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import type { AuditEvent, Prisma } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';
import type { AuditEventName } from './audit-events';

export type AuditClient = DatabaseService | Prisma.TransactionClient;

export type AppendAuditEvent = {
  event: AuditEventName;
  actorUserId: string | null;
  subjectType: string;
  subjectId: string;
  details?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  append(client: AuditClient, event: AppendAuditEvent): Promise<AuditEvent> {
    return client.auditEvent.create({ data: event });
  }

  /**
   * Authentication and guard events have no mutation transaction to join.
   * Their audit write is best-effort: a database failure is logged through the
   * request-scoped logger, which carries the request id, but never changes the
   * HTTP result. Mutation call sites use append() and let failure roll back.
   */
  async appendBestEffort(event: AppendAuditEvent): Promise<void> {
    try {
      await this.append(this.databaseService, event);
    } catch (error) {
      this.logger.error({ err: error }, 'Audit event could not be appended');
    }
  }

  async pseudonymizeActor(userId: string): Promise<void> {
    const pseudonym = `pseudonym:${randomBytes(32).toString('hex')}`;

    await this.databaseService.$transaction(async (tx) => {
      const redacted = await tx.auditEvent.updateMany({
        where: { actorUserId: userId },
        data: { actorUserId: pseudonym },
      });
      await this.append(tx, {
        event: 'audit.actor.pseudonymized',
        actorUserId: null,
        subjectType: 'AuditActor',
        subjectId: pseudonym,
        details: { redactedEvents: redacted.count },
      });
    });
  }
}
