import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaFilter } from './prisma.filter';

const hostFor = (response: unknown) =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/auth/register' }),
    }),
  }) as ArgumentsHost;

describe('PrismaFilter', () => {
  it('should be defined', () => {
    expect(new PrismaFilter()).toBeDefined();
  });

  it('preserves the status and message of an HTTP exception it does not name', () => {
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };

    new PrismaFilter().catch(
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

    new PrismaFilter().catch(
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
});
