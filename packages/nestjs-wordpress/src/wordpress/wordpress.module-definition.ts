import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { WordPressModuleOptions } from './wordpress-options.interface.js';

/**
 * `ConfigurableModuleBuilder` generates `forRoot()` / `forRootAsync()` (with `useFactory`,
 * `useClass` and `useExisting`) and the `MODULE_OPTIONS_TOKEN` provider, so the module does
 * not hand-roll that boilerplate.
 *
 * "Extras" are options that must be known when the module is *defined* rather than when
 * providers are *instantiated*: `isGlobal` changes the module metadata itself, so it cannot
 * come from an async factory.
 */
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: WORDPRESS_MODULE_OPTIONS,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<WordPressModuleOptions>({ moduleName: 'WordPress' })
  .setClassMethodName('forRoot')
  .setExtras({ isGlobal: false }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .build();

/** Internal token for {@link ResolvedWordPressOptions}. */
export const WORDPRESS_RESOLVED_OPTIONS = Symbol('WORDPRESS_RESOLVED_OPTIONS');
