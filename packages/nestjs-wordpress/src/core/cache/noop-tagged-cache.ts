import type { TaggedCache } from './tagged-cache.interface.js';

/**
 * Used when caching is disabled, so `CACHE_INVALIDATOR` can always be injected (the webhook
 * controller and app listeners do not need to know whether caching is on).
 */
export class NoopTaggedCache implements TaggedCache {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async set(): Promise<void> {}

  async invalidateTags(): Promise<void> {}
}
