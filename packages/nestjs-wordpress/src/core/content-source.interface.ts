import type { Entry, Menu, Paginated, Term } from './dto/index.js';

export type SortOrder = 'asc' | 'desc';

/** A term filter value: numeric ID or slug (slugs are resolved by the adapter). */
export type TermFilter = number | string;

export interface EntryListQuery {
  /** 1-based. Defaults to 1. */
  page?: number;
  /** Defaults to 10. WordPress caps it at 100. */
  perPage?: number;
  search?: string;
  /** Only entries having at least one of these terms, keyed by taxonomy name. */
  taxonomies?: Record<string, TermFilter[] | undefined>;
  /** Only children of this entry (hierarchical types). Use `0` for top level. */
  parentId?: number;
  orderBy?: 'date' | 'modified' | 'title' | 'slug' | 'id' | 'menu_order';
  order?: SortOrder;
}

export type EntryLookup = { id: number } | { slug: string } | { path: string };

export interface ReadOptions {
  /**
   * Read unpublished content (drafts, pending, scheduled, private).
   * Requires credentials; such reads must never be cached or exposed publicly.
   */
  preview?: boolean;
}

export interface TermListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  /** Only children of this term. Use `0` for top level. */
  parentId?: number;
  /** Hide terms without published entries. Defaults to `false`. */
  hideEmpty?: boolean;
  orderBy?: 'name' | 'slug' | 'count' | 'id';
  order?: SortOrder;
}

export type TermLookup = { id: number } | { slug: string };

export type MenuLookup = { id: number } | { location: string };

/**
 * The contract every content adapter implements. Bound to the {@link CONTENT_SOURCE} token.
 *
 * Methods that look up a single item throw `ContentNotFoundException` instead of returning
 * `null`, so callers (and the optional exception filter) get consistent 404 semantics.
 */
export interface ContentSource {
  listEntries(
    type: string,
    query?: EntryListQuery,
    options?: ReadOptions,
  ): Promise<Paginated<Entry>>;
  getEntry(type: string, lookup: EntryLookup, options?: ReadOptions): Promise<Entry>;
  listTerms(taxonomy: string, query?: TermListQuery): Promise<Paginated<Term>>;
  getTerm(taxonomy: string, lookup: TermLookup): Promise<Term>;
  getMenu(lookup: MenuLookup): Promise<Menu>;
}
