# Implementation plan

Decisions taken after [research](./research.md): **NestJS 12 only, ESM-only build**, **`cacheable`** for tag-based caching.

## 1. Repository layout

```
nestjs-wordpress/
  package.json                 # private root: workspace scripts only
  pnpm-workspace.yaml
  tsconfig.base.json           # shared compiler options
  .oxlintrc.json  .prettierrc  .editorconfig  .nvmrc
  .changeset/                  # versioning + CHANGELOG generation
  packages/nestjs-wordpress/   # the publishable library
  apps/demo/                   # NestJS 12 example app (private)
  wordpress-plugin/nestjs-wordpress-webhooks/
  docker/  docker-compose.yml  seed.sh
  docs/  research.md  plan.md
  .github/workflows/ci.yml
```

### Library source

```
packages/nestjs-wordpress/src/
  index.ts                         # the ONLY public entry point
  core/                            # source-agnostic: knows nothing about WordPress
    content-source.interface.ts    # ContentSource contract every adapter implements
    tokens.ts                      # CONTENT_SOURCE, CACHE_INVALIDATOR, TAGGED_CACHE
    dto/                           # Post, Page, Entry, Term, Menu, MenuItem, Media, Author, Paginated<T>
    errors/                        # ContentSourceException hierarchy + ContentExceptionFilter
    services/                      # PostsService, PagesService, EntriesService, TermsService, MenusService
    cache/                         # TaggedCache interface, CacheableTaggedCache, CachedContentSource
    webhook/                       # HmacSignatureGuard, webhook controller factory, ContentChangedEvent
  wordpress/                       # the first adapter
    wordpress.module.ts
    wordpress.module-definition.ts # ConfigurableModuleBuilder
    wordpress-options.interface.ts
    http/wp-http-client.ts         # fetch + auth + timeout + error mapping + pagination headers
    wordpress-content-source.ts    # implements ContentSource over /wp-json/wp/v2
    normalizers/                   # raw WP JSON (wp-types) -> our DTOs
```

**How the layers fit:**

- Public services (`PostsService`, …) live in `core` and depend only on the `CONTENT_SOURCE` token.
- `WordPressModule` binds `CONTENT_SOURCE` to `WordPressContentSource`.
- When caching is enabled, that binding is wrapped by `CachedContentSource` (decorator pattern). The wrapper is source-agnostic, so the cache works for any future adapter.
- **Future extensions without touching core:**
  - `WebflowModule` binds its own `CONTENT_SOURCE`.
  - `WooCommerceModule` (a separate package later) imports the exported `WordPressHttpClient` to reuse the base URL, auth and error mapping.

## 2. Tooling

| Concern         | Choice                                                                                                              | Why                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Package manager | pnpm workspaces, `workspace:*`                                                                                      | As requested.                                                                        |
| Language        | TypeScript 6.0.x, `strict`, `module/moduleResolution: nodenext`, `experimentalDecorators` + `emitDecoratorMetadata` | Same as the official Nest 12 starter. TS 7 later.                                    |
| Library build   | `tsc -p tsconfig.build.json` → `dist/` (ESM `.js` + `.d.ts` + maps)                                                 | esbuild-based bundlers drop decorator metadata.                                      |
| `exports`       | `{ ".": { "types", "default" } }`, `"type": "module"`, `sideEffects: false`                                         | ESM-only.                                                                            |
| Tests           | Vitest 5 (+ supertest for e2e)                                                                                      | v5 emits decorator metadata natively (guarded by `test/decorator-metadata.spec.ts`). |
| Lint / format   | oxlint + Prettier                                                                                                   | Nest 12 starter default.                                                             |
| Package checks  | `publint` + `@arethetypeswrong/cli`                                                                                 | Catches broken `exports`/types before publishing.                                    |
| Releases        | Changesets                                                                                                          | Conventional changelog per package.                                                  |
| Node            | `engines: >=22.19` (keyv 6 floor); CI matrix 22 / 24 / 26                                                           |                                                                                      |

**Library dependencies:**

- `dependencies`: `cacheable`.
- `peerDependencies`: `@nestjs/common ^12`, `@nestjs/core ^12`, `reflect-metadata`, `rxjs`.
- Optional peers: `@nestjs/event-emitter ^12`, `@keyv/redis ^6`.
- `devDependencies`: `wp-types`.

**Root scripts:**

- `wp:up`, `wp:seed`, `wp:down`
- `dev`: library `tsc --watch` and demo `nest start --watch` in parallel
- `build`, `lint`, `typecheck`, `test`, `test:e2e`

## 3. Public API

### Module

```ts
WordPressModule.forRoot({
  baseUrl: 'https://cms.example.com',
  auth: { username: 'api', applicationPassword: 'xxxx xxxx …' }, // optional: drafts/preview, menus
  timeout: 10_000,
  rewriteUrls: true,            // absolute WP URLs -> relative paths in content, links, menus
  cache: { ttl: 300_000, redis: 'redis://localhost:6379' } /* or false; memory when no redis */,
  webhook: { secret: process.env.X },   // the app passes it; the library never reads env
  isGlobal: true,
});

WordPressModule.forRootAsync({
  imports: [ConfigModule], inject: [ConfigService],
  useFactory: (c: ConfigService) => ({ baseUrl: c.getOrThrow('WP_URL'), … }),
  webhookController: { path: 'webhooks/wordpress' }, // "extra": must be static, see below
});
```

