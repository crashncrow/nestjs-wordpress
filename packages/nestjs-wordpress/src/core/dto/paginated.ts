/** A page of results plus the totals reported by the content source. */
export interface Paginated<T> {
  items: T[];
  /** Total number of items across all pages. */
  total: number;
  totalPages: number;
  /** 1-based page number of `items`. */
  page: number;
  perPage: number;
}
