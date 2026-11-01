import Link from 'next/link';
import { connection } from 'next/server';
import { getPrimaryMenu } from '@/lib/api';
import type { MenuItem } from '@/lib/types';

/** Internal links are site-relative paths (the library rewrites them); external ones are absolute. */
function MenuLink({ item }: { item: MenuItem }) {
  return item.url.startsWith('/') ? (
    <Link href={item.url}>{item.title}</Link>
  ) : (
    <a href={item.url} target={item.target ?? undefined} rel="noreferrer">
      {item.title}
    </a>
  );
}

function MenuList({ items, className }: { items: MenuItem[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item.id}>
          <MenuLink item={item} />
          {item.children.length > 0 && <MenuList items={item.children} className="submenu" />}
        </li>
      ))}
    </ul>
  );
}

export async function Nav() {
  // connection() defers this read to request time, so `next build` never calls the API
  // (the build runs in CI without a backend). The read itself is still cached.
  await connection();
  const menu = await getPrimaryMenu();
  return <nav className="nav">{menu && <MenuList items={menu.items} />}</nav>;
}
