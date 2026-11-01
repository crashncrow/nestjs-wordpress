import { describe, expect, it } from 'vitest';
import type { Entry, Menu, Paginated, Term } from '../../src/core/dto/index.js';
import {
  type ContentChange,
  type ContentRead,
  tagsForChange,
  tagsForResult,
} from '../../src/invalidation/index.js';

// ------------------------------------------------------------------ fixtures

const news: Term = {
  id: 2,
  taxonomy: 'category',
  slug: 'news',
  name: 'News',
  description: '',
  count: 8,
  parentId: null,
  path: '/category/news/',
};

function post(id: number, extra: Partial<Entry> = {}): Entry {
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
    featuredImage: {
      id: 7,
      url: 'https://cms/wp-content/a.png',
      alt: '',
      width: 1,
      height: 1,
      mimeType: 'image/png',
      sizes: {},
    },
    author: { id: 1, name: 'Admin', slug: 'admin', avatarUrl: null },
    terms: {
      category: [
        { id: 2, taxonomy: 'category', slug: 'news', name: 'News', path: '/category/news/' },
      ],
    },
    ...extra,
  };
}

const page = (...items: Entry[]): Paginated<Entry> => ({
  items,
  total: items.length,
  totalPages: 1,
  page: 1,
  perPage: 10,
});

const menu: Menu = {
  id: 10,
  name: 'Primary',
  slug: 'primary',
  items: [
    {
      id: 30,
      title: 'About',
      url: '/about/',
      target: null,
      kind: 'entry',
      object: 'page',
      objectId: 21,
      children: [
        {
          id: 31,
          title: 'Team',
          url: '/about/team/',
          target: null,
          kind: 'entry',
          object: 'page',
          objectId: 22,
          children: [],
        },
      ],
    },
    {
      id: 32,
      title: 'News',
      url: '/category/news/',
      target: null,
      kind: 'term',
      object: 'category',
      objectId: 2,
      children: [],
    },
    {
      id: 33,
      title: 'GitHub',
      url: 'https://github.com',
      target: null,
      kind: 'custom',
      object: null,
      objectId: null,
      children: [],
    },
  ],
};

/** A cached result together with the read that produced it. */
type Cached = { read: ContentRead; result: unknown };

const results = {
  'post 12': {
    read: { kind: 'entry', type: 'post', lookup: { slug: 'post-12' } },
    result: post(12),
  },
  'post 13 (other author/image/term)': {
    read: { kind: 'entry', type: 'post', lookup: { id: 13 } },
    result: post(13, {
      author: { id: 5, name: 'Jane', slug: 'jane', avatarUrl: null },
      featuredImage: null,
      terms: {},
    }),
  },
  'unfiltered post list': {
    read: { kind: 'entries', type: 'post', query: {} },
    result: page(post(12)),
  },
  // PostsService passes every known taxonomy, unset ones as undefined.
  'post list with undefined filters': {
    read: {
      kind: 'entries',
      type: 'post',
      query: { taxonomies: { category: undefined, post_tag: undefined } },
    },
    result: page(),
  },
  'empty post list filtered by category': {
    read: { kind: 'entries', type: 'post', query: { taxonomies: { category: ['missing'] } } },
    result: page(),
  },
  'page by path about/team': {
    read: { kind: 'entry', type: 'page', lookup: { path: 'about/team' } },
    result: { ...post(22), type: 'page', terms: {} },
  },
  'category list': {
    read: { kind: 'terms', taxonomy: 'category', query: {} },
    result: { ...page(), items: [news] },
  },
  'primary menu': { read: { kind: 'menu', lookup: { location: 'primary' } }, result: menu },
} satisfies Record<string, Cached>;

type ResultName = keyof typeof results;

const changes: Record<string, ContentChange> = {
  'post 12 saved': {
    event: 'post.saved',
    type: 'post',
    id: 12,
    slug: 'post-12',
    taxonomies: ['category', 'post_tag'],
  },
  'new post published': {
    event: 'post.saved',
    type: 'post',
    id: 99,
    slug: 'new',
    taxonomies: ['category', 'post_tag'],
  },
  'page 21 renamed': { event: 'post.saved', type: 'page', id: 21, slug: 'about', taxonomies: [] },
  'term 2 renamed': { event: 'term.saved', type: 'category', id: 2, slug: 'news' },
  'tag 40 renamed': { event: 'term.saved', type: 'post_tag', id: 40, slug: 'misc' },
  'author 1 renamed': { event: 'user.saved', type: 'user', id: 1, slug: 'admin' },
  'image 7 edited': { event: 'post.saved', type: 'attachment', id: 7, slug: 'cover' },
  'menu 10 saved': { event: 'menu.saved', type: 'nav_menu', id: 10, slug: 'primary' },
};

/**
 * The contract, as a table: for each change, exactly which cached results must be invalidated.
 * Every result not listed must stay cached.
 */
const invalidates: Record<keyof typeof changes, ResultName[]> = {
  'post 12 saved': [
    'post 12',
    'unfiltered post list',
    'post list with undefined filters',
    'empty post list filtered by category',
    'category list',
  ],
  'new post published': [
    'unfiltered post list',
    'post list with undefined filters',
    'empty post list filtered by category',
    'category list',
  ],
  'page 21 renamed': ['page by path about/team', 'primary menu'],
  // Defect (a): term-linked menu items show the term name.
  'term 2 renamed': [
    'post 12',
    'unfiltered post list',
    'empty post list filtered by category',
    'category list',
    'primary menu',
  ],
  // Defect (b): a term edit must not hit lists that are not filtered by that taxonomy.
  'tag 40 renamed': [],
  // Defect (c): entries embed their author and featured image.
  'author 1 renamed': ['post 12', 'unfiltered post list', 'page by path about/team'],
  'image 7 edited': ['post 12', 'unfiltered post list', 'page by path about/team'],
  'menu 10 saved': ['primary menu'],
};

// ------------------------------------------------------------------ tests

describe('invalidation contract', () => {
  for (const [changeName, change] of Object.entries(changes)) {
    it(`${changeName} → invalidates exactly: ${invalidates[changeName]!.join(', ') || 'nothing'}`, () => {
      const changeTags = new Set(tagsForChange(change));
      const hit = (Object.entries(results) as Array<[ResultName, Cached]>)
        .filter(([, { read, result }]) =>
          tagsForResult(read, result as never).some((tag) => changeTags.has(tag)),
        )
        .map(([name]) => name);
      expect(hit.toSorted()).toEqual(invalidates[changeName]!.toSorted());
    });
  }

  it('returns deduplicated tags', () => {
    const tags = tagsForResult({ kind: 'entries', type: 'post' }, page(post(1), post(2)));
    expect(tags.length).toBe(new Set(tags).size);
  });
});
