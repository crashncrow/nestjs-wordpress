import { describe, expect, it } from 'vitest';
import {
  cleanExcerpt,
  decodeEntities,
  stripTags,
  toPlainText,
} from '../../src/wordpress/normalizers/html.js';

describe('html helpers', () => {
  it('decodes numeric, hex and named entities', () => {
    expect(decodeEntities('It&#8217;s &amp; &#x2014; &hellip; &unknown;')).toBe(
      'It’s & — … &unknown;',
    );
  });

  it('turns rendered titles into plain text', () => {
    expect(toPlainText('Hello <em>world</em> &#8211; again')).toBe('Hello world – again');
  });

  it('never leaves a tag assembled from the leftovers of removed ones', () => {
    for (const input of [
      '<<b>script>alert(1)<</b>/script>',
      '<scr<!-- x -->ipt>',
      '<!<!-- a -->-- b -->c',
    ]) {
      expect(stripTags(input)).not.toMatch(/<[a-z!/]/i);
    }
  });

  it('removes WordPress "read more" decorations from excerpts', () => {
    expect(cleanExcerpt('<p>Some text [&hellip;]</p>\n')).toBe('Some text…');
    expect(
      cleanExcerpt(
        '<p>Intro</p> <a href="/x/" class="more-link">Continue reading <span>X</span></a>',
      ),
    ).toBe('Intro');
  });
});
