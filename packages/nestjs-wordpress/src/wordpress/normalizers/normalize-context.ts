import type { UrlRewriter } from './url-rewriter.js';

/** What normalizers need besides the raw payload. Kept explicit so they stay pure functions. */
export interface NormalizeContext {
  urls: UrlRewriter;
}
