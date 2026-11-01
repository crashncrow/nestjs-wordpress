import type { Term } from '../../core/dto/index.js';
import { toPlainText } from './html.js';
import type { NormalizeContext } from './normalize-context.js';
import type { RawTerm } from './raw-types.js';

export function normalizeTerm(raw: RawTerm, ctx: NormalizeContext): Term {
  return {
    id: raw.id,
    taxonomy: raw.taxonomy,
    slug: raw.slug,
    name: toPlainText(raw.name),
    description: raw.description ?? '',
    count: raw.count ?? 0,
    parentId: raw.parent ? raw.parent : null,
    path: ctx.urls.toPath(raw.link),
  };
}
