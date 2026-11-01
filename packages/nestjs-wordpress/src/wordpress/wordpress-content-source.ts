import { Inject, Injectable } from '@nestjs/common';
import type {
  ContentSource,
  EntryListQuery,
  EntryLookup,
  MenuLookup,
  ReadOptions,
  TermFilter,
  TermListQuery,
  TermLookup,
} from '../core/content-source.interface.js';
import type { Entry, Menu, Paginated, Term } from '../core/dto/index.js';
import {
  ContentBadRequestException,
  ContentForbiddenException,
  ContentNotFoundException,
  ContentUnauthorizedException,
} from '../core/errors/content-source.exception.js';
import { WordPressHttpClient, type QueryValue } from './http/wordpress-http-client.js';
import { normalizeEntry } from './normalizers/entry.normalizer.js';
import { normalizeMenu } from './normalizers/menu.normalizer.js';
import type { NormalizeContext } from './normalizers/normalize-context.js';
import type {
  RawEntry,
  RawMenu,
  RawMenuItem,
  RawMenuLocation,
  RawTaxonomy,
  RawTerm,
  RawType,
} from './normalizers/raw-types.js';
import { normalizeTerm } from './normalizers/term.normalizer.js';
import { UrlRewriter } from './normalizers/url-rewriter.js';
import type { ResolvedWordPressOptions } from './wordpress-options.interface.js';
import { WORDPRESS_RESOLVED_OPTIONS } from './wordpress.module-definition.js';

/** Only the relations the normalizers use: smaller responses than a bare `_embed`. */
const EMBED = 'author,wp:featuredmedia,wp:term';
const DEFAULT_PER_PAGE = 10;
/** WordPress hard limit for `per_page`. */
const MAX_PER_PAGE = 100;

/** Where a content type or taxonomy lives in the REST API, e.g. `wp/v2/books`. */
type RestRoute = string;

/**
 * Built-in routes are known up front. Anything else (custom post types and taxonomies) is
 * looked up once from `/wp/v2/types` and `/wp/v2/taxonomies`, which also honors a custom
 * `rest_base` / `rest_namespace` set by `register_post_type()`.
 */
const BUILTIN_TYPE_ROUTES: Record<string, RestRoute> = {
  post: 'wp/v2/posts',
  page: 'wp/v2/pages',
  attachment: 'wp/v2/media',
};
const BUILTIN_TAXONOMY_ROUTES: Record<string, RestRoute> = {
  category: 'wp/v2/categories',
  post_tag: 'wp/v2/tags',
};

/** WordPress implementation of {@link ContentSource}, bound to the `CONTENT_SOURCE` token. */
@Injectable()
export class WordPressContentSource implements ContentSource {
  private readonly ctx: NormalizeContext;
  /** Discovery results per endpoint, memoized as promises so concurrent calls share one request. */
  private readonly discovered = new Map<string, Promise<Record<string, RestRoute>>>();

  constructor(
    private readonly http: WordPressHttpClient,
    @Inject(WORDPRESS_RESOLVED_OPTIONS) options: ResolvedWordPressOptions,
  ) {
    this.ctx = { urls: new UrlRewriter(options.baseUrl, options.rewriteUrls) };
  }

  // ---------------------------------------------------------------- entries

  async listEntries(
    type: string,
    query: EntryListQuery = {},
    options: ReadOptions = {},
  ): Promise<Paginated<Entry>> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? DEFAULT_PER_PAGE;
    const route = await this.typeRoute(type);

    const taxonomyParams = await this.taxonomyFilterParams(query.taxonomies);
    // A filter on slugs that match no term must yield no results, not "no filter".
    if (taxonomyParams === null) return emptyPage(page, perPage);

    const response = await this.http.get<RawEntry[]>({
      path: route,
      authenticated: options.preview,
      query: {
        page,
        per_page: perPage,
        search: query.search,
        parent: query.parentId,
        orderby: query.orderBy,
        order: query.order,
        status: options.preview ? 'any' : undefined,
        _embed: EMBED,
        ...taxonomyParams,
      },
    });

