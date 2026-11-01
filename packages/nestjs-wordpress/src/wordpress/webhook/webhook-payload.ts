import { BadRequestException } from '@nestjs/common';
import type { ContentChangeKind, WebhookPayload } from './content-changed.event.js';

const KINDS: ReadonlySet<string> = new Set<ContentChangeKind>([
  'post.saved',
  'post.deleted',
  'term.saved',
  'term.deleted',
  'menu.saved',
  'menu.deleted',
]);
const MAX_TAGS = 200;

/**
 * Validates the webhook body by hand. A DTO class + `ValidationPipe` would be the usual Nest
 * approach, but it would force `class-validator` on every consumer for one small payload.
 * Runs after the signature check, so the body is already known to come from WordPress.
 */
export function parseWebhookPayload(body: unknown): WebhookPayload {
  const b = body as Partial<Record<keyof WebhookPayload, unknown>> | null;
  const valid =
    typeof b === 'object' &&
    b !== null &&
    typeof b.event === 'string' &&
    KINDS.has(b.event) &&
    Array.isArray(b.tags) &&
    b.tags.length <= MAX_TAGS &&
    b.tags.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= 200) &&
    typeof b.id === 'number' &&
    Number.isInteger(b.id) &&
    typeof b.type === 'string' &&
    typeof b.slug === 'string';

  if (!valid) throw new BadRequestException('Invalid webhook payload');
  return b as WebhookPayload;
}
