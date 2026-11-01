import { Controller, Get, Param } from '@nestjs/common';
import { type Menu, MenusService } from 'nestjs-wordpress';

@Controller('menus')
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  /** GET /menus/primary */
  @Get(':location')
  byLocation(@Param('location') location: string): Promise<Menu> {
    return this.menus.getByLocation(location);
  }
}
