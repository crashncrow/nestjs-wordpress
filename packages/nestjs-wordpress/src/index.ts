/**
 * Public entry point of `nestjs-wordpress`.
 *
 * Everything consumers can import is re-exported from here; any file not reachable from
 * this module is an implementation detail and may change without notice.
 */

// Core: source-agnostic contract, DTOs, services and errors.
export type * from './core/dto/index.js';
export type {
  ContentSource,
  EntryListQuery,
  EntryLookup,
  MenuLookup,
  ReadOptions,
  SortOrder,
  TermFilter,
  TermListQuery,
  TermLookup,
} from './core/content-source.interface.js';
export { CACHE_INVALIDATOR, CONTENT_SOURCE, TAGGED_CACHE } from './core/tokens.js';
export type { CacheInvalidator, TaggedCache } from './core/cache/tagged-cache.interface.js';
export { ContentTags } from './core/cache/content-tags.js';
export { PostsService, type PostListQuery } from './core/services/posts.service.js';
export { PagesService, type PageListQuery } from './core/services/pages.service.js';
export { EntriesService } from './core/services/entries.service.js';
export { TermsService } from './core/services/terms.service.js';
export { MenusService } from './core/services/menus.service.js';
export * from './core/errors/content-source.exception.js';
export { ContentExceptionFilter } from './core/errors/content-exception.filter.js';

// WordPress adapter.
export { WordPressModule } from './wordpress/wordpress.module.js';
export type {
  WordPressAuthOptions,
  WordPressCacheOptions,
  WordPressModuleOptions,
  WordPressWebhookOptions,
} from './wordpress/wordpress-options.interface.js';
export type { WordPressModuleExtras } from './wordpress/wordpress.module-definition.js';
export {
  ContentChangedEvent,
  WORDPRESS_CONTENT_UPDATED,
  type ContentChangeKind,
  type WebhookPayload,
} from './wordpress/webhook/content-changed.event.js';
export {
  HmacSignatureGuard,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signWebhook,
} from './wordpress/webhook/hmac-signature.guard.js';
export {
  WordPressHttpClient,
  type QueryValue,
  type WordPressRequest,
  type WordPressResponse,
} from './wordpress/http/wordpress-http-client.js';
