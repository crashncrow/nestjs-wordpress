import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  ContentBadRequestException,
  ContentExceptionFilter,
  ContentForbiddenException,
  ContentNotFoundException,
  ContentSourceException,
  ContentSourceTimeoutException,
  ContentSourceUnavailableException,
  ContentUnauthorizedException,
} from '../../src/index.js';

// A Map, not an object: a route param must not reach Object.prototype (`constructor`, …).
const EXCEPTIONS = new Map<string, new (message: string) => ContentSourceException>([
  ['notFound', ContentNotFoundException],
  ['badRequest', ContentBadRequestException],
  ['unauthorized', ContentUnauthorizedException],
  ['forbidden', ContentForbiddenException],
  ['timeout', ContentSourceTimeoutException],
  ['unavailable', ContentSourceUnavailableException],
  ['base', ContentSourceException],
]);

@Controller()
class ThrowingController {
  @Get(':kind')
  throw(@Param('kind') kind: string): never {
    const Exception = EXCEPTIONS.get(kind);
    if (!Exception) throw new NotFoundException();
    throw new Exception('upstream detail that must not leak');
  }
}

describe('ContentExceptionFilter', () => {
  it.each([
    ['notFound', 404],
    ['badRequest', 400],
    // The *server's* CMS credentials failed: not the client's fault, so 502 instead of 401/403.
    ['unauthorized', 502],
    ['forbidden', 502],
    ['timeout', 504],
    ['unavailable', 502],
    ['base', 502],
  ])('maps %s to HTTP %i without leaking upstream details', async (kind, status) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThrowingController],
      providers: [{ provide: APP_FILTER, useClass: ContentExceptionFilter }],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const { body } = await request(app.getHttpServer()).get(`/${kind}`).expect(status);
    expect(body.statusCode).toBe(status);
    expect(JSON.stringify(body)).not.toContain('upstream detail');

    await app.close();
  });
});
