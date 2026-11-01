export interface WordPressAuthOptions {
  username: string;
  /** An application password (Users → Profile → Application Passwords). Spaces are fine. */
  applicationPassword: string;
}

export interface WordPressCacheOptions {
  /** Time-to-live in milliseconds. Defaults to 300 000 (5 minutes). */
  ttl?: number;
  /**
   * Redis URL (`redis://host:6379`). Requires the optional `@keyv/redis` package. When
   * omitted, an in-process memory cache is used (fine for a single instance).
   */
  redis?: string;
  /** Key prefix, to share one Redis between apps. Defaults to `nestjs-wordpress`. */
  namespace?: string;
}

export interface WordPressWebhookOptions {
  /** Shared secret used by the WordPress plugin to sign requests (HMAC-SHA256). */
  secret: string;
  /** Maximum clock skew / request age accepted, in seconds. Defaults to 300. */
  toleranceSeconds?: number;
}

export interface WordPressModuleOptions {
  /** Site URL, e.g. `https://cms.example.com` (a subdirectory install like `https://x.com/blog` works too). */
  baseUrl: string;
  /**
   * Optional credentials. They are only sent when needed: preview reads (drafts) and menus,
   * which core WordPress does not expose anonymously. Public reads stay anonymous.
   */
  auth?: WordPressAuthOptions;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeout?: number;
  /** REST API prefix. Defaults to `/wp-json`. */
  apiPrefix?: string;
  /**
   * Rewrite links pointing at the CMS domain (in content, entry paths and menus) to
   * site-relative paths. Media URLs (`/wp-content/...`) are always kept absolute.
   * Defaults to `true`.
   */
  rewriteUrls?: boolean;
  /**
   * Custom `fetch` implementation (instrumentation, proxies, tests). Defaults to the global one.
   */
  fetch?: typeof fetch;
  /**
   * Tag-based caching of normalized content. Off by default: without the webhook plugin,
   * cached content is only refreshed when the TTL expires. `true` uses all defaults.
   */
  cache?: boolean | WordPressCacheOptions;
  /** Required when the webhook controller is enabled (see the `webhookController` extra). */
  webhook?: WordPressWebhookOptions;
}

/** Options after defaults are applied and validated; what providers actually inject. */
export interface ResolvedWordPressOptions {
  baseUrl: URL;
  apiUrl: URL;
  auth: WordPressAuthOptions | undefined;
  timeout: number;
  rewriteUrls: boolean;
  fetch: typeof fetch;
  cache: { ttl: number; redis: string | undefined; namespace: string } | false;
  webhook: { secret: string; toleranceSeconds: number } | undefined;
}
