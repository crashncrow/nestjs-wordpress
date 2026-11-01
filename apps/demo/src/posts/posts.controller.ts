import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { type Paginated, type Post, PostsService } from 'nestjs-wordpress';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  /** GET /posts?page=2&perPage=5&search=demo&category=news,nestjs&tag=headless */
  @Get()
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('perPage', new ParseIntPipe({ optional: true })) perPage?: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ): Promise<Paginated<Post>> {
    return this.posts.list({
      page,
      perPage,
      search,
      categories: splitList(category),
      tags: splitList(tag),
    });
  }

  /** Unknown slugs throw ContentNotFoundException, which the global filter turns into a 404. */
  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<Post> {
    return this.posts.getBySlug(slug);
  }
}

/** `news,nestjs` → `['news', 'nestjs']`; numeric values are passed as IDs. */
function splitList(value: string | undefined): Array<string | number> | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}
