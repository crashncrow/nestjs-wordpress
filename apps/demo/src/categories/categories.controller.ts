import { Controller, Get, Param } from '@nestjs/common';
import { type Term, TermsService } from 'nestjs-wordpress';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly terms: TermsService) {}

  /** GET /categories/news */
  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<Term> {
    return this.terms.getBySlug('category', slug);
  }
}
