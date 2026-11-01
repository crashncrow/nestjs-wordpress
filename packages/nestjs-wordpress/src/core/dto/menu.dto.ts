export interface MenuItem {
  id: number;
  /** Plain text label. */
  title: string;
  /** Site-relative path for internal links, absolute URL for external ones. */
  url: string;
  /** `_blank` etc., or `null` when the link opens in the same window. */
  target: string | null;
  /** What the item points to: an entry, a term archive or a custom URL. */
  kind: 'entry' | 'term' | 'custom';
  /** Type or taxonomy name of the linked object (`page`, `category`, ...), `null` for custom links. */
  object: string | null;
  objectId: number | null;
  children: MenuItem[];
}

export interface Menu {
  id: number;
  name: string;
  slug: string;
  /** Top-level items; nested items live in `children`. */
  items: MenuItem[];
}
