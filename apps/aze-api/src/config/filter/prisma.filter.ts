import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaClientValidationError } from '../../../generated/prisma/runtime/library';

@Catch()
export class PrismaFilter<T> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage: unknown = 'Internal server error';

    if (exception instanceof PrismaClientValidationError) {
      httpStatus = 400;
      errorMessage = 'Bad Request Object: ' + exception.message;
    } else if (exception instanceof HttpException) {
      // This filter catches everything, so any HttpException would otherwise be
      // flattened into a 500. The body is carried over rather than reduced to
      // `message`: the validation pipe reports one entry per failing field
      // there, and that detail is the whole value of a 400.
      httpStatus = exception.getStatus();
      const body = exception.getResponse();
      errorMessage =
        typeof body === 'string'
          ? body
          : ((body as { message?: unknown }).message ?? exception.message);
    }

    response.status(httpStatus).json({
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }
}
