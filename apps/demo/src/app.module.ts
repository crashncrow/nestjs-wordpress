import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ContentExceptionFilter, WordPressModule } from 'nestjs-wordpress';
import { HealthController } from './health.controller.js';
import { HomeController } from './home/home.controller.js';
import { HomeService } from './home/home.service.js';
import { MenusController } from './menus/menus.controller.js';
import { PagesController } from './pages/pages.controller.js';
import { PostsController } from './posts/posts.controller.js';

@Module({
  imports: [
    // The *app* reads .env through @nestjs/config; the library itself never touches process.env.
    ConfigModule.forRoot({ isGlobal: true }),
    // forRootAsync lets the options depend on other providers (here, ConfigService).
    WordPressModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow<string>('WP_URL'),
        auth: config.get('WP_APP_PASSWORD')
          ? {
              username: config.getOrThrow<string>('WP_USERNAME'),
              applicationPassword: config.getOrThrow<string>('WP_APP_PASSWORD'),
            }
          : undefined,
      }),
    }),
  ],
  controllers: [
    HealthController,
    PostsController,
    PagesController,
    MenusController,
    HomeController,
  ],
  providers: [
    // Registered through APP_FILTER (not app.useGlobalFilters in main.ts) so it is part of the
    // DI graph: it gets HttpAdapterHost injected and is active in e2e tests too.
    { provide: APP_FILTER, useClass: ContentExceptionFilter },
    HomeService,
  ],
})
export class AppModule {}