Design note: controllers are registered when the module is defined, before any async factory runs. For that reason, _whether_ to mount the webhook controller and _where_ are `ConfigurableModuleBuilder` **extras** (static), while the secret goes in the regular (possibly async) options.

### Services (all `@Injectable`, exported)

```ts
posts.list({ page, perPage, search, categories, tags, orderBy, order }): Promise<Paginated<Post>>
posts.getBySlug(slug, { preview? }) / posts.getById(id)
pages.getByPath('about/team')          // hierarchical: resolves the slug chain and verifies parents
pages.getBySlug(slug) / pages.getById(id)
entries.list('book', query) / entries.getBySlug('book', slug)   // custom post types
terms.list('category' | 'post_tag' | 'genre', query) / terms.getBySlug(taxonomy, slug)
menus.getByLocation('primary') / menus.getById(id)
```

The `CONTENT_SOURCE` token is also exported, for apps that want the raw contract.

### DTOs (plain, JSON-serializable: dates are ISO strings so they survive Redis)

```ts
interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}
interface Entry {
  id;
  type;
  slug;
  status;
  title;
  content /*html*/;
  excerpt /*plain text*/;
  date;
  modified;
  path /*relative*/;
  featuredImage?: Media;
  author?: Author;
  terms: Record<string, Term[]>;
}
interface Post extends Entry {}
interface Page extends Entry {
  parentId: number | null;
  menuOrder: number;
}
interface Term {
  id;
  taxonomy;
  slug;
  name;
  description;
  count;
  parentId: number | null;
}
interface Menu {
  id;
  name;
  slug;
  items: MenuItem[]; /* tree */
}
interface MenuItem {
  id;
  title;
  url;
  target?;
  children: MenuItem[];
}
interface Media {
  id;
  url;
  alt;
  width?;
  height?;
  sizes: Record<string, { url; width; height }>;
}
interface Author {
  id;
  name;
  slug;
  avatarUrl?;
}
```

### Errors

All errors extend `ContentSourceException`, a plain `Error`. The library doesn't decide HTTP semantics.

| Library exception                   | WP condition                    | HTTP status set by the optional `ContentExceptionFilter` |
| ----------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `ContentNotFoundException`          | 404, or empty result for a slug | 404                                                      |
| `ContentUnauthorizedException`      | 401                             | 401                                                      |
| `ContentForbiddenException`         | 403                             | 403                                                      |
| `ContentSourceTimeoutException`     | `AbortSignal.timeout`           | 504                                                      |
| `ContentSourceUnavailableException` | network / 5xx                   | 502                                                      |

The filter is not applied globally by default: the app opts in.

## 4. Cache and webhooks (v0.2)

**Tags:**

- `type:post`: every list of that type.
- `post:123`: a single entry. Pages and CPTs follow the same `<type>:<id>` pattern.
- `term:5` + `taxonomy:category`: also attached to every entry embedding that term.
- `menu:3` + `menus`.

**Cache behavior:**

- Cache keys are a stable hash of the method and its params.
- Authenticated/preview reads are **never cached**.

**Signature:**

- Headers: `X-NWP-Timestamp` and `X-NWP-Signature: sha256=<hex>`.
- The HMAC is computed over `${timestamp}.${rawBody}`.
- The guard checks a ±5 min window (replay protection), compares with `timingSafeEqual`, and throws a clear error if `rawBody: true` wasn't enabled.

**Flow:** guard → controller → `TaggedCache.invalidateTags(tags)` → emit `wordpress.content.updated` (`{ event, tags, id, type, slug }`; `event` ∈ `post.saved | post.deleted | term.saved | term.deleted | menu.saved`). Emitting is a no-op when `@nestjs/event-emitter` isn't installed.

**PHP plugin** (PHP 8.1+, WPCS):

- **Hooks:** `save_post`, `transition_post_status`, `delete_post`, `edited_term`, `delete_term`, `wp_update_nav_menu`.
- **Filtering:** skips autosaves and revisions.
- **Batching:** collects changes during the request and sends them once on `shutdown` (`save_post` fires several times per edit).
- **Sending:** `wp_remote_post(..., ['blocking' => false])`.
- **Constants:** `NWP_WEBHOOK_URL`, `NWP_WEBHOOK_SECRET`, plus opt-in `NWP_PUBLIC_MENUS`, which adds the `rest_menu_read_access` filter so menus can be read without auth.

## 5. Phases

0. ✅ Research.
1. Scaffold + tooling + Docker + idempotent seed. Verified by `pnpm wp:up && pnpm wp:seed` and a `curl` checklist.
2. v0.1 read API + demo (`/posts`, `/posts/:slug`, `/pages/*path`, `/menus/:location`, `/home`) + unit tests (mocked `fetch`) + read e2e.
3. Cache, webhook guard/controller, PHP plugin, webhook e2e (`wp post update` via WP-CLI → poll until invalidated + event received).
4. CI, README, CONTRIBUTING, CHANGELOG, publint/attw, `npm pack --dry-run` (no publish).

## Open points

- **npm name:** `nestjs-wordpress` is free on npm → proposed unscoped (fallback `@crashncrow/nestjs-wordpress`).
- **Service names:** `PostsService` etc. could clash with app classes of the same name (the demo will have a `PostsController`). Alternative: a single `WordPressContent` facade (`content.posts.list()`). Proposal: keep separate services; apps can alias imports.
