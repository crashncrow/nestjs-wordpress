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
export { CONTENT_SOURCE } from './core/tokens.js';
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
  WordPressModuleOptions,
} from './wordpress/wordpress-options.interface.js';
export {
  WordPressHttpClient,
  type QueryValue,
  type WordPressRequest,
  type WordPressResponse,
} from './wordpress/http/wordpress-http-client.js';
