import { Inject, Injectable } from '@nestjs/common';
import type {
  ContentSource,
  EntryListQuery,
  ReadOptions,
  TermFilter,
} from '../content-source.interface.js';
import type { Paginated, Post } from '../dto/index.js';
import { CONTENT_SOURCE } from '../tokens.js';

export interface PostListQuery extends Omit<EntryListQuery, 'taxonomies' | 'parentId'> {
  /** Category IDs or slugs. */
  categories?: TermFilter[];
  /** Tag IDs or slugs. */
  tags?: TermFilter[];
}

/** Blog posts (`post` type), with category/tag filters as first-class options. */
@Injectable()
export class PostsService {
  // `@Inject(TOKEN)` is required because the dependency is an interface: interfaces do not
  // exist at runtime, so Nest cannot infer what to inject from the parameter type.
  constructor(@Inject(CONTENT_SOURCE) private readonly source: ContentSource) {}

  list(query: PostListQuery = {}): Promise<Paginated<Post>> {
    const { categories, tags, ...rest } = query;
    return this.source.listEntries('post', {
      ...rest,
      taxonomies: { category: categories, post_tag: tags },
    });
  }

  getBySlug(slug: string, options?: ReadOptions): Promise<Post> {
    return this.source.getEntry('post', { slug }, options);
  }

  getById(id: number, options?: ReadOptions): Promise<Post> {
    return this.source.getEntry('post', { id }, options);
  }
}
