import { Inject, Injectable } from '@nestjs/common';
import type { ContentSource, EntryListQuery, ReadOptions } from '../content-source.interface.js';
import type { Page, Paginated } from '../dto/index.js';
import { CONTENT_SOURCE } from '../tokens.js';

export type PageListQuery = Omit<EntryListQuery, 'taxonomies'>;

/** Pages (`page` type). Pages are hierarchical, so they can be resolved by full path. */
@Injectable()
export class PagesService {
  constructor(@Inject(CONTENT_SOURCE) private readonly source: ContentSource) {}

  list(query: PageListQuery = {}): Promise<Paginated<Page>> {
    return this.source.listEntries('page', query);
  }

  /**
   * Resolves a hierarchical path such as `about/team`. Unlike {@link getBySlug}, it is
   * unambiguous when two pages share a slug under different parents.
   */
  getByPath(path: string, options?: ReadOptions): Promise<Page> {
    return this.source.getEntry('page', { path }, options);
  }

  getBySlug(slug: string, options?: ReadOptions): Promise<Page> {
    return this.source.getEntry('page', { slug }, options);
  }

  getById(id: number, options?: ReadOptions): Promise<Page> {
    return this.source.getEntry('page', { id }, options);
  }
}
