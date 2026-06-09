import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';

@Catch(HttpException)
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    let errorMessage = '';

    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const msg = (exceptionResponse as any).message;
      errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
    } else {
      errorMessage = exception.message || 'An error occurred';
    }

    // Return custom error response format
    response.status(status).json({
      success: false,
      message: errorMessage,
    });
  }
}
