import type { Entry } from './types';

/**
 * Same vocabulary as `ContentTags` in nestjs-wordpress (and the WordPress plugin), so the
 * tags in a webhook can be passed straight to `revalidateTag`. Re-implemented here instead of
 * imported because importing a runtime value would pull NestJS into the Next.js bundle.
 */
export const tags = {
  entry: (type: string, id: number) => `${type}:${id}`,
  type: (type: string) => `type:${type}`,
  term: (id: number) => `term:${id}`,
  taxonomy: (taxonomy: string) => `taxonomy:${taxonomy}`,
  menus: 'menus',
};

export function entryTags(entry: Entry): string[] {
  return [
    tags.entry(entry.type, entry.id),
    ...Object.values(entry.terms)
      .flat()
      .map((term) => tags.term(term.id)),
  ];
}
