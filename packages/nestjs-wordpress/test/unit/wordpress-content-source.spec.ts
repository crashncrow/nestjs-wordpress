import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_SOURCE,
  ContentNotFoundException,
  type ContentSource,
  EntriesService,
  MenusService,
  PagesService,
  PostsService,
  TermsService,
  WordPressModule,
  type WordPressModuleOptions,
} from '../../src/index.js';
import { BASE_URL, fakeFetch, fixture, headersOf, json, requestedUrls } from '../helpers.js';

/**
 * These tests go through the real Nest module (DI, options resolution, services, adapter,
 * normalizers); only `fetch` is replaced, fed with responses recorded from WordPress.
 */
async function setup(
  routes: Parameters<typeof fakeFetch>[0],
  extra: Partial<WordPressModuleOptions> = {},
) {
  const fetchMock = fakeFetch(routes);
  const moduleRef = await Test.createTestingModule({
    imports: [WordPressModule.forRoot({ baseUrl: BASE_URL, fetch: fetchMock, ...extra })],
  }).compile();
  return { moduleRef, fetchMock };
}

const AUTH = { username: 'admin', applicationPassword: 'secret' };

describe('posts', () => {
  it('lists posts as normalized DTOs with pagination totals', async () => {
    const { moduleRef } = await setup([['wp/v2/posts', fixture('posts-page-1')]]);
    const result = await moduleRef.get(PostsService).list({ perPage: 2 });

    expect(result).toMatchObject({ total: 12, totalPages: 6, page: 1, perPage: 2 });
    expect(result.items).toHaveLength(2);
  });

  it('normalizes a post: plain title/excerpt, relative links, UTC dates, embedded relations', async () => {
    const { moduleRef } = await setup([['wp/v2/posts', fixture('post-by-slug')]]);
    const post = await moduleRef.get(PostsService).getBySlug('demo-post-3');

    expect(post).toMatchObject({
      id: 9,
      type: 'post',
      slug: 'demo-post-3',
      title: 'Demo post 3',
      excerpt: 'Short excerpt for demo post 3.',
      date: '2026-10-22T19:57:26Z',
      path: '/demo-post-3/',
      parentId: null,
      author: { name: 'admin', slug: 'admin' },
      featuredImage: {
        url: `${BASE_URL}/wp-content/uploads/2026/11/cover-blue.png`,
        alt: 'Cover image cover-blue',
        width: 1200,
        height: 630,
      },
    });
    expect(post.content).toContain('<a href="/about/">about page</a>');
    expect(post.featuredImage!.sizes.medium).toMatchObject({ width: 300, height: 158 });
    expect(post.terms.category).toEqual([
      {
        id: 4,
        taxonomy: 'category',
        slug: 'nestjs',
        name: 'NestJS',
        path: '/category/tutorials/nestjs/',
      },
    ]);
    expect(post.terms.post_tag!.map((t) => t.slug)).toEqual(['headless', 'nestjs']);
  });

  it('returns featuredImage null when the post has none', async () => {
    const { moduleRef } = await setup([['wp/v2/posts', fixture('post-no-image')]]);
    const post = await moduleRef.get(PostsService).getBySlug('demo-post-2');
    expect(post.featuredImage).toBeNull();
    expect(post.author?.name).toBe('Jane Writer');
  });

  it('throws ContentNotFoundException for an unknown slug', async () => {
    const { moduleRef } = await setup([['wp/v2/posts', json([])]]);
    await expect(moduleRef.get(PostsService).getBySlug('nope')).rejects.toThrow(
      ContentNotFoundException,
    );
  });

  it('resolves category slugs to IDs before filtering', async () => {
    const { moduleRef, fetchMock } = await setup([
      ['wp/v2/categories', json([{ id: 4 }]), (q) => q.get('slug') === 'nestjs'],
      ['wp/v2/posts', json([], 200, { 'x-wp-total': '0', 'x-wp-totalpages': '0' })],
    ]);
    await moduleRef.get(PostsService).list({ categories: ['nestjs', 2] });

    const postsUrl = requestedUrls(fetchMock).find((u) => u.pathname.endsWith('/posts'))!;
    expect(postsUrl.searchParams.get('categories')).toBe('2,4');
  });

  it('returns an empty page without querying posts when a slug filter matches no term', async () => {
    const { moduleRef, fetchMock } = await setup([['wp/v2/categories', json([])]]);
    const result = await moduleRef.get(PostsService).list({ categories: ['missing'] });

    expect(result).toEqual({ items: [], total: 0, totalPages: 0, page: 1, perPage: 10 });
    expect(requestedUrls(fetchMock).some((u) => u.pathname.endsWith('/posts'))).toBe(false);
  });

  it('preview reads are authenticated and include unpublished statuses', async () => {
    const { moduleRef, fetchMock } = await setup([['wp/v2/posts', fixture('post-by-slug')]], {
      auth: AUTH,
    });
    await moduleRef.get(PostsService).getBySlug('demo-post-3', { preview: true });

    expect(requestedUrls(fetchMock)[0]!.searchParams.get('status')).toBe('any');
    expect(headersOf(fetchMock).authorization).toMatch(/^Basic /);
  });

  it('public reads stay anonymous even when credentials are configured', async () => {
    const { moduleRef, fetchMock } = await setup([['wp/v2/posts', fixture('post-by-slug')]], {
      auth: AUTH,
    });
    await moduleRef.get(PostsService).getBySlug('demo-post-3');
    expect(headersOf(fetchMock).authorization).toBeUndefined();
  });

  it('turns an anonymous 401 (draft by ID) into "not found"', async () => {
    const { moduleRef } = await setup([
      ['wp/v2/posts/19', json({ code: 'rest_forbidden', message: 'Sorry' }, 401)],
    ]);
    await expect(moduleRef.get(PostsService).getById(19)).rejects.toThrow(ContentNotFoundException);
  });
});

