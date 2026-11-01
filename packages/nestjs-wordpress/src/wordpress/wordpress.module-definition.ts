import { ConfigurableModuleBuilder } from '@nestjs/common';
import { createWebhookController, DEFAULT_WEBHOOK_PATH } from './webhook/webhook.controller.js';
import type { WordPressModuleOptions } from './wordpress-options.interface.js';

export interface WordPressModuleExtras {
  /** Register the module globally, so feature modules do not need to import it. */
  isGlobal?: boolean;
  /**
   * Mount the signed webhook endpoint (`POST /webhooks/wordpress` by default).
   * Requires the `webhook.secret` option and an app created with `{ rawBody: true }`.
   */
  webhookController?: boolean | { path?: string };
}

/**
 * `ConfigurableModuleBuilder` generates `forRoot()` / `forRootAsync()` (with `useFactory`,
 * `useClass` and `useExisting`) and the `MODULE_OPTIONS_TOKEN` provider, so the module does
 * not hand-roll that boilerplate.
 *
 * "Extras" are options that must be known when the module is *defined* rather than when
 * providers are *instantiated*: `isGlobal` and the webhook controller change the module
 * metadata itself (its `global` flag and `controllers` list), so they cannot come from an
 * async factory. That is why they sit next to `useFactory`, not inside its result.
 */
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: WORDPRESS_MODULE_OPTIONS,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<WordPressModuleOptions>({ moduleName: 'WordPress' })
  .setClassMethodName('forRoot')
  .setExtras<WordPressModuleExtras>(
    { isGlobal: false, webhookController: false },
    (definition, extras) => {
      const webhook = extras.webhookController;
      const path =
        typeof webhook === 'object' ? (webhook.path ?? DEFAULT_WEBHOOK_PATH) : DEFAULT_WEBHOOK_PATH;
      return {
        ...definition,
        global: extras.isGlobal,
        controllers: webhook ? [createWebhookController(path)] : [],
      };
    },
  )
  .build();
