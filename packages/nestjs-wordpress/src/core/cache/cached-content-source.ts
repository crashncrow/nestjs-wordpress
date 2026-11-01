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
import { ContentTags, entryTags, menuTags, termTags } from './content-tags.js';
import type { TaggedCache } from './tagged-cache.interface.js';

/**
 * Caching decorator around any {@link ContentSource} (decorator pattern): same interface,
 * extra behavior. Because it only sees normalized DTOs, it works for every adapter.
 *
 * - Tags are derived from the *result*, so an entry is tagged with the terms it embeds.
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
    return this.cached(
      key('entries', type, query),
      () => this.inner.listEntries(type, query),
      (page) => [
        ContentTags.type(type),
        // Lists filtered by term slug change when a term is created or renamed.
        ...Object.keys(query.taxonomies ?? {}).map(ContentTags.taxonomy),
        ...page.items.flatMap(entryTags),
      ],
    );
  }

  getEntry(type: string, lookup: EntryLookup, options: ReadOptions = {}): Promise<Entry> {
    if (options.preview) return this.inner.getEntry(type, lookup, options);
    return this.cached(
      key('entry', type, lookup),
      () => this.inner.getEntry(type, lookup),
      (entry) => [
        ...entryTags(entry),
        // A path depends on every ancestor's slug. Rather than tracking ancestors, path
        // lookups are tied to the whole type: coarser, but never stale.
        ...('path' in lookup ? [ContentTags.type(type)] : []),
      ],
    );
  }

  listTerms(taxonomy: string, query: TermListQuery = {}): Promise<Paginated<Term>> {
    return this.cached(
      key('terms', taxonomy, query),
      () => this.inner.listTerms(taxonomy, query),
      (page) => [ContentTags.taxonomy(taxonomy), ...page.items.flatMap(termTags)],
    );
  }

  getTerm(taxonomy: string, lookup: TermLookup): Promise<Term> {
    return this.cached(
      key('term', taxonomy, lookup),
      () => this.inner.getTerm(taxonomy, lookup),
      termTags,
    );
  }

  getMenu(lookup: MenuLookup): Promise<Menu> {
    return this.cached(key('menu', lookup), () => this.inner.getMenu(lookup), menuTags);
  }

  private async cached<T>(
    cacheKey: string,
    load: () => Promise<T>,
    tagsOf: (value: T) => string[],
  ): Promise<T> {
    const hit = await this.cache.get<T>(cacheKey);
    if (hit !== undefined) return hit;

    const pending = this.inFlight.get(cacheKey) as Promise<T> | undefined;
    if (pending) return pending;

    const request = (async () => {
      try {
        const value = await load();
        await this.cache.set(cacheKey, value, [...new Set(tagsOf(value))]);
        return value;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();
    this.inFlight.set(cacheKey, request);
    return request;
  }
}

/** Deterministic key: object keys are sorted so `{a,b}` and `{b,a}` hit the same entry. */
function key(...parts: unknown[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : stableStringify(part))).join('|');
}

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
