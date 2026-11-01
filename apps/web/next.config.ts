import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cache Components: data is cached with 'use cache' + cacheTag and invalidated by tag,
  // which maps 1:1 onto the tags nestjs-wordpress already uses.
  cacheComponents: true,
  // WordPress permalinks end with a slash (/about/team/). Matching that keeps every link the
  // BFF returns valid as-is, without 308 redirects.
  trailingSlash: true,
};

export default nextConfig;
