# Phase 0 — Ecosystem research

_Date: 2026-11-01. Data from the npm registry, npm download API, GitHub, Docker Hub and wordpress.org (downloads = last week)._

## Current stable baselines

| Component | Version | Notes |
|---|---|---|
| NestJS (`@nestjs/common`/`core`) | **12.3.2** (2026-10-27) | **ESM-only** since 12.0 (`"type": "module"`, no `require` export). 11.x still on `legacy` tag (11.2.8). |
| TypeScript | 7.0.2 (Go-native) / **6.0.3** | The official Nest 12 starter pins `typescript ^6.0.2` → use 6.0.x. Starter also uses Vitest 4 + oxlint. |
| Node LTS | **26.13** (Active), 24.22 (Maint.), 22.23 (Maint.) | `@keyv/redis`/`keyv` 6 require Node ≥ 22.19. |
| WordPress | **7.1.4** → `wordpress:7.1-php8.4-apache` | PHP 8.5 images still beta. WP-CLI: `wordpress:cli-2.12.0-php8.4`. |
| MySQL | **9.7** (`mysql:lts` = 9.7) | 8.4 is the previous LTS; 26.10 is Innovation. |

## Packages reviewed

| Package | Latest | dl/wk | License | Nest/Node/ESM | Verdict |
|---|---|---|---|---|---|
| `@ntegral/nestjs-wpapi` | 1.0.2 (2020-04) | 15 | ISC | CJS, wraps `wpapi`, Nest ≤7 era | **Discard** — abandoned thin wrapper, no DTOs/cache. |
| `@juicyllama/app-wordpress` | 0.1.3 (2024-02) | 15 | 0BSD | CJS, tied to JuicyLlama framework; repo gone | **Discard** — not standalone. |
| `wpapi` | 1.2.2 (2021-05) | 19k | MIT | CJS, superagent | **Discard** — unmaintained, not fetch-based. |
| `fluent-wp-client` | 3.1.0 (2026-06) | 106 | **GPL-2.0+** | ESM, fetch, zod | **Reference only** — modern and well-designed, but GPL and not Nest. |
| `wordpress-api-client` | 0.4.9 (2023-02) | 65 | MIT | CJS, cross-fetch | **Reference** — good typed-client ideas; stale. |
| `wordpressed` | 1.0.0-alpha.2 (2023-08) | 6 | ISC | oclif CLI | **Discard** — it's a CLI, not a client. |
| `wp-types` | 4.71.0 (2026-08) | 95k | MIT | types only (ships `index.ts`), `engines.node >=24` | **Use as devDependency** — covers Post/Term/Menu/Menu_Item/Menu_Location. Keep it out of the public `.d.ts`. |
| `@wordpress/api-fetch`, `@wordpress/core-data` | 8.0 / 9.0 (2026-10) | 300k / 210k | **GPL-2.0+** | browser/React-oriented | **Discard** — GPL, wrong runtime. |
| `@nestjs/cache-manager` | 12.0.2 (2026-10) | 3.2M | MIT | ESM, peers `cache-manager ≥6`, `keyv ≥5`, Nest 9–12 | **Use (optional peer)** — standard DI token, but **no tag support**. |
| `cache-manager` | 7.2.9 (2026-06) | 6.2M | MIT | ESM, Keyv stores | No tags. |
| `cacheable` | 2.5.0 (2026-06) | 38M | MIT | ESM | **Use** — native tag invalidation (`cache.tags.invalidateTag`), tag metadata in Redis secondary → multi-instance safe. |
| `@keyv/redis` | 6.1.0 (2026-10) | 2.1M | MIT | ESM, Node ≥22.19 | **Use (optional)** — the current Redis adapter for the Keyv/cacheable stack. |
| `@nestjs/event-emitter` | 12.0.1 (2026-09) | 3.3M | MIT | ESM, Nest 11–12 | **Use (optional peer)**. |

**Raw body for HMAC (Nest 12):** still `NestFactory.create(App, { rawBody: true })` + `RawBodyRequest<Request>` (`req.rawBody: Buffer`). The library can't set this itself → document it and fail loudly in the guard if `rawBody` is missing.

## WordPress webhook plugins

| Plugin | Installs | License | Payload / auth |
|---|---|---|---|
| HeadlessNext Connector 1.0.0 | <10 | GPL-2.0+ | `save_post` only; `{post_id, post_type, slug, permalink, action, site, tag, path}`; **plain secret in body + header**, non-blocking. |
| On-Demand Revalidation 1.4.0 | 80 | GPL-3 | `{postId, paths, tags}` via `PUT`, `Authorization: Bearer`, **blocking**. |
| next-wp / next-revalidate (9d8dev, ★1.3k) | n/a | MIT | `{contentType, contentId}`, `x-webhook-secret` header; also hooks menus, media, users, trash. |
| WP Webhooks 3.5.0 | 20k | GPL | Generic automation tool, configurable payloads; heavy for this use. |

None signs the body with HMAC, and none shares a payload format → **no de-facto standard to be compatible with**. Our own signed `{event, tags, id, type, slug}` is justified. Worth borrowing from next-wp: also hook `wp_update_nav_menu`/`wp_delete_nav_menu` and `trashed_post`/`transition_post_status`, otherwise menu edits and unpublishing won't invalidate.

## Findings that affect scope

1. **Menus require auth in core.** `/wp/v2/menus`, `/menu-items`, `/menu-locations` need `edit_theme_options` unless the `rest_menu_read_access` filter returns true. Options: our PHP plugin adds that filter (opt-in constant), or menu reads need the application password.
2. **Nest 12 is ESM-only.** A dual ESM+CJS build still makes sense if we support Nest 11 (CJS) too (peer `^11 || ^12`); otherwise ESM-only is simpler. Node ≥ 22.12 can `require()` ESM anyway.
3. **No esbuild-based bundlers for the library** (tsup/tsdown): esbuild doesn't emit `emitDecoratorMetadata`, which Nest DI relies on. Build with `tsc` (or SWC).
4. **Cache with tags is not in `@nestjs/cache-manager`.** Recommended: our own `CACHE_INVALIDATOR`/tagged-cache interface, default implementation on `cacheable` (memory default, `@keyv/redis` as secondary). Building a tag index manually over cache-manager is racy with Redis.
5. **The PHP plugin license:** MIT is GPL-compatible and accepted by wordpress.org, so keeping it MIT is fine.

## Recommendation

- **Dependencies:** `wp-types` (dev, types only), `cacheable` (runtime), optional peers `@keyv/redis`, `@nestjs/event-emitter`; peers `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`. Drop `@nestjs/cache-manager` as a requirement (optionally offer an adapter later).
- **Build ourselves:** fetch-based WP client, DTO normalization, pagination, error mapping, HMAC guard, webhook controller, PHP plugin.
- **The gap `nestjs-wordpress` fills:** there is no maintained NestJS-native WordPress module. Existing ones are abandoned (2020/2024) and only wrap raw clients. Nothing combines DI-idiomatic modules, normalized DTOs, tag-based cache with multi-instance invalidation, and an **HMAC-signed** webhook plugin in a single MIT package.
- **Nothing found that makes the project unnecessary.** The scope changes are: (a) `cacheable` instead of `@nestjs/cache-manager` for tags, (b) menus need the plugin filter or auth, (c) decide on Nest 11 support (which drives the dual build).
