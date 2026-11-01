import type { ContentChange, ContentChangeEvent } from '../../invalidation/index.js';

/** Name of the event emitted (through `@nestjs/event-emitter`) after a webhook is processed. */
export const WORDPRESS_CONTENT_UPDATED = 'wordpress.content.updated';

/**
 * Payload of {@link WORDPRESS_CONTENT_UPDATED}: the content change plus the cache tags the
 * library invalidated for it. By the time listeners run, those entries are already gone;
 * listeners propagate the change further (e.g. Next.js `revalidateTag`, a CDN purge).
 *
 * ```ts
 * @OnEvent(WORDPRESS_CONTENT_UPDATED)
 * onContentUpdated(event: ContentChangedEvent) { ... }
 * ```
 */
export class ContentChangedEvent implements ContentChange {
  readonly event: ContentChangeEvent;
  readonly type: string;
  readonly id: number;
  readonly slug: string;
  readonly taxonomies: string[] | undefined;
  /** Cache tags invalidated for this change (from `tagsForChange`). */
  readonly tags: string[];
  readonly receivedAt = new Date().toISOString();

  // Named fields, not positional arguments: `type` and `slug` are both strings and easy to swap.
  constructor(change: ContentChange & { tags: string[] }) {
    this.event = change.event;
    this.type = change.type;
    this.id = change.id;
    this.slug = change.slug;
    this.taxonomies = change.taxonomies;
    this.tags = change.tags;
  }
}
