import { cacheLife, cacheTag } from 'next/cache';
// The library's invalidation contract, from a subpath with no NestJS code in it: the same
// tags the BFF cache uses, so webhook tags can be passed straight to revalidateTag.
import { ContentTags, tagsForResult } from 'nestjs-wordpress/invalidation';
import type { Entry, HomeView, Menu, Page, Paginated, Post, Term } from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/** `null` for 404 so pages can call `notFound()`; anything else non-2xx is an error. */
async function api<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${path} responded ${response.status}`);
  return (await response.json()) as T;
}

/*
 * Every reader below is a 'use cache' function: its result is cached by Next.js and tagged
 * with the same tags the NestJS cache uses. Freshness comes from webhooks (revalidateTag via
 * /api/revalidate), so the time-based lifetime can be long.
 *
 * Tags can be added after the fetch, which matters for lookups by slug/path: the entry ID
 * (and its terms) is only known once the response arrives.
 */

export async function getHome(): Promise<HomeView | null> {
  'use cache';
  cacheLife('days');
  const home = await api<HomeView>('/home');
  // The BFF reports what the aggregate depends on; nothing to keep in sync here.
  cacheTag(...(home ? home.cacheTags : [ContentTags.type('page')]));
  return home;
}

export async function getPrimaryMenu(): Promise<Menu | null> {
  'use cache';
  cacheLife('days');
  const menu = await api<Menu>('/menus/primary');
  cacheTag(
    ...(menu
      ? tagsForResult({ kind: 'menu', lookup: { location: 'primary' } }, menu)
      : [ContentTags.menus]),
  );
  return menu;
}

export async function getPosts(page: number, category?: string): Promise<Paginated<Post> | null> {
  'use cache';
  cacheLife('days');
  const query = new URLSearchParams({ page: String(page), perPage: '6' });
  if (category) query.set('category', category);

  const result = await api<Paginated<Post>>(`/posts?${query}`);
  const read = {
    kind: 'entries',
    type: 'post',
    query: { taxonomies: { category: category ? [category] : undefined } },
  } as const;
  cacheTag(...(result ? tagsForResult(read, result) : [ContentTags.type('post')]));
  return result;
}

export async function getPost(slug: string): Promise<Post | null> {
  'use cache';
  cacheLife('days');
  const post = await api<Post>(`/posts/${encodeURIComponent(slug)}`);
  // A missing post is cached too; publishing one invalidates `type:post`, which clears it.
  cacheTag(
    ...(post
      ? tagsForResult({ kind: 'entry', type: 'post', lookup: { slug } }, post)
      : [ContentTags.type('post')]),
  );
  return post;
}

export async function getPage(path: string): Promise<Page | null> {
  'use cache';
  cacheLife('days');
  const page = await api<Page>(`/pages/${path.split('/').map(encodeURIComponent).join('/')}`);
  // Path lookups are also tied to the whole type (a parent rename changes the path).
  cacheTag(
    ...(page
      ? tagsForResult({ kind: 'entry', type: 'page', lookup: { path } }, page)
      : [ContentTags.type('page')]),
  );
  return page;
}

export async function getCategory(slug: string): Promise<Term | null> {
  'use cache';
  cacheLife('days');
  const term = await api<Term>(`/categories/${encodeURIComponent(slug)}`);
  cacheTag(
    ...(term
      ? tagsForResult({ kind: 'term', taxonomy: 'category', lookup: { slug } }, term)
      : [ContentTags.taxonomy('category')]),
  );
  return term;
}

/** WordPress permalinks share one namespace: a single-segment path may be a page or a post. */
export async function resolvePath(path: string): Promise<Entry | null> {
  const page = await getPage(path);
  if (page || path.includes('/')) return page;
  return getPost(path);
}
