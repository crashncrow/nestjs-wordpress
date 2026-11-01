import type { PostCardProps } from '@/components/post-card';
import type { Post } from './types';

/** Full post DTO → the few fields a card needs (prefers the `medium` rendition). */
export function toCard(post: Post): PostCardProps {
  return {
    title: post.title,
    path: post.path,
    excerpt: post.excerpt,
    date: post.date,
    imageUrl: post.featuredImage?.sizes.medium?.url ?? post.featuredImage?.url ?? null,
  };
}
