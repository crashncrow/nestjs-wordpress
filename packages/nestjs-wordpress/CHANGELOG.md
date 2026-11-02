# nestjs-wordpress

## 0.2.0-beta.2

### Fixes

- `stripTags` (used for titles, excerpts and names) now repeats until nothing changes and drops leftover `<` from unterminated tags or comments (e.g. `a <!-- b`), so plain-text fields never contain markup (CodeQL `js/incomplete-multi-character-sanitization`).
- Docs: `title`, `excerpt` and term/menu names are plain text with entities decoded; escape them before inserting into HTML.

## 0.2.0-beta.1

First public pre-release, on the `beta` dist-tag. It also contains the 0.1 milestone below, which was never published on its own.

### Caching and webhooks

- Tag-based cache (`cache: true | { ttl, redis, namespace }`) on `cacheable`. It runs in memory, or uses Redis as the single shared store.
- `CACHE_INVALIDATOR` and `TAGGED_CACHE` exports.
- An invalidation contract (`tagsForResult`, `tagsForChange`, `ContentTags`), also published as `nestjs-wordpress/invalidation` without NestJS. Dependencies are read from cached results: menus depend on what they link to, and entries on their terms, author and featured image.
- An opt-in webhook controller (`webhookController` extra) protected by `HmacSignatureGuard`. It verifies a timestamped HMAC-SHA256 over the raw body.
- A `wordpress.content.updated` event (`ContentChangedEvent`) when `@nestjs/event-emitter` is installed.
- A webhook signature module (`signWebhook`, `verifyWebhook`) on Web Crypto, also published as `nestjs-wordpress/signature` without NestJS. `HmacSignatureGuard` is a thin adapter around it. The plugin is checked against the same test vectors.
- WordPress plugin `nestjs-wordpress-webhooks`, which sends signed content changes (`{ event, type, id, slug, taxonomies? }`) for posts, attachments, users, terms and menus.

## 0.1.0 (milestone, not published)

### Read API

- `WordPressModule.forRoot()` / `forRootAsync()` with `isGlobal`.
- `PostsService`, `PagesService` (hierarchical `getByPath`), `EntriesService` (custom post types), `TermsService` and `MenusService` (menus as trees).
- Normalized DTOs with paginated results (`Paginated<T>`).
- Term filters by ID or slug.
- Preview reads with application passwords.
- A `ContentSourceException` hierarchy and the optional `ContentExceptionFilter`.
- A source-agnostic `CONTENT_SOURCE` contract.
