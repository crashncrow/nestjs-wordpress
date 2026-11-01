import { describe, expect, it, vi } from 'vitest';
import { CacheableTaggedCache } from '../../src/core/cache/cacheable-tagged-cache.js';
import { CachedContentSource } from '../../src/core/cache/cached-content-source.js';
import { ContentTags } from '../../src/core/cache/content-tags.js';
import type { ContentSource } from '../../src/core/content-source.interface.js';
import type { Entry, Menu, Paginated } from '../../src/core/dto/index.js';
import { ContentNotFoundException } from '../../src/core/errors/content-source.exception.js';

function entry(id: number, termIds: number[] = []): Entry {
  return {
    id,
    type: 'post',
    slug: `post-${id}`,
    status: 'publish',
    title: `Post ${id}`,
    content: '',
    excerpt: '',
    date: '',
    modified: '',
    path: `/post-${id}/`,
    parentId: null,
    menuOrder: 0,
    featuredImage: null,
    author: null,
    terms: {
      category: termIds.map((t) => ({
        id: t,
        taxonomy: 'category',
        slug: `c${t}`,
        name: `C${t}`,
        path: '',
      })),
    },
  };
}

const page = (...items: Entry[]): Paginated<Entry> => ({
  items,
  total: items.length,
  totalPages: 1,
  page: 1,
  perPage: 10,
});

/** A ContentSource double whose results change on every call, so cache hits are observable. */
function fakeSource() {
  let version = 0;
  return {
    listEntries: vi.fn<ContentSource['listEntries']>(async () => page(entry(1, [5]), entry(2))),
    getEntry: vi.fn<ContentSource['getEntry']>(async (_type, lookup) => ({
      ...entry('id' in lookup ? lookup.id : 1, [5]),
      title: `v${++version}`,
    })),
    listTerms: vi.fn<ContentSource['listTerms']>(),
    getTerm: vi.fn<ContentSource['getTerm']>(),
    getMenu: vi.fn<ContentSource['getMenu']>(async (): Promise<Menu> => ({
      id: 10,
      name: 'Main',
      slug: 'main',
      items: [],
    })),
  } satisfies ContentSource;
}

async function setup() {
  const inner = fakeSource();
  const cache = await CacheableTaggedCache.create({
    ttl: 60_000,
    namespace: `test-${Math.random()}`,
  });
  return {
    inner,
    cache,
    source: new CachedContentSource(inner, cache),
  };
}

describe('CachedContentSource', () => {
  it('serves repeated reads from the cache, regardless of query key order', async () => {
    const { inner, source } = await setup();
    await source.listEntries('post', { page: 1, perPage: 10 });
    await source.listEntries('post', { perPage: 10, page: 1 });
    expect(inner.listEntries).toHaveBeenCalledTimes(1);
  });

  it('invalidates an entry by its own tag and by the tags of terms it embeds', async () => {
    const { source, cache } = await setup();
    expect((await source.getEntry('post', { id: 1 })).title).toBe('v1');
    expect((await source.getEntry('post', { id: 1 })).title).toBe('v1');

    await cache.invalidateTags([ContentTags.entry('post', 1)]);
    expect((await source.getEntry('post', { id: 1 })).title).toBe('v2');

    await cache.invalidateTags([ContentTags.term(5)]);
    expect((await source.getEntry('post', { id: 1 })).title).toBe('v3');
  });

  it('invalidates lists by type tag and leaves unrelated entries cached', async () => {
    const { inner, source, cache } = await setup();
    await source.listEntries('post');
    await source.getEntry('post', { id: 7 });

    await cache.invalidateTags([ContentTags.type('post')]);
    await source.listEntries('post');
    await source.getEntry('post', { id: 7 });

    expect(inner.listEntries).toHaveBeenCalledTimes(2);
    expect(inner.getEntry).toHaveBeenCalledTimes(1);
  });

  it('ties path lookups to the type tag, since a parent rename changes the path', async () => {
    const { inner, source, cache } = await setup();
    await source.getEntry('post', { path: 'a/b' });
    await cache.invalidateTags([ContentTags.type('post')]);
    await source.getEntry('post', { path: 'a/b' });
    expect(inner.getEntry).toHaveBeenCalledTimes(2);
  });

  it('caches menus under menu:<id> and the global menus tag', async () => {
    const { inner, source, cache } = await setup();
    await source.getMenu({ location: 'primary' });
    await cache.invalidateTags([ContentTags.menus]);
    await source.getMenu({ location: 'primary' });
    expect(inner.getMenu).toHaveBeenCalledTimes(2);
  });

  it('never caches preview reads or errors', async () => {
    const { inner, source } = await setup();
    await source.getEntry('post', { id: 1 }, { preview: true });
    await source.getEntry('post', { id: 1 }, { preview: true });
    expect(inner.getEntry).toHaveBeenCalledTimes(2);

    inner.getEntry.mockRejectedValueOnce(new ContentNotFoundException('nope'));
    await expect(source.getEntry('post', { id: 99 })).rejects.toThrow(ContentNotFoundException);
    await source.getEntry('post', { id: 99 });
    expect(inner.getEntry).toHaveBeenCalledTimes(4);
  });

  it('shares one upstream request between concurrent misses', async () => {
    const { inner, source } = await setup();
    await Promise.all([
      source.listEntries('post'),
      source.listEntries('post'),
      source.listEntries('post'),
    ]);
    expect(inner.listEntries).toHaveBeenCalledTimes(1);
  });
});
