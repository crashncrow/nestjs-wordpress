/** A cache whose entries carry tags, so related entries can be invalidated together. */
export interface TaggedCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, tags: readonly string[]): Promise<void>;
  invalidateTags(tags: readonly string[]): Promise<void>;
}

/** The part of {@link TaggedCache} application code should need: dropping stale content. */
export type CacheInvalidator = Pick<TaggedCache, 'invalidateTags'>;
