# nestjs-wordpress

Use WordPress as a headless content source inside a NestJS application: injectable services, normalized DTOs, tag-based caching and HMAC-signed webhooks for instant invalidation.

```ts
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<Post> {
    return this.posts.getBySlug(slug); // normalized DTO, cached, 404 when missing
  }
}
```

- **NestJS-native**: `WordPressModule.forRoot()` / `forRootAsync()`, DI tokens, an optional exception filter and events.
- **Normalized DTOs, not raw WordPress JSON**: plain-text titles and excerpts, UTC dates, embedded author, featured image and terms, and site-relative links.
- **Tag-based cache** (memory or Redis) invalidated by a small WordPress plugin through signed webhooks.
- **Source-agnostic core**: services depend on a `ContentSource` contract, and WordPress is its first adapter.

> Status: `0.x`. The API may change between minor versions until `1.0`.

## Why

WordPress is a great editing experience, but its REST API is verbose, WordPress-shaped and slow to hit on every request. This library puts a NestJS layer in between, following the **backend-for-frontend (BFF)** pattern:

- **An existing NestJS backend that needs editorial content.** Blog posts, landing pages or help articles live in WordPress while the rest of the domain stays in your API.
- **Several clients consuming the same content.** Web, mobile and partners get one stable, typed contract instead of each parsing WordPress JSON.
- **Combining WordPress with other sources.** One endpoint can merge CMS content with products, users or search results (see `GET /home` in the demo).
- **Gradual migration away from WordPress.** Clients depend on the DTOs, not on WordPress, so the source can be swapped behind `CONTENT_SOURCE` one content type at a time.

## Requirements

|               |                                                                             |
| ------------- | --------------------------------------------------------------------------- |
| Node.js       | ≥ 22.12                                                                     |
| NestJS        | 12 (`@nestjs/common`, `@nestjs/core`)                                       |
| Module format | ESM only                                                                    |
| WordPress     | 6.5+ with pretty permalinks (the REST API under `/wp-json`)                 |
| Optional      | `@keyv/redis` ^5 (Redis cache), `@nestjs/event-emitter` ^12 (change events) |

## Quickstart (5 minutes)

**1. Install**

```bash
npm install nestjs-wordpress
```

**2. Register the module**

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { WordPressModule } from 'nestjs-wordpress';

@Module({
  imports: [WordPressModule.forRoot({ baseUrl: 'https://cms.example.com', isGlobal: true })],
})
export class AppModule {}
```

**3. Inject a service**

```ts
// posts.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PostsService } from 'nestjs-wordpress';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@Query('page') page = '1') {
    return this.posts.list({ page: Number(page), perPage: 10 });
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.posts.getBySlug(slug);
  }
}
```

**4. Turn "not found" into a 404** (optional)

```ts
// app.module.ts
import { APP_FILTER } from '@nestjs/core';
import { ContentExceptionFilter } from 'nestjs-wordpress';

providers: [{ provide: APP_FILTER, useClass: ContentExceptionFilter }],
```

`GET /posts/hello-world` now returns a normalized post, and an unknown slug returns `404`.

## Configuration

### `forRootAsync`

The library never reads `process.env`. Pass configuration explicitly, typically from `@nestjs/config`:

```ts
WordPressModule.forRootAsync({
  isGlobal: true,
  webhookController: { path: 'webhooks/wordpress' }, // extra: see below
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    baseUrl: config.getOrThrow('WP_URL'),
    auth: {
      username: config.getOrThrow('WP_USERNAME'),
      applicationPassword: config.getOrThrow('WP_APP_PASSWORD'),
    },
    cache: { redis: config.get('REDIS_URL') },
    webhook: { secret: config.getOrThrow('WP_WEBHOOK_SECRET') },
  }),
});
```

`useClass` and `useExisting` are supported too.

### Options

| Option        | Type                                      | Default        | Description                                                                                                                                                |
| ------------- | ----------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`     | `string`                                  | (required)     | Site URL. Subdirectory installs (`https://x.com/blog`) work. Validated at bootstrap.                                                                       |
| `auth`        | `{ username, applicationPassword }`       | none           | An [application password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/). Sent **only** for preview reads and menus. |
| `timeout`     | `number` (ms)                             | `10000`        | Per-request timeout.                                                                                                                                       |
| `apiPrefix`   | `string`                                  | `/wp-json`     | REST API prefix.                                                                                                                                           |
| `rewriteUrls` | `boolean`                                 | `true`         | Rewrite links to the WordPress domain into site-relative paths. Media under `/wp-content/` always stays absolute.                                          |
| `fetch`       | `typeof fetch`                            | global `fetch` | Custom implementation (instrumentation, proxies, tests).                                                                                                   |
| `cache`       | `boolean \| { ttl?, redis?, namespace? }` | off            | Tag-based cache. `ttl` in ms (default `300000`), `redis` is a URL (requires `@keyv/redis`), and `namespace` defaults to `nestjs-wordpress`.                |
| `webhook`     | `{ secret, toleranceSeconds? }`           | none           | Secret shared with the WordPress plugin. `toleranceSeconds` defaults to `300`.                                                                             |

