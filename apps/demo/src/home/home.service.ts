import { Injectable } from '@nestjs/common';
import {
  type MenuItem,
  MenusService,
  PagesService,
  type Post,
  PostsService,
  tagsForResult,
  TermsService,
} from 'nestjs-wordpress';

/** A card-sized post: the home page does not need full content. */
export interface PostCard {
  title: string;
  path: string;
  excerpt: string;
  date: string;
  imageUrl: string | null;
}

export interface HomeView {
  hero: { title: string; html: string };
  navigation: MenuItem[];
  latestPosts: PostCard[];
  categories: Array<{ name: string; path: string; count: number }>;
  /**
   * Cache tags this response depends on, from the library's invalidation contract. Lets a
   * frontend cache the aggregate and invalidate it with the tags the webhook reports.
   */
  cacheTags: string[];
}

/**
 * The BFF part: several content reads combined and reshaped into exactly what one screen
 * needs, so a web or mobile client makes one request instead of four.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly posts: PostsService,
    private readonly pages: PagesService,
    private readonly menus: MenusService,
    private readonly terms: TermsService,
  ) {}

  async getHome(): Promise<HomeView> {
    // Independent reads run in parallel.
    const termQuery = { hideEmpty: true, orderBy: 'count', order: 'desc' } as const;
    const [page, menu, latest, categories] = await Promise.all([
      this.pages.getByPath('home'),
      this.menus.getByLocation('primary'),
      this.posts.list({ perPage: 3 }),
      this.terms.list('category', termQuery),
    ]);

    // Each part described as the read that produced it, so the tags match the library's cache.
    const cacheTags = [
      ...tagsForResult({ kind: 'entry', type: 'page', lookup: { path: 'home' } }, page),
      ...tagsForResult({ kind: 'menu', lookup: { location: 'primary' } }, menu),
      ...tagsForResult({ kind: 'entries', type: 'post', query: { perPage: 3 } }, latest),
      ...tagsForResult({ kind: 'terms', taxonomy: 'category', query: termQuery }, categories),
    ];

    return {
      hero: { title: page.title, html: page.content },
      navigation: menu.items,
      latestPosts: latest.items.map(toCard),
      categories: categories.items.map(({ name, path, count }) => ({ name, path, count })),
      cacheTags: [...new Set(cacheTags)],
    };
  }
}

function toCard(post: Post): PostCard {
  return {
    title: post.title,
    path: post.path,
    excerpt: post.excerpt,
    date: post.date,
    imageUrl: post.featuredImage?.sizes.medium?.url ?? post.featuredImage?.url ?? null,
  };
}
