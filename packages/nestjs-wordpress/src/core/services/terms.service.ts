import { Inject, Injectable } from '@nestjs/common';
import type { ContentSource, TermListQuery } from '../content-source.interface.js';
import type { Paginated, Term } from '../dto/index.js';
import { CONTENT_SOURCE } from '../tokens.js';

/** Terms of any taxonomy: `category`, `post_tag` or custom ones (e.g. `genre`). */
@Injectable()
export class TermsService {
  constructor(@Inject(CONTENT_SOURCE) private readonly source: ContentSource) {}

  list(taxonomy: string, query: TermListQuery = {}): Promise<Paginated<Term>> {
    return this.source.listTerms(taxonomy, query);
  }

  getBySlug(taxonomy: string, slug: string): Promise<Term> {
    return this.source.getTerm(taxonomy, { slug });
  }

  getById(taxonomy: string, id: number): Promise<Term> {
    return this.source.getTerm(taxonomy, { id });
  }
}
