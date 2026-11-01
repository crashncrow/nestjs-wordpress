import type { Entry, Menu, Term } from '../dto/index.js';

/**
 * The tag vocabulary shared by the cache and the webhook sender (the WordPress plugin builds
 * the same strings in PHP). Keep both sides in sync when changing it.
 *
 * | Tag                | Attached to                                        |
 * | ------------------ | -------------------------------------------------- |
 * | `<type>:<id>`      | an entry (`post:12`, `page:4`, `book:7`)           |
 * | `type:<type>`      | every list of that type, and path lookups          |
 * | `term:<id>`        | a term, and every entry/list that embeds it        |
 * | `taxonomy:<name>`  | term lists of that taxonomy, lists filtered by it  |
 * | `menu:<id>`        | a menu                                             |
 * | `menus`            | every menu (location assignments, linked titles)   |
 */
export const ContentTags = {
  entry: (type: string, id: number) => `${type}:${id}`,
  type: (type: string) => `type:${type}`,
  term: (id: number) => `term:${id}`,
  taxonomy: (taxonomy: string) => `taxonomy:${taxonomy}`,
  menu: (id: number) => `menu:${id}`,
  menus: 'menus',
} as const;

export function entryTags(entry: Entry): string[] {
  const tags = [ContentTags.entry(entry.type, entry.id)];
  for (const terms of Object.values(entry.terms)) {
    for (const term of terms) tags.push(ContentTags.term(term.id));
  }
  return tags;
}

export function termTags(term: Term): string[] {
  return [ContentTags.term(term.id)];
}

export function menuTags(menu: Menu): string[] {
  return [ContentTags.menu(menu.id), ContentTags.menus];
}
