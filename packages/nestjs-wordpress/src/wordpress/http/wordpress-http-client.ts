import { Inject, Injectable } from '@nestjs/common';
import {
  ContentBadRequestException,
  ContentForbiddenException,
  ContentNotFoundException,
  ContentSourceException,
  ContentSourceTimeoutException,
  ContentSourceUnavailableException,
  ContentUnauthorizedException,
} from '../../core/errors/content-source.exception.js';
import type { ResolvedWordPressOptions } from '../wordpress-options.interface.js';
import { WORDPRESS_RESOLVED_OPTIONS } from '../wordpress.module-definition.js';

export type QueryValue = string | number | boolean | ReadonlyArray<string | number> | undefined;

export interface WordPressRequest {
  /** Path relative to the REST prefix, e.g. `wp/v2/posts`. */
  path: string;
  query?: Record<string, QueryValue>;
  /** Send the configured credentials. Fails fast if none are configured. */
  authenticated?: boolean;
}

export interface WordPressResponse<T> {
  data: T;
  /** From `X-WP-Total`; only present on collection endpoints. */
  total: number | undefined;
  /** From `X-WP-TotalPages`; only present on collection endpoints. */
  totalPages: number | undefined;
}

interface WordPressErrorBody {
  code?: string;
  message?: string;
}

/**
 * Low-level client for the WordPress REST API, built on the native `fetch`.
 *
 * Exported so other modules (e.g. a future WooCommerce module) can reuse the base URL,
 * credentials, timeout and error mapping instead of re-implementing them.
 */
@Injectable()
export class WordPressHttpClient {
  constructor(
    @Inject(WORDPRESS_RESOLVED_OPTIONS) private readonly options: ResolvedWordPressOptions,
  ) {}

  get canAuthenticate(): boolean {
    return this.options.auth !== undefined;
  }

  async get<T>(request: WordPressRequest): Promise<WordPressResponse<T>> {
    const url = this.buildUrl(request);
    const headers: Record<string, string> = { accept: 'application/json' };

    if (request.authenticated) {
      const { auth } = this.options;
      if (!auth) {
        throw new ContentUnauthorizedException(
          `WordPress request to ${request.path} needs credentials, but no "auth" option is configured`,
        );
      }
      const token = Buffer.from(`${auth.username}:${auth.applicationPassword}`).toString('base64');
      headers.authorization = `Basic ${token}`;
    }

    let response: Response;
    try {
      response = await this.options.fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.options.timeout),
      });
    } catch (error) {
      throw toTransportException(error, url, this.options.timeout);
    }

    const body = await readJson(response, url);
    if (!response.ok) {
      throw toHttpException(response.status, body as WordPressErrorBody | undefined, url);
    }

    return {
      data: body as T,
      total: parseHeaderInt(response.headers.get('x-wp-total')),
      totalPages: parseHeaderInt(response.headers.get('x-wp-totalpages')),
    };
  }

  private buildUrl({ path, query = {} }: WordPressRequest): URL {
    const url = new URL(path.replace(/^\/+/, ''), this.options.apiUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      // WordPress accepts comma-separated lists for array parameters (`categories=1,2`).
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return url;
  }
}

async function readJson(response: Response, url: URL): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch (cause) {
    // Typical when a PHP fatal error or a proxy returns an HTML page.
    throw new ContentSourceUnavailableException(
      `WordPress returned a non-JSON body (HTTP ${response.status}) for ${redact(url)}`,
      { upstreamStatus: response.status, cause },
    );
  }
}

function toTransportException(error: unknown, url: URL, timeout: number): ContentSourceException {
  // AbortSignal.timeout() rejects with a DOMException named "TimeoutError".
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new ContentSourceTimeoutException(
      `WordPress did not answer within ${timeout}ms (${redact(url)})`,
      { cause: error },
    );
  }
  return new ContentSourceUnavailableException(`Could not reach WordPress at ${redact(url)}`, {
    cause: error,
  });
}

function toHttpException(
  status: number,
  body: WordPressErrorBody | undefined,
  url: URL,
): ContentSourceException {
  const code = body?.code;
  const message = `WordPress responded ${status}${code ? ` (${code})` : ''} for ${redact(url)}`;
  const details = { upstreamStatus: status, code };

  // Asking for a page past the end is "nothing here", not a malformed request.
  if (code === 'rest_post_invalid_page_number')
    return new ContentNotFoundException(message, details);

  if (status === 400) return new ContentBadRequestException(message, details);
  if (status === 401) return new ContentUnauthorizedException(message, details);
  if (status === 403) return new ContentForbiddenException(message, details);
  if (status === 404) return new ContentNotFoundException(message, details);
  if (status >= 500) return new ContentSourceUnavailableException(message, details);
  return new ContentSourceException(message, details);
}

function parseHeaderInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Error messages may end up in logs: never include credentials embedded in the URL. */
function redact(url: URL): string {
  const copy = new URL(url);
  copy.username = '';
  copy.password = '';
  return copy.toString();
}
