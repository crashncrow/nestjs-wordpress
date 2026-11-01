import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  type Type,
  UseGuards,
} from '@nestjs/common';
import type { CacheInvalidator } from '../../core/cache/tagged-cache.interface.js';
import { CACHE_INVALIDATOR } from '../../core/tokens.js';
import type { ResolvedWordPressOptions } from '../wordpress-options.interface.js';
import { WORDPRESS_RESOLVED_OPTIONS } from '../wordpress.tokens.js';
import { ContentChangedEvent } from './content-changed.event.js';
import { ContentEventPublisher } from './content-event-publisher.js';
import { HmacSignatureGuard } from './hmac-signature.guard.js';
import { parseWebhookPayload } from './webhook-payload.js';

export const DEFAULT_WEBHOOK_PATH = 'webhooks/wordpress';

/**
 * Builds the webhook controller for a given route.
 *
 * `@Controller(path)` is evaluated when the class is defined, so a configurable path needs the
 * class to be created on demand: this factory runs once, from the module definition, with the
 * static `webhookController.path` extra.
 */
export function createWebhookController(path: string): Type<unknown> {
  @Controller(path)
  class WordPressWebhookController {
    constructor(
      @Inject(CACHE_INVALIDATOR) private readonly invalidator: CacheInvalidator,
      private readonly events: ContentEventPublisher,
      @Inject(WORDPRESS_RESOLVED_OPTIONS) options: ResolvedWordPressOptions,
    ) {
      // Controllers are instantiated at bootstrap: fail fast instead of on the first webhook.
      if (!options.webhook) {
        throw new Error(
          'WordPressModule: "webhookController" is enabled but "webhook.secret" is not set',
        );
      }
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    @UseGuards(HmacSignatureGuard)
    async receive(@Body() body: unknown): Promise<{ invalidated: string[] }> {
      const payload = parseWebhookPayload(body);
      await this.invalidator.invalidateTags(payload.tags);
      await this.events.publish(
        new ContentChangedEvent(
          payload.event,
          payload.tags,
          payload.id,
          payload.type,
          payload.slug,
        ),
      );
      return { invalidated: payload.tags };
    }
  }
  return WordPressWebhookController;
}
