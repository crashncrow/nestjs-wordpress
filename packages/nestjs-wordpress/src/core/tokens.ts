/**
 * Injection tokens of the source-agnostic core.
 *
 * Symbols (instead of classes) are used for contracts that have no single implementation:
 * `CONTENT_SOURCE` is bound by an adapter module (WordPress today, others later), so code
 * that depends on it never imports the adapter.
 */
export const CONTENT_SOURCE = Symbol('CONTENT_SOURCE');

/** The full tag-aware cache ({@link TaggedCache}); used by the caching layer. */
export const TAGGED_CACHE = Symbol('TAGGED_CACHE');

/**
 * Narrow view of the cache that only allows invalidation ({@link CacheInvalidator}).
 * Inject this one in application code that reacts to content changes.
 */
export const CACHE_INVALIDATOR = Symbol('CACHE_INVALIDATOR');
