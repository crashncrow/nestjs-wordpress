import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Cacheable } from 'cacheable';
import type { TaggedCache } from './tagged-cache.interface.js';

export interface TaggedCacheOptions {
  /** Default time-to-live in milliseconds. */
  ttl: number;
  /** Redis connection URL. When omitted, an in-process memory cache is used. */
  redis?: string;
  /** Key prefix, so several apps can share one Redis. */
  namespace: string;
}

/**
 * {@link TaggedCache} on top of `cacheable`, which implements tag invalidation with per-tag
 * version counters (O(1) invalidation, checked lazily on read).
 *
 * Store layout:
 * - memory only (default): one in-process store; correct for a single instance.
 * - Redis: Redis is the ONLY store. `cacheable` can also keep an in-memory primary in front of
 *   a Redis secondary, but with tags enabled (cacheable 2.5) the first instance that reads an
 *   invalidated key deletes its shared tag snapshot, after which other instances keep serving
 *   their stale in-memory copy until TTL. A single shared store has no copies to go stale.
 */
export class CacheableTaggedCache implements TaggedCache, OnApplicationShutdown {
  private static readonly logger = new Logger('WordPressCache');

  private constructor(private readonly cache: Cacheable) {}

  /** Async factory: the Redis adapter is an optional peer dependency, loaded only when used. */
  static async create(options: TaggedCacheOptions): Promise<CacheableTaggedCache> {
    if (!options.redis) {
      return new CacheableTaggedCache(
        new Cacheable({ tags: true, ttl: options.ttl, namespace: options.namespace }),
      );
    }

    let createKeyv: typeof import('@keyv/redis').createKeyv;
    try {
      ({ createKeyv } = await import('@keyv/redis'));
    } catch (cause) {
      throw new Error(
        'WordPressModule: "cache.redis" requires the optional dependency "@keyv/redis" (npm i @keyv/redis)',
        {
          cause,
        },
      );
    }

    const store = createKeyv(options.redis, { namespace: options.namespace });
    // Without a listener, a Redis connection error would be an unhandled 'error' event.
    store.on('error', (error: unknown) =>
      CacheableTaggedCache.logger.error(`Redis error: ${String(error)}`),
    );
    return new CacheableTaggedCache(
      new Cacheable({ tags: true, ttl: options.ttl, namespace: options.namespace, primary: store }),
    );
  }

  get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  async set<T>(key: string, value: T, tags: readonly string[]): Promise<void> {
    await this.cache.set(key, value, { tags: [...tags] });
  }

  async invalidateTags(tags: readonly string[]): Promise<void> {
    if (tags.length > 0) await this.cache.tags.invalidateTags([...tags]);
  }

  /** Closes the Redis connection so the process can exit cleanly. */
  async onApplicationShutdown(): Promise<void> {
    await this.cache.disconnect();
  }
}
