import { Controller, Get } from '@nestjs/common';
import { type HomeView, HomeService } from './home.service.js';

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  get(): Promise<HomeView> {
    return this.home.getHome();
  }
}