    return {
      items: response.data.map((raw) => normalizeEntry(raw, this.ctx)),
      total: response.total ?? response.data.length,
      totalPages: response.totalPages ?? 1,
      page,
      perPage,
    };
  }

  async getEntry(type: string, lookup: EntryLookup, options: ReadOptions = {}): Promise<Entry> {
    const route = await this.typeRoute(type);
    try {
      if ('id' in lookup) {
        const { data } = await this.http.get<RawEntry>({
          path: `${route}/${lookup.id}`,
          authenticated: options.preview,
          query: { _embed: EMBED },
        });
        return normalizeEntry(data, this.ctx);
      }

      const slug = 'slug' in lookup ? lookup.slug : lastSegment(lookup.path);
      const { data } = await this.http.get<RawEntry[]>({
        path: route,
        authenticated: options.preview,
        query: {
          slug,
          // Several hierarchical entries can share a slug under different parents.
          per_page: 'path' in lookup ? MAX_PER_PAGE : 1,
          status: options.preview ? 'any' : undefined,
          _embed: EMBED,
        },
      });

      const entries = data.map((raw) => normalizeEntry(raw, this.ctx));
      const match =
        'path' in lookup ? entries.find((entry) => samePath(entry.path, lookup.path)) : entries[0];
      if (!match) throw new ContentNotFoundException(`No ${type} found for ${describe(lookup)}`);
      return match;
    } catch (error) {
      // Anonymously, WordPress answers 401/403 for drafts and private entries. For a public
      // read that simply means "not found"; only preview reads should surface auth errors.
      if (
        !options.preview &&
        (error instanceof ContentUnauthorizedException ||
          error instanceof ContentForbiddenException)
      ) {
        throw new ContentNotFoundException(`No ${type} found for ${describe(lookup)}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------- terms

  async listTerms(taxonomy: string, query: TermListQuery = {}): Promise<Paginated<Term>> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? DEFAULT_PER_PAGE;
    const route = await this.taxonomyRoute(taxonomy);

    const response = await this.http.get<RawTerm[]>({
      path: route,
      query: {
        page,
        per_page: perPage,
        search: query.search,
        parent: query.parentId,
        hide_empty: query.hideEmpty,
        orderby: query.orderBy,
        order: query.order,
      },
    });

    return {
      items: response.data.map((raw) => normalizeTerm(raw, this.ctx)),
      total: response.total ?? response.data.length,
      totalPages: response.totalPages ?? 1,
      page,
      perPage,
    };
  }

  async getTerm(taxonomy: string, lookup: TermLookup): Promise<Term> {
    const route = await this.taxonomyRoute(taxonomy);
    if ('id' in lookup) {
      const { data } = await this.http.get<RawTerm>({ path: `${route}/${lookup.id}` });
      return normalizeTerm(data, this.ctx);
    }
    const { data } = await this.http.get<RawTerm[]>({
      path: route,
      query: { slug: lookup.slug, per_page: 1 },
    });
    const raw = data[0];
    if (!raw) throw new ContentNotFoundException(`No ${taxonomy} term with slug "${lookup.slug}"`);
    return normalizeTerm(raw, this.ctx);
  }

  // ---------------------------------------------------------------- menus

  async getMenu(lookup: MenuLookup): Promise<Menu> {
    // Core WordPress only exposes menus to users who can edit them (unless a plugin opens
    // them via the `rest_menu_read_access` filter), so send credentials when we have them.
    const authenticated = this.http.canAuthenticate;
    const menuId = 'id' in lookup ? lookup.id : await this.menuIdForLocation(lookup.location);

    const [menu, items] = await Promise.all([
      this.http.get<RawMenu>({ path: `wp/v2/menus/${menuId}`, authenticated }),
      this.allMenuItems(menuId, authenticated),
    ]);
    return normalizeMenu(menu.data, items, this.ctx);
  }

  private async menuIdForLocation(location: string): Promise<number> {
    try {
      const { data } = await this.http.get<RawMenuLocation>({
        path: `wp/v2/menu-locations/${encodeURIComponent(location)}`,
        authenticated: this.http.canAuthenticate,
      });
      if (!data.menu)
        throw new ContentNotFoundException(`No menu assigned to location "${location}"`);
      return data.menu;
    } catch (error) {
      // An unregistered location is a 400 (`rest_menu_location_invalid`) in WordPress.
      if (error instanceof ContentBadRequestException) {
        throw new ContentNotFoundException(`Unknown menu location "${location}"`, { cause: error });
      }
      throw error;
    }
  }

  private async allMenuItems(menuId: number, authenticated: boolean): Promise<RawMenuItem[]> {
    const items: RawMenuItem[] = [];
    for (let page = 1; ; page++) {
      const response = await this.http.get<RawMenuItem[]>({
        path: 'wp/v2/menu-items',
        authenticated,
        query: { menus: menuId, per_page: MAX_PER_PAGE, page, orderby: 'menu_order', order: 'asc' },
      });
      items.push(...response.data);
      if (page >= (response.totalPages ?? 1)) return items;
    }
  }

  // ---------------------------------------------------------------- routing helpers

  private async typeRoute(type: string): Promise<RestRoute> {
    const builtin = BUILTIN_TYPE_ROUTES[type];
    if (builtin) return builtin;
    return routeOrThrow(await this.discover<RawType>('wp/v2/types'), type, 'content type');
  }

  private async taxonomyRoute(taxonomy: string): Promise<RestRoute> {
    const builtin = BUILTIN_TAXONOMY_ROUTES[taxonomy];
    if (builtin) return builtin;
    return routeOrThrow(await this.discover<RawTaxonomy>('wp/v2/taxonomies'), taxonomy, 'taxonomy');
  }

  private discover<T extends { slug: string; rest_base?: unknown; rest_namespace?: unknown }>(
    path: string,
  ): Promise<Record<string, RestRoute>> {
    let pending = this.discovered.get(path);
    if (!pending) {
      pending = this.http.get<Record<string, T>>({ path }).then(({ data }) => {
        const routes: Record<string, RestRoute> = {};
        for (const item of Object.values(data)) {
          if (typeof item.rest_base !== 'string' || !item.rest_base) continue;
          const namespace = typeof item.rest_namespace === 'string' ? item.rest_namespace : 'wp/v2';
          routes[item.slug] = `${namespace}/${item.rest_base}`;
        }
        return routes;
      });
      // Forget failures so a transient error does not poison every later call.
      pending.catch(() => this.discovered.delete(path));
      this.discovered.set(path, pending);
    }
    return pending;
  }

  /**
   * Builds `{ categories: '1,2', genres: '8' }`-style params. Slugs are resolved to IDs because
   * the REST API only filters by ID. Returns `null` when a filter cannot match anything.
   */
  private async taxonomyFilterParams(
    taxonomies: EntryListQuery['taxonomies'],
  ): Promise<Record<string, QueryValue> | null> {
    const params: Record<string, QueryValue> = {};
    for (const [taxonomy, values] of Object.entries(taxonomies ?? {})) {
      if (!values || values.length === 0) continue;
      const route = await this.taxonomyRoute(taxonomy);
      const ids = await this.resolveTermIds(route, values);
      if (ids.length === 0) return null;
      // The filter parameter is the taxonomy's rest_base (`categories`, `tags`, `genres`).
      params[route.slice(route.lastIndexOf('/') + 1)] = ids;
    }
    return params;
  }

  private async resolveTermIds(route: RestRoute, values: TermFilter[]): Promise<number[]> {
    const ids = values.filter((value): value is number => typeof value === 'number');
    const slugs = values.filter((value): value is string => typeof value === 'string');
    if (slugs.length > 0) {
      const { data } = await this.http.get<Pick<RawTerm, 'id'>[]>({
        path: route,
        query: { slug: slugs, per_page: MAX_PER_PAGE, _fields: 'id' },
      });
      ids.push(...data.map((term) => term.id));
    }
    return ids;
  }
}

function routeOrThrow(routes: Record<string, RestRoute>, name: string, kind: string): RestRoute {
  const route = routes[name];
  if (!route) {
    throw new ContentNotFoundException(
      `Unknown ${kind} "${name}" (is it registered with show_in_rest => true?)`,
    );
  }
  return route;
}

function emptyPage<T>(page: number, perPage: number): Paginated<T> {
  return { items: [], total: 0, totalPages: 0, page, perPage };
}

function lastSegment(path: string): string {
  return trimSlashes(path).split('/').pop() ?? '';
}

function samePath(a: string, b: string): boolean {
  return safeDecode(trimSlashes(a)).toLowerCase() === safeDecode(trimSlashes(b)).toLowerCase();
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/** WordPress stores non-ASCII slugs percent-encoded; compare them decoded. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function describe(lookup: EntryLookup): string {
  if ('id' in lookup) return `id ${lookup.id}`;
  if ('slug' in lookup) return `slug "${lookup.slug}"`;
  return `path "${lookup.path}"`;
}
