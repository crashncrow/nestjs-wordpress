import { Injectable } from '@nestjs/common';
import {
  type MenuItem,
  MenusService,
  PagesService,
  type Post,
  PostsService,
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
    const [page, menu, latest, categories] = await Promise.all([
      this.pages.getByPath('home'),
      this.menus.getByLocation('primary'),
      this.posts.list({ perPage: 3 }),
      this.terms.list('category', { hideEmpty: true, orderBy: 'count', order: 'desc' }),
    ]);

    return {
      hero: { title: page.title, html: page.content },
      navigation: menu.items,
      latestPosts: latest.items.map(toCard),
      categories: categories.items.map(({ name, path, count }) => ({ name, path, count })),
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
