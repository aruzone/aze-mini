import { PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../database/database.service';
import { AuditService } from './audit.service';

const event = {
  event: 'product.updated' as const,
  actorUserId: 'user-1',
  subjectType: 'Product',
  subjectId: 'product-1',
};

describe('AuditService', () => {
  const databaseCreate = jest.fn();
  const transactionCreate = jest.fn();
  const transactionUpdateMany = jest.fn();
  const transaction = jest.fn(
    (work: (tx: unknown) => Promise<unknown>) =>
      work({
        auditEvent: {
          create: transactionCreate,
          updateMany: transactionUpdateMany,
        },
      }),
  );
  const logger = {
    setContext: jest.fn(),
    error: jest.fn(),
  };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionCreate.mockImplementation(({ data }) => data);
    transactionUpdateMany.mockResolvedValue({ count: 3 });
    service = new AuditService(
      {
        auditEvent: { create: databaseCreate },
        $transaction: transaction,
      } as unknown as DatabaseService,
      logger as unknown as PinoLogger,
    );
  });

  it('appends through the client the mutation handed it', async () => {
    const tx = { auditEvent: { create: transactionCreate } };

    await service.append(tx as never, event);

    expect(transactionCreate).toHaveBeenCalledWith({ data: event });
    expect(databaseCreate).not.toHaveBeenCalled();
  });

  it('logs an out-of-transaction failure and resolves', async () => {
    const failure = new Error('partition missing');
    databaseCreate.mockRejectedValue(failure);

    await expect(service.appendBestEffort(event)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      { err: failure },
      'Audit event could not be appended',
    );
  });

  it('pseudonymizes an actor and records the redaction atomically', async () => {
    await service.pseudonymizeActor('user-1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transactionUpdateMany).toHaveBeenCalledWith({
      where: { actorUserId: 'user-1' },
      data: { actorUserId: expect.stringMatching(/^pseudonym:[a-f0-9]{64}$/) },
    });

    const pseudonym = transactionUpdateMany.mock.calls[0][0].data.actorUserId;
    expect(transactionCreate).toHaveBeenCalledWith({
      data: {
        event: 'audit.actor.pseudonymized',
        actorUserId: null,
        subjectType: 'AuditActor',
        subjectId: pseudonym,
        details: { redactedEvents: 3 },
      },
    });
  });
});