### Extras (static)

These change the module's _shape_ (its `global` flag and its controllers), so they sit next to `useFactory` rather than inside its result:

| Extra               | Default | Description                                                                                         |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `isGlobal`          | `false` | Register the module globally.                                                                       |
| `webhookController` | `false` | `true` or `{ path }` mounts `POST /webhooks/wordpress` (or your `path`). Requires `webhook.secret`. |

## API

### Services

All are `@Injectable()` and exported by the module.

```ts
posts.list({ page, perPage, search, categories, tags, orderBy, order }); // Paginated<Post>
posts.getBySlug(slug, { preview? });
posts.getById(id, { preview? });

pages.list({ page, perPage, search, parentId, orderBy, order });
pages.getByPath('about/team');   // hierarchical: disambiguates pages that share a slug
pages.getBySlug(slug);
pages.getById(id);

entries.list('book', { taxonomies: { genre: ['sci-fi'] } }); // any custom post type
entries.getBySlug('book', slug);
entries.getById('book', id);
entries.getByPath('book', path);

terms.list('category', { hideEmpty: true, parentId, search, orderBy, order });
terms.getBySlug('genre', 'sci-fi');
terms.getById('post_tag', 12);

menus.getByLocation('primary');  // returned as a tree
menus.getById(10);
```

- **Term filters** accept IDs or slugs: `posts.list({ categories: ['news', 7] })`. Slugs are resolved to IDs, and a slug that matches nothing returns an empty page rather than an unfiltered one.
- **Single-item lookups** throw `ContentNotFoundException` instead of returning `null`.
- **`preview: true`** reads drafts and other unpublished statuses with the configured credentials. Preview reads are never cached; do not expose them on public endpoints.

### DTOs

```ts
interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}

interface Entry {
  // Post and Page are aliases of Entry
  id: number;
  type: string;
  slug: string;
  status: string;
  title: string; // plain text
  content: string; // rendered HTML, links made site-relative
  excerpt: string; // plain text, without "read more" markers
  date: string;
  modified: string; // ISO 8601, UTC
  path: string; // e.g. "/about/team/"
  parentId: number | null;
  menuOrder: number;
  featuredImage: Media | null; // { id, url, alt, width, height, mimeType, sizes }
  author: Author | null; // { id, name, slug, avatarUrl }
  terms: Record<string, TermRef[]>; // keyed by taxonomy: category, post_tag, genre…
}

interface Term {
  id;
  taxonomy;
  slug;
  name;
  description;
  count;
  parentId: number | null;
  path;
}
interface Menu {
  id;
  name;
  slug;
  items: MenuItem[];
}
interface MenuItem {
  id;
  title;
  url;
  target: string | null;
  kind: 'entry' | 'term' | 'custom';
  object;
  objectId;
  children: MenuItem[];
}
```

Every DTO is plain JSON (no `Date` objects or class instances), so it survives a round trip through Redis or an HTTP response unchanged.

### Errors

Every error extends `ContentSourceException`, a plain `Error`, so the library does not dictate HTTP semantics. `ContentExceptionFilter` maps them to responses without leaking upstream details:

| Exception                                                    | When                                                                    | HTTP (filter) |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------- |
| `ContentNotFoundException`                                   | 404, unknown slug or path, page past the end, anonymous read of a draft | 404           |
| `ContentBadRequestException`                                 | invalid parameters (e.g. `perPage > 100`)                               | 400           |
| `ContentUnauthorizedException` / `ContentForbiddenException` | WordPress rejected **the server's** credentials                         | 502           |
| `ContentSourceTimeoutException`                              | no answer within `timeout`                                              | 504           |
| `ContentSourceUnavailableException`                          | network error, 5xx or a non-JSON body                                   | 502           |

Upstream 401/403 become 502 on purpose: the end client did nothing wrong and cannot fix the server's CMS credentials.

### Tokens and lower-level pieces

