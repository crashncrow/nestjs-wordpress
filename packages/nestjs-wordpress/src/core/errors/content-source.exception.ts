export interface ContentSourceExceptionDetails {
  /** HTTP status returned by the upstream source, when there was a response. */
  upstreamStatus?: number;
  /** Machine-readable error code from the source (e.g. WordPress `rest_post_invalid_id`). */
  code?: string;
  cause?: unknown;
}

/**
 * Base class of every error thrown by the library.
 *
 * It deliberately extends `Error`, not Nest's `HttpException`: a content source failing is
 * not an HTTP concern by itself (the caller may be a queue worker or a cron job). Apps that
 * serve HTTP can opt into `ContentExceptionFilter` to translate these into responses.
 */
export class ContentSourceException extends Error {
  readonly upstreamStatus: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, details: ContentSourceExceptionDetails = {}) {
    super(message, { cause: details.cause });
    this.name = new.target.name;
    this.upstreamStatus = details.upstreamStatus;
    this.code = details.code;
  }
}

/** The requested item does not exist (or is not visible with the current credentials). */
export class ContentNotFoundException extends ContentSourceException {}

/** The source rejected the request parameters (e.g. `perPage` above the maximum). */
export class ContentBadRequestException extends ContentSourceException {}

/** Credentials are missing or invalid. */
export class ContentUnauthorizedException extends ContentSourceException {}

/** Credentials are valid but lack permission. */
export class ContentForbiddenException extends ContentSourceException {}

/** The source did not answer within the configured timeout. */
export class ContentSourceTimeoutException extends ContentSourceException {}

/** Network failure, 5xx response or an unparseable body. */
export class ContentSourceUnavailableException extends ContentSourceException {}
