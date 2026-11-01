import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <h1>Not found</h1>
      <p>
        That content does not exist in WordPress (or is not published).{' '}
        <Link href="/">Go home</Link>
      </p>
    </>
  );
}
