/**
 * Raw WordPress REST shapes, based on `wp-types` (a devDependency).
 *
 * These types never appear in the public API: everything leaving the adapter is a
 * normalized DTO. That keeps `wp-types` out of the published `.d.ts` files and lets
 * WordPress change its JSON without breaking consumers.
 */
import type {
  WP_REST_API_Attachment,
  WP_REST_API_Menu,
  WP_REST_API_Menu_Item,
  WP_REST_API_Menu_Location,
  WP_REST_API_Post,
  WP_REST_API_Taxonomy,
  WP_REST_API_Term,
  WP_REST_API_Type,
  WP_REST_API_User,
} from 'wp-types';

/** A post, page or custom post type entry. Pages add `parent` and `menu_order`. */
export type RawEntry = WP_REST_API_Post & { parent?: number; menu_order?: number };
export type RawMedia = WP_REST_API_Attachment;
export type RawUser = WP_REST_API_User;
export type RawTerm = WP_REST_API_Term;
export type RawMenu = WP_REST_API_Menu;
export type RawMenuItem = WP_REST_API_Menu_Item;
export type RawMenuLocation = WP_REST_API_Menu_Location;
export type RawType = WP_REST_API_Type;
export type RawTaxonomy = WP_REST_API_Taxonomy;
