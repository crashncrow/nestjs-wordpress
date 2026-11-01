import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { type ContentChangedEvent, WORDPRESS_CONTENT_UPDATED } from './content-changed.event.js';

interface Emitter {
  emitAsync(event: string, ...values: unknown[]): Promise<unknown[]>;
}

/**
 * Emits {@link WORDPRESS_CONTENT_UPDATED} when the app uses `@nestjs/event-emitter`, and
 * does nothing otherwise.
 *
 * `@nestjs/event-emitter` is an optional peer dependency, so it cannot be imported statically
 * (the import would crash apps that don't install it). It is loaded with a dynamic `import()`
 * and the emitter is looked up through `ModuleRef` with `strict: false`, i.e. anywhere in the
 * app, since `EventEmitterModule.forRoot()` is registered by the application, not by us.
 */
@Injectable()
export class ContentEventPublisher implements OnModuleInit {
  private readonly logger = new Logger(ContentEventPublisher.name);
  private emitter: Emitter | undefined;

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    try {
      const { EventEmitter2 } = await import('@nestjs/event-emitter');
      this.emitter = this.moduleRef.get(EventEmitter2, { strict: false });
    } catch {
      this.logger.debug(
        `EventEmitterModule not found: "${WORDPRESS_CONTENT_UPDATED}" events will not be emitted`,
      );
    }
  }

  async publish(event: ContentChangedEvent): Promise<void> {
    if (!this.emitter) return;
    try {
      // emitAsync waits for async listeners, so the webhook response reflects their work.
      await this.emitter.emitAsync(WORDPRESS_CONTENT_UPDATED, event);
    } catch (error) {
      // The cache is already invalidated; a failing listener must not make WordPress retry.
      this.logger.error(`A "${WORDPRESS_CONTENT_UPDATED}" listener failed`, error as Error);
    }
  }
}
