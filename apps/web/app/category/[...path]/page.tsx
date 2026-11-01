import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Pagination } from '@/components/pagination';
import { PostCard } from '@/components/post-card';
import { Skeleton } from '@/components/skeleton';
import { getCategory, getPosts } from '@/lib/api';
import { toCard } from '@/lib/cards';

/** WordPress category archives: /category/news/ and nested /category/tutorials/nestjs/. */
async function CategoryArchive({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const slug = (await params).path.at(-1) ?? '';
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const [category, posts] = await Promise.all([getCategory(slug), getPosts(page, slug)]);
  if (!category || !posts) notFound();

  return (
    <>
      <h1>{category.name}</h1>
      {category.description && <p className="meta">{category.description}</p>}
      <div className="grid">
        {posts.items.map((post) => (
          <PostCard key={post.id} {...toCard(post)} />
        ))}
      </div>
      <Pagination page={page} totalPages={posts.totalPages} basePath={category.path} />
    </>
  );
}

export default function CategoryPage({ params, searchParams }: PageProps<'/category/[...path]'>) {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <CategoryArchive params={params} searchParams={searchParams as Promise<{ page?: string }>} />
    </Suspense>
  );
}
