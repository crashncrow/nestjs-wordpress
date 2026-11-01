import { Module } from '@nestjs/common';
import { CONTENT_SOURCE } from '../core/tokens.js';
import { EntriesService } from '../core/services/entries.service.js';
import { MenusService } from '../core/services/menus.service.js';
import { PagesService } from '../core/services/pages.service.js';
import { PostsService } from '../core/services/posts.service.js';
import { TermsService } from '../core/services/terms.service.js';
import { WordPressHttpClient } from './http/wordpress-http-client.js';
import { resolveWordPressOptions } from './resolve-options.js';
import { WordPressContentSource } from './wordpress-content-source.js';
import type { WordPressModuleOptions } from './wordpress-options.interface.js';
import {
  ConfigurableModuleClass,
  WORDPRESS_MODULE_OPTIONS,
  WORDPRESS_RESOLVED_OPTIONS,
} from './wordpress.module-definition.js';

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
    // `useExisting` aliases the token to the same singleton instead of creating a second one.
    { provide: CONTENT_SOURCE, useExisting: WordPressContentSource },
    ...services,
  ],
  exports: [CONTENT_SOURCE, WordPressHttpClient, ...services],
})
export class WordPressModule extends ConfigurableModuleClass {}
