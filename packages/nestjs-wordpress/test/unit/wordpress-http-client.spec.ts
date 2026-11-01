import { describe, expect, it, vi } from 'vitest';
import {
  ContentBadRequestException,
  ContentForbiddenException,
  ContentNotFoundException,
  ContentSourceTimeoutException,
  ContentSourceUnavailableException,
  ContentUnauthorizedException,
} from '../../src/core/errors/content-source.exception.js';
import { WordPressHttpClient } from '../../src/wordpress/http/wordpress-http-client.js';
import { resolveWordPressOptions } from '../../src/wordpress/resolve-options.js';
import type { WordPressModuleOptions } from '../../src/wordpress/wordpress-options.interface.js';
import { BASE_URL, fakeFetch, fixture, headersOf, json, requestedUrls } from '../helpers.js';

// The client is a plain class, so it can be unit-tested without a Nest testing module.
function client(fetchImpl: typeof fetch, extra: Partial<WordPressModuleOptions> = {}) {
  return new WordPressHttpClient(
    resolveWordPressOptions({ baseUrl: BASE_URL, fetch: fetchImpl, ...extra }),
  );
}

describe('WordPressHttpClient', () => {
  it('builds URLs under the REST prefix and joins array params with commas', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', json([])]]);
    await client(fetchMock).get({
      path: 'wp/v2/posts',
      query: { categories: [1, 2], search: undefined },
    });

    const [url] = requestedUrls(fetchMock);
    expect(url!.toString()).toBe(`${BASE_URL}/wp-json/wp/v2/posts?categories=1%2C2`);
  });

  it('reads pagination totals from X-WP-Total / X-WP-TotalPages', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', fixture('posts-page-1')]]);
    const response = await client(fetchMock).get({ path: 'wp/v2/posts' });
    expect(response).toMatchObject({ total: 12, totalPages: 6 });
  });

  it('sends Basic auth only for authenticated requests', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', json([])]]);
    const wp = client(fetchMock, { auth: { username: 'admin', applicationPassword: 'abcd efgh' } });

    await wp.get({ path: 'wp/v2/posts' });
    await wp.get({ path: 'wp/v2/posts', authenticated: true });

    expect(headersOf(fetchMock, 0).authorization).toBeUndefined();
    expect(headersOf(fetchMock, 1).authorization).toBe(
      `Basic ${Buffer.from('admin:abcd efgh').toString('base64')}`,
    );
  });

  it('fails fast when credentials are required but not configured', async () => {
    const fetchMock = fakeFetch([]);
    await expect(
      client(fetchMock).get({ path: 'wp/v2/menus', authenticated: true }),
    ).rejects.toThrow(ContentUnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'rest_invalid_param', ContentBadRequestException],
    [401, 'rest_forbidden', ContentUnauthorizedException],
    [403, 'rest_cannot_read', ContentForbiddenException],
    [404, 'rest_post_invalid_id', ContentNotFoundException],
    [500, 'internal_server_error', ContentSourceUnavailableException],
    [503, undefined, ContentSourceUnavailableException],
  ])('maps HTTP %i (%s) to %o', async (status, code, expected) => {
    const fetchMock = fakeFetch([
      ['wp/v2/posts', json(code ? { code, message: 'x' } : '', status)],
    ]);
    const error = await client(fetchMock)
      .get({ path: 'wp/v2/posts' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(expected);
    expect(error).toMatchObject({ upstreamStatus: status, code });
  });

  it('treats a page past the end as "not found" rather than a bad request', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', fixture('error-invalid-page')]]);
    await expect(client(fetchMock).get({ path: 'wp/v2/posts' })).rejects.toThrow(
      ContentNotFoundException,
    );
  });

  it('maps a non-JSON body (PHP fatal error page) to "unavailable"', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response('<html>Critical error</html>', { status: 500 }),
    );
    await expect(client(fetchMock).get({ path: 'wp/v2/posts' })).rejects.toThrow(
      ContentSourceUnavailableException,
    );
  });

  it('maps network failures and timeouts', async () => {
    const network = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(client(network).get({ path: 'wp/v2/posts' })).rejects.toThrow(
      ContentSourceUnavailableException,
    );

    // Honors the AbortSignal like the real fetch does.
    const hanging = vi.fn<typeof fetch>(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    await expect(client(hanging, { timeout: 20 }).get({ path: 'wp/v2/posts' })).rejects.toThrow(
      ContentSourceTimeoutException,
    );
  });
});

describe('resolveWordPressOptions', () => {
  it('rejects invalid configuration at bootstrap', () => {
    expect(() => resolveWordPressOptions({ baseUrl: 'cms.example.com' })).toThrow(/absolute URL/);
    expect(() => resolveWordPressOptions({ baseUrl: 'ftp://cms' })).toThrow(/http or https/);
    expect(() => resolveWordPressOptions({ baseUrl: BASE_URL, timeout: 0 })).toThrow(/timeout/);
    expect(() =>
      resolveWordPressOptions({
        baseUrl: BASE_URL,
        auth: { username: 'a', applicationPassword: '' },
      }),
    ).toThrow(/auth/);
  });

  it('normalizes subdirectory installs and custom prefixes', () => {
    const options = resolveWordPressOptions({ baseUrl: 'https://x.com/blog', apiPrefix: '/api/' });
    expect(options.apiUrl.toString()).toBe('https://x.com/blog/api/');
  });
});
