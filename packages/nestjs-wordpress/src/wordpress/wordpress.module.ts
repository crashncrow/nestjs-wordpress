import { Module } from '@nestjs/common';
import { CacheableTaggedCache } from '../core/cache/cacheable-tagged-cache.js';
import { CachedContentSource } from '../core/cache/cached-content-source.js';
import { NoopTaggedCache } from '../core/cache/noop-tagged-cache.js';
import type { TaggedCache } from '../core/cache/tagged-cache.interface.js';
import { CACHE_INVALIDATOR, CONTENT_SOURCE, TAGGED_CACHE } from '../core/tokens.js';
import { EntriesService } from '../core/services/entries.service.js';
import { MenusService } from '../core/services/menus.service.js';
import { PagesService } from '../core/services/pages.service.js';
import { PostsService } from '../core/services/posts.service.js';
import { TermsService } from '../core/services/terms.service.js';
import { WordPressHttpClient } from './http/wordpress-http-client.js';
import { resolveWordPressOptions } from './resolve-options.js';
import { ContentEventPublisher } from './webhook/content-event-publisher.js';
import { HmacSignatureGuard } from './webhook/hmac-signature.guard.js';
import { WordPressContentSource } from './wordpress-content-source.js';
import type {
  ResolvedWordPressOptions,
  WordPressModuleOptions,
} from './wordpress-options.interface.js';
import {
  ConfigurableModuleClass,
  WORDPRESS_MODULE_OPTIONS,
} from './wordpress.module-definition.js';
import { WORDPRESS_RESOLVED_OPTIONS } from './wordpress.tokens.js';

const services = [PostsService, PagesService, EntriesService, TermsService, MenusService];

/**
 * Registers WordPress as the application's content source.
 *
 * ```ts
 * WordPressModule.forRoot({ baseUrl: 'https://cms.example.com' })
 * WordPressModule.forRootAsync({ inject: [ConfigService], useFactory: (c) => ({ ... }) })
 * ```
 *
 * `forRoot` / `forRootAsync` come from `ConfigurableModuleClass`; this class only declares
 * the providers that every configuration shares.
 */
@Module({
  providers: [
    {
      // Raw options (sync or from an async factory) are validated once into a resolved object.
      provide: WORDPRESS_RESOLVED_OPTIONS,
      inject: [WORDPRESS_MODULE_OPTIONS],
      useFactory: (options: WordPressModuleOptions) => resolveWordPressOptions(options),
    },
    WordPressHttpClient,
    WordPressContentSource,
    {
      // An async factory: Nest awaits it before anything that injects TAGGED_CACHE is created.
      provide: TAGGED_CACHE,
      inject: [WORDPRESS_RESOLVED_OPTIONS],
      useFactory: (options: ResolvedWordPressOptions): Promise<TaggedCache> | TaggedCache =>
        options.cache ? CacheableTaggedCache.create(options.cache) : new NoopTaggedCache(),
    },
    // `useExisting` aliases a token to the same singleton instead of creating a second one.
    { provide: CACHE_INVALIDATOR, useExisting: TAGGED_CACHE },
    {
      // Whether caching is on is only known once (possibly async) options are resolved, so the
      // decision is a factory rather than two static module shapes.
      provide: CONTENT_SOURCE,
      inject: [WordPressContentSource, TAGGED_CACHE, WORDPRESS_RESOLVED_OPTIONS],
      useFactory: (
        source: WordPressContentSource,
        cache: TaggedCache,
        options: ResolvedWordPressOptions,
      ) => (options.cache ? new CachedContentSource(source, cache) : source),
    },
    ContentEventPublisher,
    HmacSignatureGuard,
    ...services,
  ],
  exports: [CONTENT_SOURCE, CACHE_INVALIDATOR, TAGGED_CACHE, WordPressHttpClient, ...services],
})
export class WordPressModule extends ConfigurableModuleClass {}
