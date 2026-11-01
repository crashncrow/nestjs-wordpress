import { cacheLife, cacheTag } from 'next/cache';
import { entryTags, tags } from './tags';
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
  // The aggregate depends on the home page, the primary menu, recent posts and categories.
  cacheTag(tags.type('page'), tags.type('post'), tags.taxonomy('category'), tags.menus);
  return api<HomeView>('/home');
}

export async function getPrimaryMenu(): Promise<Menu | null> {
  'use cache';
  cacheLife('days');
  cacheTag(tags.menus);
  return api<Menu>('/menus/primary');
}

export async function getPosts(page: number, category?: string): Promise<Paginated<Post> | null> {
  'use cache';
  cacheLife('days');
  const query = new URLSearchParams({ page: String(page), perPage: '6' });
  if (category) query.set('category', category);

  const result = await api<Paginated<Post>>(`/posts?${query}`);
  cacheTag(tags.type('post'), ...(category ? [tags.taxonomy('category')] : []));
  if (result) cacheTag(...result.items.flatMap(entryTags));
  return result;
}

export async function getPost(slug: string): Promise<Post | null> {
  'use cache';
  cacheLife('days');
  const post = await api<Post>(`/posts/${encodeURIComponent(slug)}`);
  // A missing post is cached too; publishing one sends `type:post`, which clears it.
  cacheTag(...(post ? entryTags(post) : [tags.type('post')]));
  return post;
}

export async function getPage(path: string): Promise<Page | null> {
  'use cache';
  cacheLife('days');
  const page = await api<Page>(`/pages/${path.split('/').map(encodeURIComponent).join('/')}`);
  // A page path depends on its ancestors' slugs, so it is also tied to the whole type.
  cacheTag(tags.type('page'), ...(page ? entryTags(page) : []));
  return page;
}

export async function getCategory(slug: string): Promise<Term | null> {
  'use cache';
  cacheLife('days');
  const term = await api<Term>(`/categories/${encodeURIComponent(slug)}`);
  cacheTag(tags.taxonomy('category'), ...(term ? [tags.term(term.id)] : []));
  return term;
}

/** WordPress permalinks share one namespace: a single-segment path may be a page or a post. */
export async function resolvePath(path: string): Promise<Entry | null> {
  const page = await getPage(path);
  if (page || path.includes('/')) return page;
  return getPost(path);
}
