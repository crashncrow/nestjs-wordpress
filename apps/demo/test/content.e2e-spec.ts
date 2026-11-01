import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EntriesService, PostsService } from 'nestjs-wordpress';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

/**
 * Runs the demo app against the WordPress started by `pnpm wp:up` and filled by
 * `pnpm wp:seed`. The expected numbers come from docker/seed-wp.sh.
 */
describe('Content endpoints (e2e, real WordPress)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const probe = await http().get('/posts?perPage=1');
    if (probe.status !== 200) {
      throw new Error(
        `WordPress is not reachable (HTTP ${probe.status}). Run: pnpm wp:up && pnpm wp:seed`,
      );
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /posts', () => {
    it('paginates the 12 seeded posts, newest first', async () => {
      const { body } = await http().get('/posts').expect(200);
      expect(body).toMatchObject({ total: 12, totalPages: 2, page: 1, perPage: 10 });
      expect(body.items).toHaveLength(10);
      expect(body.items[0].slug).toBe('demo-post-12');

      const page2 = await http().get('/posts?page=2').expect(200);
      expect(page2.body.items).toHaveLength(2);
    });

    it('filters by category and tag slugs', async () => {
      expect((await http().get('/posts?category=nestjs').expect(200)).body.total).toBe(4);
      expect((await http().get('/posts?tag=headless').expect(200)).body.total).toBe(4);
      expect((await http().get('/posts?category=does-not-exist').expect(200)).body.total).toBe(0);
    });

    it('maps out-of-range pages to 404 and invalid params to 400', async () => {
      await http().get('/posts?page=99').expect(404);
      await http().get('/posts?perPage=500').expect(400);
      await http().get('/posts?page=abc').expect(400);
    });
  });

  describe('GET /posts/:slug', () => {
    it('returns a normalized post', async () => {
      const { body } = await http().get('/posts/demo-post-3').expect(200);
      expect(body).toMatchObject({
        slug: 'demo-post-3',
        title: 'Demo post 3',
        path: '/demo-post-3/',
        author: { slug: 'admin' },
        terms: { category: [{ slug: 'nestjs' }] },
      });
      // Links become relative, media stays absolute on the CMS host.
      expect(body.content).toContain('href="/about/"');
      expect(body.featuredImage.url).toMatch(/^http:\/\/localhost:8080\/wp-content\/uploads\//);
    });

    it('returns 404 for unknown slugs and for drafts', async () => {
      const { body } = await http().get('/posts/nope').expect(404);
      expect(body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Content not found' });
      await http().get('/posts/draft-post').expect(404);
    });
  });

  describe('GET /pages/*path', () => {
    it('resolves nested pages by full path', async () => {
      const { body } = await http().get('/pages/about/team/leadership').expect(200);
      expect(body).toMatchObject({ title: 'Leadership', path: '/about/team/leadership/' });
    });

    it('distinguishes pages that share a slug under different parents', async () => {
      expect((await http().get('/pages/about/team').expect(200)).body.title).toBe('Team');
      expect((await http().get('/pages/services/team').expect(200)).body.title).toBe(
        'Services team',
      );
      await http().get('/pages/nope/team').expect(404);
    });
  });

  describe('GET /menus/:location', () => {
    it('returns the primary menu as a tree', async () => {
      const { body } = await http().get('/menus/primary').expect(200);
      expect(body.items.map((item: { title: string }) => item.title)).toEqual([
        'Home',
        'About',
        'News',
        'GitHub',
      ]);
      expect(body.items[1].children[0]).toMatchObject({ title: 'Team', url: '/about/team/' });
    });

    it('returns 404 for empty or unknown locations', async () => {
      await http().get('/menus/footer').expect(404);
      await http().get('/menus/does-not-exist').expect(404);
    });
  });

  describe('GET /categories/:slug', () => {
    it('returns a category term, or 404', async () => {
      const { body } = await http().get('/categories/nestjs').expect(200);
      expect(body).toMatchObject({
        name: 'NestJS',
        parentId: expect.any(Number),
        path: '/category/tutorials/nestjs/',
      });
      await http().get('/categories/does-not-exist').expect(404);
    });
  });

  describe('GET /home (BFF aggregate)', () => {
    it('combines page, menu, posts and categories in one response', async () => {
      const { body } = await http().get('/home').expect(200);
      expect(body.hero.title).toBe('Home');
      expect(body.navigation).toHaveLength(4);
      expect(body.latestPosts).toHaveLength(3);
      expect(body.latestPosts[0]).toEqual({
        title: 'Demo post 12',
        path: '/demo-post-12/',
        excerpt: 'Short excerpt for demo post 12.',
        date: expect.any(String),
        imageUrl: expect.stringContaining('/wp-content/uploads/'),
      });
      expect(body.categories[0]).toEqual({ name: 'News', path: '/category/news/', count: 8 });
      // What the aggregate depends on, from the invalidation contract (pages linked in the menu,
      // the posts' authors and images, the category list).
      expect(body.cacheTags).toEqual(
        expect.arrayContaining(['type:page', 'menus', 'type:post', 'taxonomy:category', 'user:1']),
      );
      expect(body.cacheTags.some((tag: string) => tag.startsWith('attachment:'))).toBe(true);
    });
  });

  describe('library services (not exposed by the demo)', () => {
    it('reads drafts with preview: true using the application password', async () => {
      const draft = await app.get(PostsService).getBySlug('draft-post', { preview: true });
      expect(draft.status).toBe('draft');
    });

    it('reads custom post types filtered by a custom taxonomy', async () => {
      const books = await app
        .get(EntriesService)
        .list('book', { taxonomies: { genre: ['sci-fi'] } });
      expect(books.items.map((b) => b.slug).toSorted()).toEqual(['dune-notes', 'foundation-notes']);
    });
  });
});
