import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const messages: Record<number, string> = {
      400: 'Invalid request',
      401: 'Authentication required or access token invalid',
      403: 'You do not have permission to perform this action',
      404: 'Endpoint not found',
    };
    if (status >= 500) this.logger.error({ event: 'request_failed', status });
    if (status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(status).json({
      statusCode: status,
      message: messages[status] ?? (status >= 500 ? 'Internal server error' : 'Request failed'),
      requestId: response.getHeader('X-Request-Id'),
    });
  }
}
