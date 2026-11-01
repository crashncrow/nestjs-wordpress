import { decodeEntities } from './html.js';

/**
 * Turns absolute URLs on the CMS domain into site-relative paths, so the frontend can serve
 * them under its own domain (`https://cms.example.com/about/` → `/about/`).
 *
 * Files under `/wp-content/` and `/wp-includes/` (uploads, theme assets) are left absolute:
 * they only exist on the CMS host, so a relative URL would break them.
 */
export class UrlRewriter {
  private readonly origin: string;
  /** Install path with trailing slash, e.g. `/` or `/blog/`. */
  private readonly basePath: string;

  constructor(
    baseUrl: URL,
    private readonly enabled: boolean,
  ) {
    this.origin = baseUrl.origin;
    this.basePath = baseUrl.pathname;
  }

  /** Returns a site-relative path when `url` belongs to the CMS, otherwise `url` unchanged. */
  toRelative(url: string): string {
    if (!this.enabled || !url) return url;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return url; // already relative, `mailto:`-less garbage, etc.
    }
    if (parsed.origin !== this.origin || !parsed.pathname.startsWith(this.basePath)) return url;

    const pathInSite = parsed.pathname.slice(this.basePath.length - 1);
    if (/^\/wp-(content|includes)\//.test(pathInSite)) return url;

    return `${pathInSite}${parsed.search}${parsed.hash}`;
  }

  /** Same as {@link toRelative} for an entry/term `link`, but always returns a path. */
  toPath(url: string): string {
    try {
      const parsed = new URL(url);
      const pathInSite = parsed.pathname.startsWith(this.basePath)
        ? parsed.pathname.slice(this.basePath.length - 1)
        : parsed.pathname;
      return `${pathInSite}${parsed.search}`;
    } catch {
      return url;
    }
  }

  /** Rewrites `href` attributes inside rendered HTML. `src` is untouched (media stays absolute). */
  rewriteHtml(html: string): string {
    if (!this.enabled) return html;
    return html.replace(
      /(\shref=)(["'])(.*?)\2/gi,
      (match, attr: string, quote: string, value: string) => {
        const decoded = decodeEntities(value);
        const rewritten = this.toRelative(decoded);
        // Leave untouched links byte-for-byte identical.
        return rewritten === decoded
          ? match
          : `${attr}${quote}${rewritten.replaceAll('&', '&amp;')}${quote}`;
      },
    );
  }
}
