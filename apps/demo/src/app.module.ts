import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ContentExceptionFilter, WordPressModule } from 'nestjs-wordpress';
import { CategoriesController } from './categories/categories.controller.js';
import { ContentChangesListener } from './content-events/content-changes.listener.js';
import { NextRevalidationListener } from './content-events/next-revalidation.listener.js';
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
    // Enables the `wordpress.content.updated` event; the library detects it at runtime.
    EventEmitterModule.forRoot(),
    // forRootAsync lets the options depend on other providers (here, ConfigService).
    WordPressModule.forRootAsync({
      // Static "extra": decides at module definition time whether the controller is mounted.
      webhookController: { path: 'webhooks/wordpress' },
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow<string>('WP_URL'),
        auth: config.get('WP_APP_PASSWORD')
          ? {
              username: config.getOrThrow<string>('WP_USERNAME'),
              applicationPassword: config.getOrThrow<string>('WP_APP_PASSWORD'),
            }
          : undefined,
        // Redis when configured (shared by all instances), in-process memory otherwise.
        cache: {
          ttl: 10 * 60_000,
          redis: config.get<string>('REDIS_URL'),
          namespace: config.get<string>('CACHE_NAMESPACE', 'nestjs-wordpress-demo'),
        },
        webhook: { secret: config.getOrThrow<string>('WP_WEBHOOK_SECRET') },
      }),
    }),
  ],
  controllers: [
    HealthController,
    PostsController,
    PagesController,
    MenusController,
    HomeController,
    CategoriesController,
  ],
  providers: [
    // Registered through APP_FILTER (not app.useGlobalFilters in main.ts) so it is part of the
    // DI graph: it gets HttpAdapterHost injected and is active in e2e tests too.
    { provide: APP_FILTER, useClass: ContentExceptionFilter },
    HomeService,
    ContentChangesListener,
    NextRevalidationListener,
  ],
})
export class AppModule {}
