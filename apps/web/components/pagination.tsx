import Link from 'next/link';

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? <Link href={`${basePath}?page=${page - 1}`}>← Newer</Link> : <span />}
      <span className="meta">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? <Link href={`${basePath}?page=${page + 1}`}>Older →</Link> : <span />}
    </nav>
  );
}
