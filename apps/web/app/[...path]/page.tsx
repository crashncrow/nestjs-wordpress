import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/skeleton';
import { resolvePath } from '@/lib/api';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * Catch-all for WordPress permalinks: /about/team/leadership/ (page) or /demo-post-3/ (post).
 * Params are not known at build time (no generateStaticParams), so they are runtime data and
 * the content streams in behind a Suspense fallback; the result is cached per path.
 */
async function EntryContent({ params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.map(decodeURIComponent).join('/');
  const entry = await resolvePath(path);
  if (!entry) notFound();

  return (
    <article>
      <h1>{entry.title}</h1>
      {entry.type === 'post' && (
        <p className="meta">
          {dateFormat.format(new Date(entry.date))}
          {entry.author && <> · {entry.author.name}</>}
        </p>
      )}
      {entry.featuredImage && (
        <img className="featured" src={entry.featuredImage.url} alt={entry.featuredImage.alt} />
      )}
      {/* Content comes from trusted CMS editors, rendered by WordPress. */}
      <div dangerouslySetInnerHTML={{ __html: entry.content }} />
      {Object.values(entry.terms).flat().length > 0 && (
        <ul className="chips">
          {Object.values(entry.terms)
            .flat()
            .map((term) => (
              <li key={`${term.taxonomy}:${term.id}`}>
                <Link href={term.path}>{term.name}</Link>
              </li>
            ))}
        </ul>
      )}
    </article>
  );
}

export default function EntryPage({ params }: PageProps<'/[...path]'>) {
  return (
    <Suspense fallback={<Skeleton lines={8} />}>
      <EntryContent params={params} />
    </Suspense>
  );
}
