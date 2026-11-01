import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ContentBadRequestException,
  ContentForbiddenException,
  ContentNotFoundException,
  ContentSourceException,
  ContentSourceTimeoutException,
  ContentSourceUnavailableException,
  ContentUnauthorizedException,
} from './content-source.exception.js';

const STATUS_BY_EXCEPTION = new Map<Function, HttpStatus>([
  [ContentNotFoundException, HttpStatus.NOT_FOUND],
  [ContentBadRequestException, HttpStatus.BAD_REQUEST],
  // Upstream 401/403 mean *the server's* credentials for the CMS are wrong or insufficient.
  // The end client did nothing wrong and cannot fix it, so they become 502, not 401/403.
  [ContentUnauthorizedException, HttpStatus.BAD_GATEWAY],
  [ContentForbiddenException, HttpStatus.BAD_GATEWAY],
  [ContentSourceTimeoutException, HttpStatus.GATEWAY_TIMEOUT],
  [ContentSourceUnavailableException, HttpStatus.BAD_GATEWAY],
]);

/**
 * Optional filter that turns library exceptions into HTTP responses.
 *
 * Register it globally with `{ provide: APP_FILTER, useClass: ContentExceptionFilter }` or
 * per controller with `@UseFilters(ContentExceptionFilter)`. It uses `HttpAdapterHost`
 * instead of Express' `res` so it works on both the Express and Fastify platforms.
 *
 * Upstream details (status, code, message) are intentionally not leaked to clients; they are
 * logged instead when the failure is on the server side (5xx).
 */
@Catch(ContentSourceException)
export class ContentExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ContentExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: ContentSourceException, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const status = STATUS_BY_EXCEPTION.get(exception.constructor) ?? HttpStatus.BAD_GATEWAY;

    if (status >= 500) this.logger.error(exception.message, exception.stack);

    httpAdapter.reply(
      ctx.getResponse(),
      // Same body shape as Nest's built-in HttpException responses.
      { statusCode: status, error: STATUS_CODES[status], message: publicMessage(status) },
      status,
    );
  }
}

function publicMessage(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.NOT_FOUND:
      return 'Content not found';
    case HttpStatus.BAD_REQUEST:
      return 'Invalid content query';
    case HttpStatus.GATEWAY_TIMEOUT:
      return 'Content source timed out';
    default:
      return 'Content source error';
  }
}
