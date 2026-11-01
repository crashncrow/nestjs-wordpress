import { Inject, Injectable } from '@nestjs/common';
import type { ContentSource } from '../content-source.interface.js';
import type { Menu } from '../dto/index.js';
import { CONTENT_SOURCE } from '../tokens.js';

/** Navigation menus, returned as a tree. */
@Injectable()
export class MenusService {
  constructor(@Inject(CONTENT_SOURCE) private readonly source: ContentSource) {}

  /** The menu assigned to a theme location, e.g. `primary`. */
  getByLocation(location: string): Promise<Menu> {
    return this.source.getMenu({ location });
  }

  getById(id: number): Promise<Menu> {
    return this.source.getMenu({ id });
  }
}
