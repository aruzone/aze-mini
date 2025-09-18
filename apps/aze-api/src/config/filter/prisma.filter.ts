import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpStatus, NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { PrismaClientValidationError } from '../../../generated/prisma/runtime/library';

@Catch()
export class PrismaFilter<T> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage = 'Internal server error';

    if (exception instanceof PrismaClientValidationError) {
      httpStatus = 400;
      errorMessage = "Bad Request Object: " + exception.message;
    } else if (exception instanceof BadRequestException) {
      httpStatus = 400;
      errorMessage = "Bad Request Object: " + exception.message;
    } else if (exception instanceof NotImplementedException) {
      httpStatus = 501;
      errorMessage = "Not Implemented: " + exception.message;
    } else if (exception instanceof UnauthorizedException) {
      httpStatus = 401;
      errorMessage = "Unauthorized: " + exception.message;
    }

    response.status(httpStatus).json({
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }
}
