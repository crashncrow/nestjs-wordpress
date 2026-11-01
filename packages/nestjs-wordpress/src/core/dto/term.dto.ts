export interface Term {
  id: number;
  taxonomy: string;
  slug: string;
  name: string;
  description: string;
  /** Number of published entries using the term. */
  count: number;
  parentId: number | null;
  /** Site-relative path of the term archive. */
  path: string;
}
