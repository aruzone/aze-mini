import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/runtime/library';
import { ApiExceptionFilter } from './api-exception.filter';

const hostFor = (response: unknown) =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/api/auth/register' }),
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
  // place to print them.
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('should be defined', () => {
    expect(new ApiExceptionFilter()).toBeDefined();
  });

  it('preserves the status and message of an HTTP exception it does not name', () => {
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };

    new ApiExceptionFilter().catch(
      new ConflictException('That email is already registered'),
      hostFor(response),
    );

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

    new ApiExceptionFilter().catch(
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

    new ApiExceptionFilter().catch(
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

    new ApiExceptionFilter().catch(exception, hostFor(response));

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Bad Request' }),
    );
  });

  // A write naming a row that is not there is the caller's mistake. Left
  // unnamed it fell through to the 500 default, which says the Starter is
  // broken when the request simply named the wrong id.
  it('answers a missing record with a 404 naming the model', () => {
    const { response, json } = spyingResponse();

    new ApiExceptionFilter().catch(
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

    new ApiExceptionFilter().catch(
      prismaError('P2002', { modelName: 'ProductCategory', target: ['name'] }),
      hostFor(response),
    );

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

    new ApiExceptionFilter().catch(prismaError('P2037'), hostFor(response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  // The 500 body is deliberately empty of detail, so the only place the cause
  // survives is the server log. Swallowing it leaves nobody anything to read.
  it('logs whatever it could not name rather than swallowing it', () => {
    const { response } = spyingResponse();

    new ApiExceptionFilter().catch(new Error('the connection pool is gone'), hostFor(response));

    expect(logged).toHaveBeenCalledWith(
      'POST /api/auth/register failed',
      expect.stringContaining('the connection pool is gone'),
    );
  });

  it('does not log a failure it answered as a client error', () => {
    const { response } = spyingResponse();

    new ApiExceptionFilter().catch(prismaError('P2025', { modelName: 'Product' }), hostFor(response));

    expect(logged).not.toHaveBeenCalled();
  });
});
