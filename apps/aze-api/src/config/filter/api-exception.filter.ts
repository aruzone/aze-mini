import { ApiErrorResponse } from '@aze-mini/platform-contracts';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '../../../generated/prisma/runtime/library';
import {
  RECORD_NOT_FOUND,
  UNIQUE_CONSTRAINT_FAILED,
} from '../../database/prisma-errors';

type ErrorMessage = ApiErrorResponse['message'];

type Answer = { httpStatus: number; errorMessage: ErrorMessage };

// Nest puts one entry per failing field under `message` as an array and says
// everything else in a string, which is what ApiErrorResponse promises a caller.
// A body that put anything else there has nothing readable to offer, so the
// exception's own message stands in rather than that reaching the wire.
function readableMessage(body: unknown, fallback: string): ErrorMessage {
  if (typeof body === 'string') {
    return body;
  }

  if (typeof body !== 'object' || body === null) {
    return fallback;
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
    return message;
  }

  return fallback;
}

// Prisma reports both a missing row and a failed nested connect as P2025, and
// names the model the write was aimed at rather than the relation id that
// missed. That is enough for a 404 but not enough to say which id to fix, so a
// service holding the ids answers first and this is the backstop for the rest.
function answerForPrisma(exception: PrismaClientKnownRequestError): Answer | undefined {
  const meta = exception.meta ?? {};
  const model = typeof meta.modelName === 'string' ? meta.modelName : undefined;

  if (exception.code === RECORD_NOT_FOUND) {
    return {
      httpStatus: HttpStatus.NOT_FOUND,
      errorMessage: model
        ? `No ${model} matched the request`
        : 'The requested record was not found',
    };
  }

  if (exception.code === UNIQUE_CONSTRAINT_FAILED) {
    const target = Array.isArray(meta.target) ? meta.target.join(', ') : undefined;
    return {
      httpStatus: HttpStatus.CONFLICT,
      errorMessage: target
        ? `A ${model ?? 'record'} with that ${target} already exists`
        : `That ${model ?? 'record'} already exists`,
    };
  }

  return undefined;
}

@Catch()
export class ApiExceptionFilter<T> implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage: ErrorMessage = 'Internal server error';

    if (exception instanceof PrismaClientValidationError) {
      httpStatus = 400;
      errorMessage = 'Bad Request Object: ' + exception.message;
    } else if (exception instanceof PrismaClientKnownRequestError) {
      const answer = answerForPrisma(exception);
      if (answer) {
        httpStatus = answer.httpStatus;
        errorMessage = answer.errorMessage;
      }
    } else if (exception instanceof HttpException) {
      // This filter catches everything, so any HttpException would otherwise be
      // flattened into a 500. The body is carried over rather than reduced to
      // `message`: the validation pipe reports one entry per failing field
      // there, and that detail is the whole value of a 400.
      httpStatus = exception.getStatus();
      errorMessage = readableMessage(exception.getResponse(), exception.message);
    }

    // A 500 tells the caller nothing, by design. Whoever runs the API needs the
    // cause, and the filter is the last place it exists.
    if (httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    };

    response.status(httpStatus).json(body);
  }
}
