import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { PostsService, WordPressModule, type WordPressModuleOptions } from '../../src/index.js';
import { BASE_URL, fakeFetch, fixture } from '../helpers.js';

// Keeps the README's configuration examples honest.

@Injectable()
class FeatureService {
  constructor(readonly posts: PostsService) {}
}

/** A feature module that does NOT import WordPressModule. */
@Module({ providers: [FeatureService] })
class FeatureModule {}

describe('module configuration', () => {
  it('isGlobal: services are injectable in modules that do not import WordPressModule', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', fixture('post-by-slug')]]);
    const moduleRef = await Test.createTestingModule({
      imports: [
        WordPressModule.forRoot({ baseUrl: BASE_URL, fetch: fetchMock, isGlobal: true }),
        FeatureModule,
      ],
    }).compile();

    const post = await moduleRef.get(FeatureService).posts.getBySlug('demo-post-3');
    expect(post.slug).toBe('demo-post-3');
  });

  it('without isGlobal, feature modules must import it', async () => {
    await expect(
      Test.createTestingModule({
        imports: [WordPressModule.forRoot({ baseUrl: BASE_URL }), FeatureModule],
      }).compile(),
    ).rejects.toThrow(/PostsService/);
  });

  it('forRootAsync supports useClass', async () => {
    const fetchMock = fakeFetch([['wp/v2/posts', fixture('post-by-slug')]]);
    @Injectable()
    class WordPressConfig {
      create(): WordPressModuleOptions {
        return { baseUrl: BASE_URL, fetch: fetchMock };
      }
    }
    const moduleRef = await Test.createTestingModule({
      imports: [WordPressModule.forRootAsync({ useClass: WordPressConfig })],
    }).compile();

    await expect(moduleRef.get(PostsService).getBySlug('demo-post-3')).resolves.toMatchObject({
      id: 9,
    });
  });
});
