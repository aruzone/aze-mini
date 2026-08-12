import { ArgumentsHost, ConflictException } from '@nestjs/common';
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
});
