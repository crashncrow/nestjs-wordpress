import 'reflect-metadata';
import { execFile } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { type ContentChangedEvent, WORDPRESS_CONTENT_UPDATED } from 'nestjs-wordpress';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

const exec = promisify(execFile);
const COMPOSE = fileURLToPath(new URL('../../../docker/compose.sh', import.meta.url));

/**
 * Full loop against the Docker WordPress:
 *   WP-CLI edit → plugin signs + POSTs the webhook → guard → cache invalidated → event emitted.
 *
 * The app listens on a random port and each WP-CLI run is told to call that port, so the test
 * never collides with a dev server on :3000.
 */
describe('Webhook flow (e2e, real WordPress + plugin)', { timeout: 90_000 }, () => {
  let app: INestApplication;
  let webhookUrl: string;
  const http = () => request(app.getHttpServer());

  /** Runs `wp ...` in the wpcli container. `notify: false` skips our plugin (no webhook). */
  async function wp(args: string[], { notify = true } = {}): Promise<string> {
    const pluginFlag = notify ? [] : ['--skip-plugins=nestjs-wordpress-webhooks'];
    const { stdout } = await exec('bash', [
      COMPOSE,
      '--profile',
      'seed',
      'run',
      '--rm',
      '-T',
      '-e',
      `NWP_WEBHOOK_URL=${webhookUrl}`,
      'wpcli',
      'wp',
      ...pluginFlag,
      ...args,
    ]);
    return stdout.trim();
  }

  function nextEvent(match: (event: ContentChangedEvent) => boolean): Promise<ContentChangedEvent> {
    const emitter = app.get(EventEmitter2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No webhook event within 20s')), 20_000);
      const listener = (event: ContentChangedEvent) => {
        if (!match(event)) return;
        clearTimeout(timer);
        emitter.off(WORDPRESS_CONTENT_UPDATED, listener);
        resolve(event);
      };
      emitter.on(WORDPRESS_CONTENT_UPDATED, listener);
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error', 'warn'] });
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    webhookUrl = `http://host.docker.internal:${port}/webhooks/wordpress`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves cached posts until the signed webhook invalidates them', async () => {
    const { body: before } = await http().get('/posts/demo-post-5').expect(200);
    expect(before.title).toBe('Demo post 5');
    const stamp = Date.now();

    try {
      // 1. Edit without the plugin: WordPress changes, nobody is told, the cache keeps serving.
      await wp(['post', 'update', String(before.id), `--post_title=Silent ${stamp}`], {
        notify: false,
      });
      expect((await http().get('/posts/demo-post-5').expect(200)).body.title).toBe('Demo post 5');

      // 2. Edit with the plugin: the webhook invalidates post:<id> and the next read is fresh.
      const event = nextEvent((e) => e.id === before.id);
      await wp(['post', 'update', String(before.id), `--post_title=Fresh ${stamp}`]);
      expect(await event).toMatchObject({
        event: 'post.saved',
        type: 'post',
        slug: 'demo-post-5',
        tags: expect.arrayContaining([`post:${before.id}`, 'type:post']),
      });
      expect((await http().get('/posts/demo-post-5').expect(200)).body.title).toBe(
        `Fresh ${stamp}`,
      );
    } finally {
      await wp(['post', 'update', String(before.id), '--post_title=Demo post 5']);
    }
  });

  it('refreshes entries that embed a term when the term is renamed', async () => {
    const { body: post } = await http().get('/posts/demo-post-3').expect(200);
    const term = post.terms.category[0];
    expect(term.name).toBe('NestJS');

    try {
      const event = nextEvent((e) => e.id === term.id);
      await wp(['term', 'update', 'category', String(term.id), '--name=NestJS renamed']);
      expect((await event).tags).toEqual([`term:${term.id}`, 'taxonomy:category']);

      const { body: after } = await http().get('/posts/demo-post-3').expect(200);
      expect(after.terms.category[0].name).toBe('NestJS renamed');
    } finally {
      await wp(['term', 'update', 'category', String(term.id), '--name=NestJS']);
    }
  });

  it('refreshes menus when a menu item changes', async () => {
    const { body: menu } = await http().get('/menus/primary').expect(200);
    const github = menu.items.find((item: { title: string }) => item.title === 'GitHub');

    try {
      const event = nextEvent((e) => e.event === 'menu.saved');
      await wp(['menu', 'item', 'update', String(github.id), '--title=Source code']);
      expect((await event).tags).toEqual([`menu:${menu.id}`, 'menus']);

      const { body: after } = await http().get('/menus/primary').expect(200);
      expect(after.items.map((item: { title: string }) => item.title)).toContain('Source code');
    } finally {
      await wp(['menu', 'item', 'update', String(github.id), '--title=GitHub']);
    }
  });

  it('rejects unsigned requests to the webhook endpoint', async () => {
    await http()
      .post('/webhooks/wordpress')
      .send({ event: 'post.saved', tags: ['type:post'], id: 1, type: 'post', slug: 'x' })
      .expect(401);
  });
});
