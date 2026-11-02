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

// An explicit switch, not a lookup table: the route param never selects what gets invoked.
function exceptionFor(kind: string, message: string): Error {
  switch (kind) {
    case 'notFound':
      return new ContentNotFoundException(message);
    case 'badRequest':
      return new ContentBadRequestException(message);
    case 'unauthorized':
      return new ContentUnauthorizedException(message);
    case 'forbidden':
      return new ContentForbiddenException(message);
    case 'timeout':
      return new ContentSourceTimeoutException(message);
    case 'unavailable':
      return new ContentSourceUnavailableException(message);
    case 'base':
      return new ContentSourceException(message);
    default:
      return new NotFoundException();
  }
}

@Controller()
class ThrowingController {
  @Get(':kind')
  throw(@Param('kind') kind: string): never {
    throw exceptionFor(kind, 'upstream detail that must not leak');
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
