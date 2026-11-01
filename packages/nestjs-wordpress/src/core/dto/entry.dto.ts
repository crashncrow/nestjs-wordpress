/**
 * Normalized DTOs: the public shape of content, independent of the source's raw JSON.
 *
 * Every field is JSON-serializable on purpose (dates are ISO strings, no class instances),
 * so a DTO survives a round-trip through a shared cache such as Redis unchanged.
 */

/** A reference to a term attached to an entry (lighter than a full {@link Term}). */
export interface TermRef {
  id: number;
  taxonomy: string;
  slug: string;
  name: string;
  /** Site-relative path of the term archive, e.g. `/category/news/`. */
  path: string;
}

export interface MediaSize {
  url: string;
  width: number;
  height: number;
}

export interface Media {
  id: number;
  /** Absolute URL: media files are served by the CMS host, so they are never made relative. */
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  /** Generated renditions keyed by size name (`thumbnail`, `medium`, `large`, ...). */
  sizes: Record<string, MediaSize>;
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

/** Any piece of content: post, page or custom post type entry. */
export interface Entry {
  id: number;
  /** Content type name, e.g. `post`, `page`, `book`. */
  type: string;
  slug: string;
  status: string;
  /** Plain text (HTML entities decoded). */
  title: string;
  /** Rendered HTML. Links to the CMS domain are rewritten to site-relative paths. */
  content: string;
  /** Plain text, without HTML or "read more" markers. */
  excerpt: string;
  /** ISO 8601 (UTC). */
  date: string;
  /** ISO 8601 (UTC). */
  modified: string;
  /** Site-relative path, e.g. `/about/team/`. */
  path: string;
  /** Parent entry for hierarchical types, `null` otherwise. */
  parentId: number | null;
  menuOrder: number;
  featuredImage: Media | null;
  author: Author | null;
  /** Attached terms grouped by taxonomy name (`category`, `post_tag`, ...). */
  terms: Record<string, TermRef[]>;
}

export type Post = Entry;
export type Page = Entry;
