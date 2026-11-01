import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

export const BASE_URL = 'https://cms.example.com';

interface Fixture {
  status: number;
  headers: Record<string, string | null>;
  body: unknown;
}

/** Loads a response recorded from the seeded Docker WordPress (see test/fixtures). */
export function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
}

type Responder = Fixture | ((url: URL, init: RequestInit | undefined) => Fixture | Promise<never>);

/**
 * A `fetch` double that routes by REST path (`wp/v2/posts`) and optional query predicate.
 * Every call is recorded so tests can assert on URLs and headers.
 */
export function fakeFetch(
  routes: Array<[path: string, responder: Responder, match?: (q: URLSearchParams) => boolean]>,
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const restPath = url.pathname.replace(/^\/wp-json\//, '');
    const route = routes.find(
      ([path, , match]) => path === restPath && (!match || match(url.searchParams)),
    );
    if (!route) throw new Error(`fakeFetch: no route for ${url}`);

    const result = typeof route[1] === 'function' ? await route[1](url, init) : route[1];
    const headers = new Headers({ 'content-type': 'application/json' });
    for (const [key, value] of Object.entries(result.headers))
      if (value !== null) headers.set(key, value);
    return new Response(JSON.stringify(result.body), { status: result.status, headers });
  });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Fixture {
  return { status, headers, body };
}

export function requestedUrls(fetchMock: ReturnType<typeof fakeFetch>): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input)));
}

export function headersOf(
  fetchMock: ReturnType<typeof fakeFetch>,
  call = 0,
): Record<string, string> {
  return (fetchMock.mock.calls[call]?.[1]?.headers ?? {}) as Record<string, string>;
}
