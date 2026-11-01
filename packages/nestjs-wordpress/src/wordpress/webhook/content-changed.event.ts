/** Name of the event emitted (through `@nestjs/event-emitter`) after a webhook is processed. */
export const WORDPRESS_CONTENT_UPDATED = 'wordpress.content.updated';

export type ContentChangeKind =
  'post.saved' | 'post.deleted' | 'term.saved' | 'term.deleted' | 'menu.saved' | 'menu.deleted';

/** Body sent by the `nestjs-wordpress-webhooks` plugin. */
export interface WebhookPayload {
  event: ContentChangeKind;
  /** Cache tags affected by the change (see `ContentTags`). */
  tags: string[];
  id: number;
  /** Post type, taxonomy, or `nav_menu`. */
  type: string;
  slug: string;
}

/**
 * Payload of {@link WORDPRESS_CONTENT_UPDATED}. By the time listeners run, the library's own
 * cache entries for `tags` are already invalidated; listeners propagate the change further
 * (e.g. call Next.js `revalidateTag`, purge a CDN, notify clients).
 *
 * ```ts
 * @OnEvent(WORDPRESS_CONTENT_UPDATED)
 * onContentUpdated(event: ContentChangedEvent) { ... }
 * ```
 */
export class ContentChangedEvent implements WebhookPayload {
  readonly receivedAt = new Date().toISOString();

  constructor(
    readonly event: ContentChangeKind,
    readonly tags: string[],
    readonly id: number,
    readonly type: string,
    readonly slug: string,
  ) {}
}
