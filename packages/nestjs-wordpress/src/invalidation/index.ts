/**
 * The invalidation contract: the one module that owns the cache tag vocabulary.
 *
 * - `tagsForResult(read, result)`: what a cached result depends on, read from the result itself
 *   (its own identity plus everything it embeds).
 * - `tagsForChange(change)`: what a content change invalidates: only the changed object's
 *   identity, plus the type/taxonomy tags of lists it can appear in.
 *
 * Dependencies are always derived from results, never guessed from changes: a menu knows which
 * pages it links to, a post knows its author and image. That is why a change only needs to
 * name itself.
 *
 * Pure functions with type-only imports, published as `nestjs-wordpress/invalidation`, so
 * frontends (e.g. Next.js) share it without loading NestJS.
 */
import type {
  EntryListQuery,
  EntryLookup,
  MenuLookup,
  TermListQuery,
  TermLookup,
} from '../core/content-source.interface.js';
import type { Entry, Menu, MenuItem, Paginated, Term } from '../core/dto/index.js';

// ------------------------------------------------------------------ vocabulary

export const ContentTags = {
  /** Identity tag of any object: `post:12`, `page:4`, `attachment:7`, `book:3`. */
  entry: (type: string, id: number) => `${type}:${id}`,
  /** Every list of that type, and lookups by path. */
  type: (type: string) => `type:${type}`,
  term: (id: number) => `term:${id}`,
  /** Term lists of the taxonomy, and entry lists filtered by it. */
  taxonomy: (taxonomy: string) => `taxonomy:${taxonomy}`,
  menu: (id: number) => `menu:${id}`,
  /** Every menu (location assignments). */
  menus: 'menus',
  user: (id: number) => `user:${id}`,
} as const;

// ------------------------------------------------------------------ reads

/** The read that produced a cached result. Mirrors the `ContentSource` methods. */
export type ContentRead =
  | { kind: 'entries'; type: string; query?: EntryListQuery }
  | { kind: 'entry'; type: string; lookup: EntryLookup }
  | { kind: 'terms'; taxonomy: string; query?: TermListQuery }
  | { kind: 'term'; taxonomy: string; lookup: TermLookup }
  | { kind: 'menu'; lookup: MenuLookup };

type ResultOf<R extends ContentRead> = R extends { kind: 'entries' }
  ? Paginated<Entry>
  : R extends { kind: 'entry' }
    ? Entry
    : R extends { kind: 'terms' }
      ? Paginated<Term>
      : R extends { kind: 'term' }
        ? Term
        : Menu;

/** Cache tags for a result, given the read that produced it. Deduplicated. */
export function tagsForResult<R extends ContentRead>(read: R, result: ResultOf<R>): string[] {
  const tags: string[] = [];
  switch (read.kind) {
    case 'entries': {
      tags.push(ContentTags.type(read.type));
      // Only taxonomies actually filtered on: a term created or renamed can change which
      // entries match. Unfiltered lists must not depend on every term edit.
      for (const [taxonomy, values] of Object.entries(read.query?.taxonomies ?? {})) {
        if (values && values.length > 0) tags.push(ContentTags.taxonomy(taxonomy));
      }
      for (const entry of (result as Paginated<Entry>).items) tags.push(...entryTags(entry));
      break;
    }
    case 'entry':
      tags.push(...entryTags(result as Entry));
      // A path depends on every ancestor's slug; rather than tracking ancestors, tie path
      // lookups to the whole type. Coarser, never stale.
      if ('path' in read.lookup) tags.push(ContentTags.type(read.type));
      break;
    case 'terms':
      tags.push(ContentTags.taxonomy(read.taxonomy));
      for (const term of (result as Paginated<Term>).items) tags.push(ContentTags.term(term.id));
      break;
    case 'term':
      tags.push(ContentTags.term((result as Term).id));
      break;
    case 'menu': {
      const menu = result as Menu;
      tags.push(ContentTags.menu(menu.id), ContentTags.menus, ...menuItemTags(menu.items));
      break;
    }
  }
  return [...new Set(tags)];
}

/** An entry's own identity plus everything embedded in it. */
function entryTags(entry: Entry): string[] {
  const tags = [ContentTags.entry(entry.type, entry.id)];
  for (const terms of Object.values(entry.terms)) {
    for (const term of terms) tags.push(ContentTags.term(term.id));
  }
  if (entry.author) tags.push(ContentTags.user(entry.author.id));
  if (entry.featuredImage) tags.push(ContentTags.entry('attachment', entry.featuredImage.id));
  return tags;
}

/** Menu items show the title and URL of what they link to. */
function menuItemTags(items: MenuItem[]): string[] {
  return items.flatMap((item) => {
    const linked =
      item.kind === 'entry' && item.object && item.objectId
        ? [ContentTags.entry(item.object, item.objectId)]
        : item.kind === 'term' && item.objectId
          ? [ContentTags.term(item.objectId)]
          : [];
    return [...linked, ...menuItemTags(item.children)];
  });
}

// ------------------------------------------------------------------ changes

/** Every event a content change can carry. */
export const CONTENT_CHANGE_EVENTS = [
  'post.saved',
  'post.deleted',
  'term.saved',
  'term.deleted',
  'menu.saved',
  'menu.deleted',
  'user.saved',
  'user.deleted',
] as const;

export type ContentChangeEvent = (typeof CONTENT_CHANGE_EVENTS)[number];

/**
 * A fact about one object that changed in the content source (the webhook payload).
 * It does not say which cached results it affects: `tagsForChange` and the result tags do.
 */
export interface ContentChange {
  event: ContentChangeEvent;
  /** Post type (`post`, `page`, `attachment`, `book`), taxonomy, `nav_menu` or `user`. */
  type: string;
  id: number;
  slug: string;
  /** For posts: the taxonomies their type uses, whose term counts the change affects. */
  taxonomies?: string[];
}

/** Cache tags a content change invalidates. */
export function tagsForChange(change: ContentChange): string[] {
  const [kind] = change.event.split('.') as ['post' | 'term' | 'menu' | 'user'];
  switch (kind) {
    case 'post':
      return [
        ContentTags.entry(change.type, change.id),
        ContentTags.type(change.type),
        ...(change.taxonomies ?? []).map(ContentTags.taxonomy),
      ];
    case 'term':
      return [ContentTags.term(change.id), ContentTags.taxonomy(change.type)];
    case 'menu':
      return [ContentTags.menu(change.id), ContentTags.menus];
    case 'user':
      return [ContentTags.user(change.id)];
  }
}
