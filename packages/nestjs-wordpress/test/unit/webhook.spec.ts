import { Injectable, type INestApplication } from '@nestjs/common';
import { EventEmitterModule, OnEvent } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ContentChangedEvent,
  PostsService,
  signWebhook,
  WORDPRESS_CONTENT_UPDATED,
  WordPressModule,
  type WordPressModuleExtras,
} from '../../src/index.js';
import { BASE_URL, fakeFetch, fixture } from '../helpers.js';

const SECRET = 'test-secret';

@Injectable()
class Listener {
  readonly received: ContentChangedEvent[] = [];

  @OnEvent(WORDPRESS_CONTENT_UPDATED)
  handle(event: ContentChangedEvent): void {
    this.received.push(event);
  }
}

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start({
  rawBody = true,
  extras = { webhookController: true } as WordPressModuleExtras,
} = {}) {
  const fetchMock = fakeFetch([['wp/v2/posts', fixture('post-by-slug')]]);
  const moduleRef = await Test.createTestingModule({
    imports: [
      EventEmitterModule.forRoot(),
      WordPressModule.forRoot({
        baseUrl: BASE_URL,
        fetch: fetchMock,
        cache: true,
        webhook: { secret: SECRET },
        ...extras,
      }),
    ],
    providers: [Listener],
  }).compile();
  app = moduleRef.createNestApplication({ rawBody, logger: false });
  await app.init();
  return { app, fetchMock, listener: app.get(Listener) };
}

const payload = {
  event: 'post.saved',
  id: 9,
  type: 'post',
  slug: 'demo-post-3',
  taxonomies: ['category', 'post_tag'],
};
// What the invalidation contract derives from that content change.
const expectedTags = ['post:9', 'type:post', 'taxonomy:category', 'taxonomy:post_tag'];

function send(
  target: INestApplication,
  body: object,
  headers: Record<string, string> = signWebhook(SECRET, JSON.stringify(body)),
  path = '/webhooks/wordpress',
) {
  return request(target.getHttpServer())
    .post(path)
    .set('content-type', 'application/json')
    .set(headers)
    .send(JSON.stringify(body));
}

describe('webhook endpoint', () => {
  it('invalidates the tagged cache entries and emits wordpress.content.updated', async () => {
    const { app: server, fetchMock, listener } = await start();
    const posts = server.get(PostsService);

    await posts.getBySlug('demo-post-3');
    await posts.getBySlug('demo-post-3');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await send(server, payload).expect(200, { invalidated: expectedTags });

    await posts.getBySlug('demo-post-3');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(listener.received).toHaveLength(1);
    expect(listener.received[0]).toBeInstanceOf(ContentChangedEvent);
    expect(listener.received[0]).toMatchObject({ ...payload, tags: expectedTags });
  });

  it('rejects a wrong signature, a tampered body and missing headers', async () => {
    const { app: server, listener } = await start();
    await send(server, payload, signWebhook('wrong-secret', JSON.stringify(payload))).expect(401);
    await send(server, { ...payload, id: 1 }, signWebhook(SECRET, JSON.stringify(payload))).expect(
      401,
    );
    await send(server, payload, {}).expect(401);
    expect(listener.received).toHaveLength(0);
  });

  it('rejects timestamps outside the tolerance window (replay protection)', async () => {
    const { app: server } = await start();
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    await send(server, payload, signWebhook(SECRET, JSON.stringify(payload), tenMinutesAgo)).expect(
      401,
    );
  });

  it('rejects a correctly signed but malformed payload', async () => {
    const { app: server } = await start();
    await send(server, { ...payload, event: 'post.exploded' }).expect(400);
    await send(server, { ...payload, taxonomies: 'category' }).expect(400);
    await send(server, { ...payload, id: '9' }).expect(400);
  });

  it('answers 500 (and logs how to fix it) when the app was created without rawBody', async () => {
    const { app: server } = await start({ rawBody: false });
    await send(server, payload).expect(500);
  });

  it('mounts the controller on a custom path', async () => {
    const { app: server } = await start({ extras: { webhookController: { path: 'hooks/wp' } } });
    await send(server, payload, undefined, '/hooks/wp').expect(200);
  });

  it('is not mounted unless enabled', async () => {
    const { app: server } = await start({ extras: {} });
    await send(server, payload).expect(404);
  });

  it('fails at bootstrap when enabled without a secret', async () => {
    await expect(
      Test.createTestingModule({
        imports: [WordPressModule.forRoot({ baseUrl: BASE_URL, webhookController: true })],
      }).compile(),
    ).rejects.toThrow(/webhook\.secret/);
  });
});
