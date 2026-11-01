import { Controller, Get, Param } from '@nestjs/common';
import { type Page, PagesService } from 'nestjs-wordpress';

@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  /**
   * GET /pages/about/team/leadership
   *
   * `*path` is a named wildcard (Express 5 / path-to-regexp v8 syntax); it arrives as an
   * array of segments, so it is joined back into a path.
   */
  @Get('*path')
  byPath(@Param('path') segments: string[]): Promise<Page> {
    return this.pages.getByPath(segments.join('/'));
  }
}
