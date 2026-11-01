import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { type ContentChangedEvent, signWebhook, WORDPRESS_CONTENT_UPDATED } from 'nestjs-wordpress';

/**
 * Forwards content changes to the Next.js frontend (apps/web), which calls `revalidateTag`
 * for the same tags. This closes the loop: WordPress → NestJS cache → Next.js cache.
 *
 * The request is signed exactly like the WordPress webhook (timestamped HMAC), reusing the
 * library's `signWebhook`, so the frontend can trust it with the same verification code.
 */
@Injectable()
export class NextRevalidationListener {
  private readonly logger = new Logger(NextRevalidationListener.name);
  private readonly url: string | undefined;
  private readonly secret: string | undefined;

  constructor(config: ConfigService) {
    this.url = config.get<string>('WEB_REVALIDATE_URL');
    this.secret = config.get<string>('WEB_REVALIDATE_SECRET');
  }

  @OnEvent(WORDPRESS_CONTENT_UPDATED)
  async handle(event: ContentChangedEvent): Promise<void> {
    if (!this.url || !this.secret) return;

    const body = JSON.stringify({ tags: event.tags });
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...signWebhook(this.secret, body) },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.logger.log(`Next.js revalidated ${event.tags.join(', ')}`);
    } catch (error) {
      // The frontend being down must not fail the webhook: its cache will expire on its own.
      this.logger.warn(`Could not revalidate Next.js at ${this.url}: ${String(error)}`);
    }
  }
}