describe('pages', () => {
  it('disambiguates pages sharing a slug by their full path', async () => {
    const { moduleRef } = await setup([['wp/v2/pages', fixture('pages-team')]]);
    const pages = moduleRef.get(PagesService);

    await expect(pages.getByPath('about/team')).resolves.toMatchObject({ id: 22, parentId: 21 });
    await expect(pages.getByPath('/services/team/')).resolves.toMatchObject({
      id: 25,
      title: 'Services team',
    });
    await expect(pages.getByPath('other/team')).rejects.toThrow(ContentNotFoundException);
  });
});

describe('custom post types and taxonomies', () => {
  it('discovers routes once from /types and /taxonomies', async () => {
    const { moduleRef, fetchMock } = await setup([
      ['wp/v2/types', fixture('types')],
      ['wp/v2/taxonomies', fixture('taxonomies')],
      ['wp/v2/genres', json([{ id: 8 }]), (q) => q.get('slug') === 'sci-fi'],
      ['wp/v2/books', json([], 200, { 'x-wp-total': '0', 'x-wp-totalpages': '0' })],
    ]);
    const entries = moduleRef.get(EntriesService);

    await entries.list('book', { taxonomies: { genre: ['sci-fi'] } });
    await entries.list('book');

    const paths = requestedUrls(fetchMock).map((u) => u.pathname);
    expect(paths.filter((p) => p.endsWith('/types'))).toHaveLength(1);
    expect(
      requestedUrls(fetchMock)
        .find((u) => u.pathname.endsWith('/books'))!
        .searchParams.get('genres'),
    ).toBe('8');
  });

  it('reports unknown content types clearly', async () => {
    const { moduleRef } = await setup([['wp/v2/types', fixture('types')]]);
    await expect(moduleRef.get(EntriesService).list('movie')).rejects.toThrow(
      /Unknown content type "movie"/,
    );
  });

  it('lists terms of a built-in taxonomy', async () => {
    const { moduleRef } = await setup([['wp/v2/categories', fixture('categories')]]);
    const { items } = await moduleRef.get(TermsService).list('category', { perPage: 100 });
    expect(items.find((t) => t.slug === 'nestjs')).toMatchObject({
      parentId: 3,
      path: '/category/tutorials/nestjs/',
    });
  });
});

describe('menus', () => {
  const menuRoutes: Parameters<typeof fakeFetch>[0] = [
    ['wp/v2/menu-locations/primary', fixture('menu-location')],
    ['wp/v2/menus/10', fixture('menu')],
    ['wp/v2/menu-items', fixture('menu-items')],
  ];

  it('builds a tree with relative internal URLs', async () => {
    const { moduleRef, fetchMock } = await setup(menuRoutes, { auth: AUTH });
    const menu = await moduleRef.get(MenusService).getByLocation('primary');

    expect(menu).toMatchObject({ id: 10, name: 'Primary menu', slug: 'primary-menu' });
    expect(menu.items.map((i) => [i.title, i.url, i.kind])).toEqual([
      ['Home', '/', 'custom'],
      ['About', '/about/', 'entry'],
      ['News', '/category/news/', 'term'],
      ['GitHub', 'https://github.com/crashncrow/nestjs-wordpress', 'custom'],
    ]);
    expect(menu.items[1]!.children).toMatchObject([
      { title: 'Team', url: '/about/team/', object: 'page', objectId: 22 },
    ]);
    // Menus need credentials in core WordPress.
    expect(headersOf(fetchMock).authorization).toMatch(/^Basic /);
  });

  it('maps unknown and empty locations to "not found"', async () => {
    const { moduleRef } = await setup([
      [
        'wp/v2/menu-locations/nope',
        json({ code: 'rest_menu_location_invalid', message: 'x' }, 400),
      ],
      ['wp/v2/menu-locations/footer', json({ name: 'footer', description: 'Footer', menu: 0 })],
    ]);
    const menus = moduleRef.get(MenusService);
    await expect(menus.getByLocation('nope')).rejects.toThrow(ContentNotFoundException);
    await expect(menus.getByLocation('footer')).rejects.toThrow(ContentNotFoundException);
  });
});

describe('WordPressModule', () => {
  it('supports forRootAsync and exposes the agnostic CONTENT_SOURCE token', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', fixture('post-by-slug')]]);
    const moduleRef = await Test.createTestingModule({
      imports: [
        WordPressModule.forRootAsync({
          useFactory: async () => ({ baseUrl: BASE_URL, fetch: fetchMock }),
        }),
      ],
    }).compile();

    const source = moduleRef.get<ContentSource>(CONTENT_SOURCE);
    await expect(source.getEntry('post', { slug: 'demo-post-3' })).resolves.toMatchObject({
      id: 9,
    });
  });

  it('fails at bootstrap with an invalid baseUrl', async () => {
    await expect(
      Test.createTestingModule({
        imports: [WordPressModule.forRoot({ baseUrl: 'not a url' })],
      }).compile(),
    ).rejects.toThrow(/baseUrl/);
  });
});
