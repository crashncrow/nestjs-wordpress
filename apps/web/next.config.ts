import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cache Components: data is cached with 'use cache' + cacheTag and invalidated by tag,
  // which maps 1:1 onto the tags nestjs-wordpress already uses.
  cacheComponents: true,
  cacheLife: {
    /**
     * Content pushed by webhooks: server-side entries can live long (a webhook revalidates
     * them), but `stale` also sets how long the *browser's* router cache reuses a page
     * without asking the server, and revalidateTag from a Route Handler does not clear that
     * client cache. Built-in profiles use 5 minutes, which made the prefetched home page look
     * outdated after an edit; 30 seconds is the minimum Next.js allows.
     */
    cms: {
      stale: 30,
      revalidate: 60 * 60 * 24, // background refresh once a day, as a safety net
      expire: 60 * 60 * 24 * 7,
    },
  },
  // WordPress permalinks end with a slash (/about/team/). Matching that keeps every link the
  // BFF returns valid as-is, without 308 redirects.
  trailingSlash: true,
};

export default nextConfig;
