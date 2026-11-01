import type { Author, Entry, Media, MediaSize, TermRef } from '../../core/dto/index.js';
import { cleanExcerpt, toPlainText } from './html.js';
import type { NormalizeContext } from './normalize-context.js';
import type { RawEntry, RawMedia, RawTerm, RawUser } from './raw-types.js';

export function normalizeEntry(raw: RawEntry, ctx: NormalizeContext): Entry {
  const embedded: Partial<NonNullable<RawEntry['_embedded']>> = raw._embedded ?? {};

  return {
    id: raw.id,
    type: raw.type,
    slug: raw.slug,
    status: raw.status,
    title: toPlainText(raw.title.rendered ?? ''),
    content: ctx.urls.rewriteHtml(raw.content.rendered ?? ''),
    excerpt: cleanExcerpt(raw.excerpt.rendered ?? ''),
    date: toUtcIso(raw.date_gmt ?? raw.date),
    modified: toUtcIso(raw.modified_gmt ?? raw.modified),
    path: ctx.urls.toPath(raw.link),
    parentId: raw.parent ? raw.parent : null,
    menuOrder: raw.menu_order ?? 0,
    featuredImage: normalizeFeaturedMedia(embedded['wp:featuredmedia']),
    author: normalizeAuthor(embedded.author),
    terms: normalizeTermRefs(embedded['wp:term'], ctx),
  };
}

/**
 * WordPress `*_gmt` fields are UTC but lack the `Z` designator (`2026-10-22T19:57:26`), so
 * `new Date()` would parse them as local time. Appending `Z` makes them unambiguous.
 */
export function toUtcIso(value: string | null | undefined): string {
  if (!value) return '';
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
}

function normalizeFeaturedMedia(embedded: unknown[] | undefined): Media | null {
  const raw = embedded?.[0] as (RawMedia & { code?: string }) | undefined;
  // A deleted or private image embeds as an error object (`{ code: 'rest_forbidden', ... }`).
  if (!raw || raw.code || !raw.source_url) return null;

  const details = raw.media_details as
    | {
        width?: number;
        height?: number;
        sizes?: Record<string, { source_url: string; width: number; height: number }>;
      }
    | undefined;

  const sizes: Record<string, MediaSize> = {};
  for (const [name, size] of Object.entries(details?.sizes ?? {})) {
    sizes[name] = { url: size.source_url, width: size.width, height: size.height };
  }

  return {
    id: raw.id,
    url: raw.source_url,
    alt: raw.alt_text ?? '',
    width: details?.width ?? null,
    height: details?.height ?? null,
    mimeType: raw.mime_type ?? null,
    sizes,
  };
}

function normalizeAuthor(embedded: unknown[] | undefined): Author | null {
  const raw = embedded?.[0] as (RawUser & { code?: string }) | undefined;
  if (!raw || raw.code) return null;
  const avatars = raw.avatar_urls as Record<string, string> | undefined;
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    // Prefer the largest rendition WordPress offers.
    avatarUrl: avatars?.['96'] ?? avatars?.['48'] ?? avatars?.['24'] ?? null,
  };
}

/** `wp:term` is an array per taxonomy (categories, tags, ...), each an array of terms. */
function normalizeTermRefs(
  embedded: unknown[] | undefined,
  ctx: NormalizeContext,
): Record<string, TermRef[]> {
  const terms: Record<string, TermRef[]> = {};
  for (const group of embedded ?? []) {
    if (!Array.isArray(group)) continue;
    for (const raw of group as RawTerm[]) {
      (terms[raw.taxonomy] ??= []).push({
        id: raw.id,
        taxonomy: raw.taxonomy,
        slug: raw.slug,
        name: toPlainText(raw.name),
        path: ctx.urls.toPath(raw.link),
      });
    }
  }
  return terms;
}
