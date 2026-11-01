import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type ContentChangedEvent, WORDPRESS_CONTENT_UPDATED } from 'nestjs-wordpress';

/**
 * Reacts to content changes after the library has invalidated its own cache.
 * This is where an app would purge a CDN or tell a frontend to revalidate (phase 3.5).
 */
@Injectable()
export class ContentChangesListener {
  private readonly logger = new Logger(ContentChangesListener.name);

  @OnEvent(WORDPRESS_CONTENT_UPDATED)
  handle(event: ContentChangedEvent): void {
    this.logger.log(
      `${event.event} ${event.type}#${event.id} (${event.slug}) → ${event.tags.join(', ')}`,
    );
  }
}
