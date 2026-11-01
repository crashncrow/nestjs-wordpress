/**
 * Tiny, dependency-free HTML helpers for the few transformations the normalizers need.
 * They are not general-purpose HTML parsers: WordPress output is well-formed enough for
 * entity decoding, tag stripping and attribute rewriting with regular expressions.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
};

/** Decodes the entities WordPress emits (`wptexturize` mostly uses numeric ones like `&#8217;`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint =
        entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) || codePoint > 0x10ffff
        ? match
        : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function stripTags(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ');
}

/** Rendered title → plain text. */
export function toPlainText(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

/**
 * Rendered excerpt → plain text without the "read more" decorations WordPress appends
 * to auto-generated excerpts (`[&hellip;]`, `Continue reading ...` links).
 */
export function cleanExcerpt(html: string): string {
  const withoutMore = html
    .replace(/<a[^>]*class="[^"]*more-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/\s*\[(?:&hellip;|&#8230;|…|\.\.\.)\]\s*/g, '…');
  return toPlainText(withoutMore);
}
