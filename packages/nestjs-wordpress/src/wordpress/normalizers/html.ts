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

/**
 * Removes tags and comments with a single linear scan instead of regular expressions: each tag
 * is skipped up to its `>` (each comment up to its `-->`), or to the end if it never closes.
 * A `<` is never copied to the output, so the result cannot contain markup by construction.
 * Rendered HTML encodes literal `<` in text as `&lt;`, which is decoded afterwards.
 */
export function stripTags(html: string): string {
  let text = '';
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const close = html.indexOf('-->', i + 4);
      i = close === -1 ? html.length : close + 3;
    } else if (html[i] === '<') {
      const close = html.indexOf('>', i + 1);
      i = close === -1 ? html.length : close + 1;
      text += ' '; // tags separate words: `a<br>b` → `a b`
    } else {
      text += html[i];
      i++;
    }
  }
  return text;
}

/**
 * Rendered title → plain text.
 *
 * The result is *text*, not HTML: entities are decoded, so a title stored as `&lt;b&gt;` comes
 * back as `<b>`. Render it as text (React does by default); escape it before inserting it into
 * HTML.
 */
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
