# nestjs-wordpress

## 0.2.0 (unreleased)

First public release. It also contains the 0.1 milestone below, which was never published on its own.

### Caching and webhooks

- Tag-based cache (`cache: true | { ttl, redis, namespace }`) on `cacheable`. It runs in memory, or uses Redis as the single shared store.
- `CACHE_INVALIDATOR`, `TAGGED_CACHE` and `ContentTags` exports.
- An opt-in webhook controller (`webhookController` extra) protected by `HmacSignatureGuard`. It verifies a timestamped HMAC-SHA256 over the raw body.
- A `wordpress.content.updated` event (`ContentChangedEvent`) when `@nestjs/event-emitter` is installed.
- A `signWebhook()` helper for other senders.
- WordPress plugin `nestjs-wordpress-webhooks`, which sends signed changes for posts, terms and menus.

## 0.1.0 (milestone, not published)

### Read API

- `WordPressModule.forRoot()` / `forRootAsync()` with `isGlobal`.
- `PostsService`, `PagesService` (hierarchical `getByPath`), `EntriesService` (custom post types), `TermsService` and `MenusService` (menus as trees).
- Normalized DTOs with paginated results (`Paginated<T>`).
- Term filters by ID or slug.
- Preview reads with application passwords.
- A `ContentSourceException` hierarchy and the optional `ContentExceptionFilter`.
- A source-agnostic `CONTENT_SOURCE` contract.
