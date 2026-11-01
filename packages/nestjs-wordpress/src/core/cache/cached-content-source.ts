import { type ContentRead, tagsForResult } from '../../invalidation/index.js';
import type {
  ContentSource,
  EntryListQuery,
  EntryLookup,
  MenuLookup,
  ReadOptions,
  TermListQuery,
  TermLookup,
} from '../content-source.interface.js';
import type { Entry, Menu, Paginated, Term } from '../dto/index.js';
import type { TaggedCache } from './tagged-cache.interface.js';

/**
 * Caching decorator around any {@link ContentSource} (decorator pattern): same interface,
 * extra behavior. Because it only sees normalized DTOs, it works for every adapter.
 *
 * - Each call is described as a `ContentRead`, which is both the cache key and the input to
 *   the invalidation contract (`tagsForResult`), so tags always match what was read.
 * - Errors are never cached (a 404 now may be published content in a minute).
 * - Preview reads bypass the cache entirely: drafts must never be served to anonymous users.
 * - Concurrent misses for the same key share one upstream request (no cache stampede).
 */
export class CachedContentSource implements ContentSource {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly inner: ContentSource,
    private readonly cache: TaggedCache,
  ) {}

  listEntries(
    type: string,
    query: EntryListQuery = {},
    options: ReadOptions = {},
  ): Promise<Paginated<Entry>> {
    if (options.preview) return this.inner.listEntries(type, query, options);
    return this.cached({ kind: 'entries', type, query }, () => this.inner.listEntries(type, query));
  }

  getEntry(type: string, lookup: EntryLookup, options: ReadOptions = {}): Promise<Entry> {
    if (options.preview) return this.inner.getEntry(type, lookup, options);
    return this.cached({ kind: 'entry', type, lookup }, () => this.inner.getEntry(type, lookup));
  }

  listTerms(taxonomy: string, query: TermListQuery = {}): Promise<Paginated<Term>> {
    return this.cached({ kind: 'terms', taxonomy, query }, () =>
      this.inner.listTerms(taxonomy, query),
    );
  }

  getTerm(taxonomy: string, lookup: TermLookup): Promise<Term> {
    return this.cached({ kind: 'term', taxonomy, lookup }, () =>
      this.inner.getTerm(taxonomy, lookup),
    );
  }

  getMenu(lookup: MenuLookup): Promise<Menu> {
    return this.cached({ kind: 'menu', lookup }, () => this.inner.getMenu(lookup));
  }

  private async cached<T>(read: ContentRead, load: () => Promise<T>): Promise<T> {
    const cacheKey = stableStringify(read);
    const hit = await this.cache.get<T>(cacheKey);
    if (hit !== undefined) return hit;

    const pending = this.inFlight.get(cacheKey) as Promise<T> | undefined;
    if (pending) return pending;

    const request = (async () => {
      try {
        const value = await load();
        await this.cache.set(cacheKey, value, tagsForResult(read, value as never));
        return value;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();
    this.inFlight.set(cacheKey, request);
    return request;
  }
}

/** Deterministic key: object keys are sorted and `undefined` dropped, so equal reads share a key. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
