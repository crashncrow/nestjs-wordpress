// DTO types come straight from the library: the BFF and the frontend share one contract.
// `import type` is erased at build time, so no NestJS code reaches the Next.js bundle.
export type { Entry, Menu, MenuItem, Page, Paginated, Post, Term } from 'nestjs-wordpress';
import type { MenuItem } from 'nestjs-wordpress';

/** Shape of the demo's `GET /home` aggregate (apps/demo/src/home/home.service.ts). */
export interface HomeView {
  hero: { title: string; html: string };
  navigation: MenuItem[];
  latestPosts: Array<{
    title: string;
    path: string;
    excerpt: string;
    date: string;
    imageUrl: string | null;
  }>;
  categories: Array<{ name: string; path: string; count: number }>;
  /** Tags the aggregate depends on, computed by the BFF with the invalidation contract. */
  cacheTags: string[];
}
