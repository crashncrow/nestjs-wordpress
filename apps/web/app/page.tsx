import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { PostCard } from '@/components/post-card';
import { Skeleton } from '@/components/skeleton';
import { getHome } from '@/lib/api';

/** One request to the BFF's /home aggregate feeds the whole page. */
async function HomeContent() {
  await connection(); // read at request time, never during `next build`
  const home = await getHome();
  if (!home) notFound();

  return (
    <>
      <section className="hero">
        <h1>{home.hero.title}</h1>
        {/* Content comes from trusted CMS editors, rendered by WordPress. */}
        <div dangerouslySetInnerHTML={{ __html: home.hero.html }} />
      </section>

      <h2>Latest posts</h2>
      <div className="grid">
        {home.latestPosts.map((post) => (
          <PostCard key={post.path} {...post} />
        ))}
      </div>
      <p>
        <Link href="/blog/">All posts →</Link>
      </p>

      <h2>Categories</h2>
      <ul className="chips">
        {home.categories.map((category) => (
          <li key={category.path}>
            <Link href={category.path}>
              {category.name} <span className="meta">({category.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <HomeContent />
    </Suspense>
  );
}
