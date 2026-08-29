import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/runtime/library';
import { ApiExceptionFilter } from './api-exception.filter';

const hostFor = (response: unknown) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/api/auth/register' }),
      getResponse: () => response,
    }),
  }) as ArgumentsHost;

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new PrismaClientKnownRequestError('Invalid invocation', {
    code,
    clientVersion: '6.19.2',
    meta,
  });

const spyingResponse = () => {
  const json = jest.fn();
  return { response: { status: jest.fn(() => ({ json })) }, json };
};

describe('ApiExceptionFilter', () => {
  // The filter logs the causes it could not name, and a passing test run is no
  // place to print them. The logger is the pino logger the request lines share,
  // stubbed here the same way: one `error` call per unexplained 5xx.
  let logged: jest.Mock;
  let filter: ApiExceptionFilter<unknown>;

  beforeEach(() => {
    logged = jest.fn();
    filter = new ApiExceptionFilter({
      setContext: jest.fn(),
      error: logged,
    } as unknown as PinoLogger);
  });

  it('is built around the shared logger', () => {
    expect(filter).toBeDefined();
  });

  it('preserves the status and message of an HTTP exception it does not name', () => {
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };

    filter.catch(new ConflictException('That email is already registered'), hostFor(response));

    expect(response.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('That email is already registered'),
      }),
    );
  });

  // The validation pipe reports one entry per failing field. Flattening the
  // exception to its bare message throws that away and leaves a caller with
  // "Bad Request Exception" and nothing to fix.
  it('keeps the per-field detail of a validation failure', () => {
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: ['name should not be empty', 'price must be a number'],
        error: 'Bad Request',
      }),
      hostFor(response),
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['name should not be empty', 'price must be a number'],
      }),
    );
  });

  // ApiErrorResponse says `message` is a string or a list of them, and a caller
  // reading it has only those two cases to handle. A thrown body that put
  // something else there would otherwise reach the wire and break that promise.
  it('falls back to the exception message when the body carries no readable one', () => {
    const { response, json } = spyingResponse();

    filter.catch(
      new BadRequestException({ statusCode: 400, message: { field: 'name' } }),
      hostFor(response),
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Bad Request Exception' }),
    );
  });

  it('falls back when the thrown body is not an object at all', () => {
    const { response, json } = spyingResponse();
    const exception = new BadRequestException();
    jest.spyOn(exception, 'getResponse').mockReturnValue(null as unknown as string);

    filter.catch(exception, hostFor(response));

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Bad Request' }),
    );
  });

  // A write naming a row that is not there is the caller's mistake. Left
  // unnamed it fell through to the 500 default, which says the Starter is
  // broken when the request simply named the wrong id.
  it('answers a missing record with a 404 naming the model', () => {
    const { response, json } = spyingResponse();

    filter.catch(
      prismaError('P2025', {
        modelName: 'Product',
        cause: 'No record was found for an update.',
      }),
      hostFor(response),
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'No Product matched the request' }),
    );
  });

  it('answers a unique constraint with a 409 naming the column that collided', () => {
    const { response, json } = spyingResponse();

    filter.catch(prismaError('P2002', { modelName: 'ProductCategory', target: ['name'] }), hostFor(response));

    expect(response.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'A ProductCategory with that name already exists',
      }),
    );
  });

  it('still answers 500 for a Prisma code it does not name', () => {
    const { response, json } = spyingResponse();

    filter.catch(prismaError('P2037'), hostFor(response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  // The 500 body is deliberately empty of detail, so the only place the cause
  // survives is the server log. Swallowing it leaves nobody anything to read.
  // The error-tracking hook point passes the same exception to whatever an
  // Adopter wires in, so the log line and the tracker agree on the cause.
  it('logs whatever it could not name, with the request id, rather than swallowing it', () => {
    const { response } = spyingResponse();
    const exception = new Error('the connection pool is gone');

    filter.catch(exception, hostFor(response));

    expect(logged).toHaveBeenCalledWith(
      { reqId: undefined, err: exception },
      'POST /api/auth/register failed',
    );
  });

  it('does not log a failure it answered as a client error', () => {
    const { response } = spyingResponse();

    filter.catch(prismaError('P2025', { modelName: 'Product' }), hostFor(response));

    expect(logged).not.toHaveBeenCalled();
  });
});
