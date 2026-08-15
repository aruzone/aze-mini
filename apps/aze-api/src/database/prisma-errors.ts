import { PrismaClientKnownRequestError } from '../../generated/prisma/runtime/library';

// The Prisma error codes this API answers for by name. The full list is at
// https://www.prisma.io/docs/orm/reference/error-reference
export const RECORD_NOT_FOUND = 'P2025';
export const UNIQUE_CONSTRAINT_FAILED = 'P2002';

export function isPrismaError(
  error: unknown,
  code: string,
): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === code;
}
