import type { Menu, MenuItem } from '../../core/dto/index.js';
import { toPlainText } from './html.js';
import type { NormalizeContext } from './normalize-context.js';
import type { RawMenu, RawMenuItem } from './raw-types.js';

/**
 * WordPress returns menu items as a flat list with `parent` IDs; consumers almost always
 * render a tree, so it is built here once.
 */
export function normalizeMenu(raw: RawMenu, rawItems: RawMenuItem[], ctx: NormalizeContext): Menu {
  const sorted = rawItems.toSorted((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0));
  const byId = new Map<number, MenuItem>();
  for (const item of sorted) byId.set(item.id, normalizeMenuItem(item, ctx));

  const roots: MenuItem[] = [];
  for (const item of sorted) {
    const node = byId.get(item.id)!;
    const parent = item.parent ? byId.get(item.parent) : undefined;
    // An item whose parent is missing (e.g. trashed) is promoted to the top level.
    (parent ? parent.children : roots).push(node);
  }

  return { id: raw.id, name: toPlainText(raw.name), slug: raw.slug, items: roots };
}

function normalizeMenuItem(raw: RawMenuItem, ctx: NormalizeContext): MenuItem {
  const title = typeof raw.title === 'string' ? raw.title : (raw.title.rendered ?? '');
  const kind = raw.type === 'post_type' ? 'entry' : raw.type === 'taxonomy' ? 'term' : 'custom';
  return {
    id: raw.id,
    title: toPlainText(title),
    url: ctx.urls.toRelative(raw.url ?? ''),
    target: raw.target ? raw.target : null,
    kind,
    object: kind === 'custom' ? null : (raw.object ?? null),
    objectId: kind === 'custom' ? null : (raw.object_id ?? null),
    children: [],
  };
}
