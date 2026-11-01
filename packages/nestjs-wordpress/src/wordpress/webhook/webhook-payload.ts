import { BadRequestException } from '@nestjs/common';
import { CONTENT_CHANGE_EVENTS, type ContentChange } from '../../invalidation/index.js';

const EVENTS: ReadonlySet<string> = new Set(CONTENT_CHANGE_EVENTS);
const MAX_TAXONOMIES = 50;

/**
 * Validates the webhook body as a {@link ContentChange}. A DTO class + `ValidationPipe` would
 * be the usual Nest approach, but it would force `class-validator` on every consumer for one
 * small payload. Runs after the signature check, so the body is known to come from WordPress.
 */
export function parseContentChange(body: unknown): ContentChange {
  const b = body as Partial<Record<keyof ContentChange, unknown>> | null;
  const valid =
    typeof b === 'object' &&
    b !== null &&
    typeof b.event === 'string' &&
    EVENTS.has(b.event) &&
    typeof b.id === 'number' &&
    Number.isInteger(b.id) &&
    typeof b.type === 'string' &&
    b.type.length > 0 &&
    typeof b.slug === 'string' &&
    (b.taxonomies === undefined ||
      (Array.isArray(b.taxonomies) &&
        b.taxonomies.length <= MAX_TAXONOMIES &&
        b.taxonomies.every((t) => typeof t === 'string' && t.length > 0)));

  if (!valid) throw new BadRequestException('Invalid webhook payload');
  const { event, type, id, slug, taxonomies } = b as ContentChange;
  // Copy known fields only: anything else in the body is ignored.
  return { event, type, id, slug, ...(taxonomies ? { taxonomies } : {}) };
}
