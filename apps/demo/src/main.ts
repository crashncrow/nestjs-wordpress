import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  // rawBody: true keeps the unparsed request body next to the parsed JSON.
  // The webhook guard (phase 3) needs the exact bytes to verify the HMAC signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
