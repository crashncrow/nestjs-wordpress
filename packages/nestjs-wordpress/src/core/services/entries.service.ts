import { Inject, Injectable } from '@nestjs/common';
import type { ContentSource, EntryListQuery, ReadOptions } from '../content-source.interface.js';
import type { Entry, Paginated } from '../dto/index.js';
import { CONTENT_SOURCE } from '../tokens.js';

/** Any content type by name, including custom post types (e.g. `book`). */
@Injectable()
export class EntriesService {
  constructor(@Inject(CONTENT_SOURCE) private readonly source: ContentSource) {}

  list(type: string, query: EntryListQuery = {}, options?: ReadOptions): Promise<Paginated<Entry>> {
    return this.source.listEntries(type, query, options);
  }

  getBySlug(type: string, slug: string, options?: ReadOptions): Promise<Entry> {
    return this.source.getEntry(type, { slug }, options);
  }

  getById(type: string, id: number, options?: ReadOptions): Promise<Entry> {
    return this.source.getEntry(type, { id }, options);
  }

  /** For hierarchical types; see `PagesService.getByPath`. */
  getByPath(type: string, path: string, options?: ReadOptions): Promise<Entry> {
    return this.source.getEntry(type, { path }, options);
  }
}
