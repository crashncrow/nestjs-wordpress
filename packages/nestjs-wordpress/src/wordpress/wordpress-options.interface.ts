export interface WordPressAuthOptions {
  username: string;
  /** An application password (Users → Profile → Application Passwords). Spaces are fine. */
  applicationPassword: string;
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
}

/** Options after defaults are applied and validated; what providers actually inject. */
export interface ResolvedWordPressOptions {
  baseUrl: URL;
  apiUrl: URL;
  auth: WordPressAuthOptions | undefined;
  timeout: number;
  rewriteUrls: boolean;
  fetch: typeof fetch;
}
