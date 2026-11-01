import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Pagination } from '@/components/pagination';
import { PostCard } from '@/components/post-card';
import { Skeleton } from '@/components/skeleton';
import { getPosts } from '@/lib/api';
import { toCard } from '@/lib/cards';

async function PostList({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const posts = await getPosts(page);
  if (!posts) notFound();

  return (
    <>
      <div className="grid">
        {posts.items.map((post) => (
          <PostCard key={post.id} {...toCard(post)} />
        ))}
      </div>
      <Pagination page={page} totalPages={posts.totalPages} basePath="/blog/" />
    </>
  );
}

export default function BlogPage({ searchParams }: PageProps<'/blog'>) {
  return (
    <>
      <h1>Blog</h1>
      {/* searchParams is runtime data: it must be read inside a Suspense boundary. */}
      <Suspense fallback={<Skeleton lines={6} />}>
        <PostList searchParams={searchParams as Promise<{ page?: string }>} />
      </Suspense>
    </>
  );
}