| Export                              | Use                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CONTENT_SOURCE`                    | The `ContentSource` contract (cached when caching is on). Inject it to write source-agnostic code.          |
| `CACHE_INVALIDATOR`                 | `{ invalidateTags(tags) }`, always injectable (a no-op when caching is off).                                |
| `TAGGED_CACHE`                      | The full `TaggedCache` (`get` / `set` / `invalidateTags`).                                                  |
| `ContentTags`                       | Tag builders: `ContentTags.entry('post', 12)`, `ContentTags.type('post')`, …                                |
| `WordPressHttpClient`               | The `fetch` client with base URL, auth, timeout and error mapping, for endpoints the services do not cover. |
| `HmacSignatureGuard`, `signWebhook` | Verify or produce signatures in the webhook format.                                                         |

## Caching

```ts
cache: true                                   // in-memory, 5 minute TTL
cache: { ttl: 600_000, redis: 'redis://redis:6379', namespace: 'my-app' }
```

Results are cached as normalized DTOs and tagged from their content:

| Tag                  | Attached to                                           |
| -------------------- | ----------------------------------------------------- |
| `<type>:<id>`        | an entry (`post:12`, `page:4`, `book:7`)              |
| `type:<type>`        | every list of that type, and path lookups             |
| `term:<id>`          | a term, and every entry or list that embeds it        |
| `taxonomy:<name>`    | term lists, and entry lists filtered by that taxonomy |
| `menu:<id>`, `menus` | menus                                                 |

- **Errors and preview reads are never cached.** Concurrent misses for the same key share one request to WordPress.
- **Store layout:**
  - Without `redis`, the cache lives in process memory, which is fine for a single instance.
  - With `redis`, Redis is the **only** store, shared by all instances.
  - With an in-memory layer in front of a Redis secondary, `cacheable` 2.5 keeps serving stale copies on other instances after a tag invalidation. A single shared store avoids that, and an integration test covers it.
- **Freshness:** without the plugin, cached content refreshes only when the TTL expires. With it, changes show up immediately.

## Webhooks and the WordPress plugin

The plugin in [`wordpress-plugin/nestjs-wordpress-webhooks`](https://github.com/crashncrow/nestjs-wordpress/tree/main/wordpress-plugin/nestjs-wordpress-webhooks) (PHP 8.1+, WordPress Coding Standards) tells your app what changed.

**1. In NestJS**, enable the endpoint and the raw body, which the signature is computed over:

```ts
// main.ts
const app = await NestFactory.create(AppModule, { rawBody: true });

// app.module.ts
WordPressModule.forRootAsync({
  webhookController: true, // POST /webhooks/wordpress
  useFactory: () => ({
    baseUrl: '…',
    cache: true,
    webhook: { secret: process.env.WP_WEBHOOK_SECRET! },
  }),
});
```

**2. In WordPress**, copy the plugin folder to `wp-content/plugins/`, activate it, and add to `wp-config.php`:

```php
define( 'NWP_WEBHOOK_URL', 'https://api.example.com/webhooks/wordpress' );
define( 'NWP_WEBHOOK_SECRET', 'the same long random secret' );
define( 'NWP_PUBLIC_MENUS', true ); // optional: allow anonymous REST reads of menus
```

**3. React to changes** (optional) with `@nestjs/event-emitter`. By the time listeners run, the library's cache is already invalidated:

```ts
@Injectable()
export class ContentListener {
  @OnEvent(WORDPRESS_CONTENT_UPDATED) // 'wordpress.content.updated'
  async onChange(event: ContentChangedEvent) {
    // event: { event: 'post.saved', tags: ['post:12', 'type:post', …], id, type, slug, receivedAt }
    await purgeCdn(event.tags); // or call Next.js revalidateTag, notify clients…
  }
}
```

**What the plugin sends.** It reacts to:

- posts that are published, updated, unpublished, trashed or deleted;
- terms that are created, edited or deleted;
- menus that are saved or deleted, and single menu items that are edited.

Changes are deduplicated per request and sent on `shutdown`, one signed POST per change:

```http
POST /webhooks/wordpress
Content-Type: application/json
X-NWP-Timestamp: 1793565350
X-NWP-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the secret>

{"event":"post.saved","tags":["post:12","type:post","taxonomy:category"],"id":12,"type":"post","slug":"hello-world"}
```

- **Signature checks:** the guard rejects bad signatures, tampered bodies and timestamps older than `toleranceSeconds`, comparing in constant time.
- **Other senders:** anything can send a webhook by signing the same way, with `signWebhook(secret, body)`.
- **Blocking vs. non-blocking:** web requests send non-blocking so publishing stays fast. WP-CLI and cron send blocking, because measured from WP-CLI, non-blocking calls never left the process before it exited. Override with the `nwp_webhook_blocking` filter, and adjust requests with `nwp_webhook_request_args`.

## Local development environment

The [repository](https://github.com/crashncrow/nestjs-wordpress) contains a Docker stack (WordPress 7.1, MySQL 9.7, Redis 8), a seed script, a NestJS demo and a Next.js frontend. It needs Node ≥ 22.12, pnpm 12 (`corepack enable`) and Docker:

```bash
pnpm install
pnpm wp:up && pnpm wp:seed   # http://localhost:8080 (admin / admin)
pnpm dev                     # terminal 1: NestJS demo on :3000
pnpm dev:web                 # terminal 2: Next.js on :3001
```

See [CONTRIBUTING.md](https://github.com/crashncrow/nestjs-wordpress/blob/main/CONTRIBUTING.md) for tests and the full workflow.

## Known limitations

- **Pretty permalinks are required:** the `?rest_route=` fallback is not supported.
- **Path lookups** (`getByPath`) are invalidated by any change to that type. That is coarse, but a renamed parent changes its children's paths.
- **Assigning a menu to a theme location** does not send a webhook. The TTL covers it.
- **Tested with the Express platform.** Fastify should work (`rawBody` is supported there) but is not covered by tests yet.

## Roadmap

- **WooCommerce** via the Store API, as a separate module reusing `WordPressHttpClient`
- **WPML / Polylang** language-aware reads
- **More `ContentSource` adapters** (e.g. Webflow), enabling gradual migrations
- **Fastify coverage** and a `?rest_route=` fallback

## License

[MIT](./LICENSE)
