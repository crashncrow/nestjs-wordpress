import Link from 'next/link';

export interface PostCardProps {
  title: string;
  path: string;
  excerpt: string;
  date: string;
  imageUrl: string | null;
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

export function PostCard({ title, path, excerpt, date, imageUrl }: PostCardProps) {
  return (
    <article className="card">
      {/* Plain <img>: the WordPress host varies per environment, so next/image would need
          remotePatterns configured for it. Kept simple for the demo. */}
      {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
      <div className="card-body">
        <h3>
          <Link href={path}>{title}</Link>
        </h3>
        <p className="meta">{dateFormat.format(new Date(date))}</p>
        <p>{excerpt}</p>
      </div>
    </article>
  );
}
