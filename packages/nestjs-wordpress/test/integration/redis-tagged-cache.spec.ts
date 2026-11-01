import { connect } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { CacheableTaggedCache } from '../../src/core/cache/cacheable-tagged-cache.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/** Runs only when a Redis is reachable (`pnpm wp:up` starts one). */
async function redisAvailable(): Promise<boolean> {
  const { hostname, port } = new URL(REDIS_URL);
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: Number(port || 6379) });
    socket.setTimeout(500);
    socket.once('connect', () => resolve(socket.end() && true));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => resolve(socket.destroy() && false));
  });
}

describe.skipIf(!(await redisAvailable()))(
  'CacheableTaggedCache with Redis (two app instances)',
  () => {
    const namespace = `it-${Date.now()}`;
    const instances: CacheableTaggedCache[] = [];
    const create = async () => {
      const cache = await CacheableTaggedCache.create({ ttl: 60_000, redis: REDIS_URL, namespace });
      instances.push(cache);
      return cache;
    };

    afterAll(async () => {
      await Promise.all(instances.map((cache) => cache.onApplicationShutdown()));
    });

    // Regression guard for the store layout: with an in-memory primary in front of Redis, the
    // instance that did NOT read first kept serving its stale local copy after invalidation.
    it.each(['writer', 'reader'] as const)(
      'an invalidation is visible to both instances when the %s reads first',
      async (firstReader) => {
        const writer = await create();
        const reader = await create();
        const key = `k-${firstReader}`;

        await writer.set(key, 'v1', ['post:7']);
        expect(await reader.get(key)).toBe('v1');

        await writer.invalidateTags(['post:7']);
        const [first, second] = firstReader === 'writer' ? [writer, reader] : [reader, writer];
        expect(await first.get(key)).toBeUndefined();
        expect(await second.get(key)).toBeUndefined();

        await writer.set(key, 'v2', ['post:7']);
        expect(await reader.get(key)).toBe('v2');
      },
    );
  },
);
