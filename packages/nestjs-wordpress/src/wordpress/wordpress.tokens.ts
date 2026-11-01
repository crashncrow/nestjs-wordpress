/**
 * Internal token for `ResolvedWordPressOptions`.
 *
 * It lives in its own file (not in wordpress.module-definition.ts) to avoid an import cycle:
 * the module definition imports the webhook controller, whose guard needs this token. In ESM a
 * cycle leaves one side reading `undefined` at load time, which Nest reports as an unresolvable
 * dependency.
 */
export const WORDPRESS_RESOLVED_OPTIONS = Symbol('WORDPRESS_RESOLVED_OPTIONS');
