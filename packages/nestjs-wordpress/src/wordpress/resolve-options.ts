import type {
  ResolvedWordPressOptions,
  WordPressModuleOptions,
} from './wordpress-options.interface.js';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Validates options once, at bootstrap. A misconfigured base URL should crash the app on
 * startup, not surface as a confusing error on the first request.
 */
export function resolveWordPressOptions(options: WordPressModuleOptions): ResolvedWordPressOptions {
  let baseUrl: URL;
  try {
    baseUrl = new URL(options.baseUrl);
  } catch {
    throw new Error(`WordPressModule: "baseUrl" must be an absolute URL, got "${options.baseUrl}"`);
  }
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error(`WordPressModule: "baseUrl" must use http or https, got "${baseUrl.protocol}"`);
  }
  // Normalize to a trailing slash so relative resolution keeps subdirectory installs.
  baseUrl.pathname = baseUrl.pathname.replace(/\/*$/, '/');
  baseUrl.search = '';
  baseUrl.hash = '';

  const prefix = (options.apiPrefix ?? '/wp-json').replace(/^\/+|\/+$/g, '');
  const apiUrl = new URL(`${prefix}/`, baseUrl);

  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error(`WordPressModule: "timeout" must be a positive number, got ${timeout}`);
  }

  if (options.auth && (!options.auth.username || !options.auth.applicationPassword)) {
    throw new Error('WordPressModule: "auth" needs both "username" and "applicationPassword"');
  }

  return {
    baseUrl,
    apiUrl,
    auth: options.auth,
    timeout,
    rewriteUrls: options.rewriteUrls ?? true,
    // Bind so `this` is correct when the global fetch is stored and called later.
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
  };
}
