import { describe, expect, it } from 'vitest';
import { UrlRewriter } from '../../src/wordpress/normalizers/url-rewriter.js';

describe('UrlRewriter', () => {
  const urls = new UrlRewriter(new URL('https://cms.example.com/'), true);

  it('makes CMS links site-relative, keeping query and hash', () => {
    expect(urls.toRelative('https://cms.example.com/about/team/?a=1#x')).toBe('/about/team/?a=1#x');
  });

  it('keeps media and external URLs absolute', () => {
    const media = 'https://cms.example.com/wp-content/uploads/2026/11/a.png';
    expect(urls.toRelative(media)).toBe(media);
    expect(urls.toRelative('https://github.com/x')).toBe('https://github.com/x');
    expect(urls.toRelative('/already/relative/')).toBe('/already/relative/');
  });

  it('rewrites href attributes only, leaving img src untouched', () => {
    const html =
      '<a href="https://cms.example.com/about/">About</a><img src="https://cms.example.com/wp-content/uploads/a.png"><a href="https://ext.com/?a=1&amp;b=2">x</a>';
    expect(urls.rewriteHtml(html)).toBe(
      '<a href="/about/">About</a><img src="https://cms.example.com/wp-content/uploads/a.png"><a href="https://ext.com/?a=1&amp;b=2">x</a>',
    );
  });

  it('supports WordPress installed in a subdirectory', () => {
    const sub = new UrlRewriter(new URL('https://example.com/blog/'), true);
    expect(sub.toRelative('https://example.com/blog/hello/')).toBe('/hello/');
    expect(sub.toRelative('https://example.com/shop/')).toBe('https://example.com/shop/');
    expect(sub.toPath('https://example.com/blog/hello/')).toBe('/hello/');
  });

  it('can be disabled, but paths are always relative', () => {
    const off = new UrlRewriter(new URL('https://cms.example.com/'), false);
    expect(off.toRelative('https://cms.example.com/about/')).toBe('https://cms.example.com/about/');
    expect(off.toPath('https://cms.example.com/about/')).toBe('/about/');
  });
});
