# Contributing

Thanks for helping! This is also a learning project, so explanations in PRs are welcome.

## Setup

```bash
pnpm install
pnpm wp:up && pnpm wp:seed
```

`wp:seed` is idempotent. It rotates the demo's application password and writes `apps/demo/.env` and `apps/web/.env.local`. Restart running dev servers after re-seeding.

## Checks

| Command                                        | What it runs                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm lint`                                    | oxlint + Prettier                                                                     |
| `pnpm lint:php`                                | PHPCS with WordPress Coding Standards (in Docker)                                     |
| `pnpm typecheck`                               | `tsc` in every package (build the library first: apps type-check against its `dist`)  |
| `pnpm build`                                   | library, demo and Next.js app                                                         |
| `pnpm test`                                    | library unit tests (mocked `fetch`); the Redis integration test runs when Redis is up |
| `pnpm test:e2e`                                | demo against the Docker WordPress, including the full webhook loop                    |
| `pnpm --filter nestjs-wordpress check:package` | publint + are-the-types-wrong on the packed tarball                                   |

CI runs all of these on every push and pull request.

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat(core): …`, `fix(plugin): …`), small and focused.
- **Comments:** explain _why_ for non-obvious decisions; the code shows _what_.
- **Public API:** everything is exported from `packages/nestjs-wordpress/src/index.ts`. Raw WordPress types (`wp-types`) must not leak into it.
- **Tests:** library tests use fixtures recorded from the seeded WordPress (`test/fixtures`), so unit tests exercise real WordPress JSON.
- **Changes to the cache tag vocabulary** must be mirrored in the plugin (`includes/class-nwp-webhooks.php`) and `apps/web/lib/tags.ts`.

## Releasing

Versions and the changelog are managed with [Changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset            # describe your change (in a PR)
pnpm changeset version    # bump versions + update CHANGELOG.md (when releasing)
pnpm --filter nestjs-wordpress check:package
pnpm --filter nestjs-wordpress publish --access public
```
