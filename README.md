# nestjs-wordpress

WordPress as a headless content source for NestJS, plus everything needed to develop and demo it.

**→ Library documentation: [packages/nestjs-wordpress/README.md](packages/nestjs-wordpress/README.md)**

```
WordPress ──(REST)──▶ NestJS + nestjs-wordpress ──(JSON)──▶ web / mobile / Next.js
    │                       ▲  normalized DTOs, tag cache        ▲
    └── plugin: signed webhook ┘ ── wordpress.content.updated ───┘ revalidateTag
```

## Repository layout

| Path                                                     | What                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`packages/nestjs-wordpress`](packages/nestjs-wordpress) | The library published to npm                                                                           |
| [`apps/demo`](apps/demo)                                 | NestJS app using the library: posts, pages, menus, a BFF `/home` aggregate, a Redis cache and webhooks |
| [`apps/web`](apps/web)                                   | Next.js frontend consuming the demo, revalidated by tag when WordPress changes                         |
| [`wordpress-plugin`](wordpress-plugin)                   | PHP plugin that sends HMAC-signed change webhooks                                                      |
| [`docker`](docker)                                       | WordPress, MySQL and Redis stack, plus an idempotent WP-CLI seed                                       |
| [`docs`](docs)                                           | Research and implementation plan                                                                       |

## Quick start

Requirements: Node ≥ 22.12, pnpm, Docker.

```bash
pnpm install
pnpm wp:up && pnpm wp:seed   # WordPress at http://localhost:8080 (admin / admin)
pnpm dev                     # NestJS demo at http://localhost:3000 (try /home, /posts, /menus/primary)
pnpm dev:web                 # Next.js at http://localhost:3001
```

Edit a post's title in WordPress and reload: the change propagates through the webhook, the NestJS cache and the Next.js cache.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).
