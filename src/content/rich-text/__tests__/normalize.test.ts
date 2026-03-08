import {
  decodeEntities,
  decodeEntitiesPass,
  normalizeInputWhitespace,
  normalizeAst,
  isSafeUrl,
} from '../normalize';
import { root, para, txt } from '../types';
import type { RichRootNode } from '../types';

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    expect(decodeEntities('&amp;')).toBe('&');
    expect(decodeEntities('&lt;')).toBe('<');
    expect(decodeEntities('&gt;')).toBe('>');
    expect(decodeEntities('&rsquo;')).toBe('\u2019');
    expect(decodeEntities('&ldquo;')).toBe('\u201C');
    expect(decodeEntities('&rdquo;')).toBe('\u201D');
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('&#39;')).toBe("'");
    expect(decodeEntities('&#169;')).toBe('\u00A9');
  });

  it('decodes hex entities', () => {
    expect(decodeEntities('&#x27;')).toBe("'");
    expect(decodeEntities('&#xA9;')).toBe('\u00A9');
  });

  it('preserves unknown entities', () => {
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });

  it('decodes multiple entities in a string', () => {
    expect(decodeEntities('a &amp; b &lt; c')).toBe('a & b < c');
  });
});

describe('decodeEntitiesPass (includes <br> replacement)', () => {
  it('replaces <br /> in text nodes with newlines', () => {
    const tree = root(para(txt('hello<br />world')));
    decodeEntitiesPass(tree);
    const p = tree.children[0] as any;
    expect(p.children[0].text).toBe('hello\nworld');
  });
});

describe('normalizeInputWhitespace', () => {
  it('converts CRLF to LF', () => {
    expect(normalizeInputWhitespace('a\r\nb')).toBe('a\nb');
  });

  it('converts lone CR to LF', () => {
    expect(normalizeInputWhitespace('a\rb')).toBe('a\nb');
  });

  it('removes null bytes', () => {
    expect(normalizeInputWhitespace('a\0b')).toBe('ab');
  });

  it('replaces literal <br>, <br/>, <br /> with newlines', () => {
    expect(normalizeInputWhitespace('a<br>b')).toBe('a\nb');
    expect(normalizeInputWhitespace('a<br/>b')).toBe('a\nb');
    expect(normalizeInputWhitespace('a<br />b')).toBe('a\nb');
    expect(normalizeInputWhitespace('a<BR />b')).toBe('a\nb');
  });
});

describe('isSafeUrl', () => {
  it('accepts http and https', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('accepts mailto', () => {
    expect(isSafeUrl('mailto:user@example.com')).toBe(true);
  });

  it('rejects javascript:', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data:', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('accepts protocol-relative', () => {
    expect(isSafeUrl('//example.com/img.png')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });
});

describe('normalizeAst', () => {
  it('merges adjacent text nodes', () => {
    const tree = root(para(txt('hello '), txt('world')));
    normalizeAst(tree);
    const p = tree.children[0] as any;
    expect(p.children.length).toBe(1);
    expect(p.children[0].text).toBe('hello world');
  });

  it('removes empty paragraphs', () => {
    const tree = root(para(txt('content')), para(txt('  ')));
    normalizeAst(tree);
    expect(tree.children.length).toBe(1);
  });

  it('decodes entities in text nodes', () => {
    const tree = root(para(txt('&amp; &lt;')));
    normalizeAst(tree);
    const p = tree.children[0] as any;
    expect(p.children[0].text).toContain('&');
    expect(p.children[0].text).toContain('<');
  });

  it('validates URLs — removes unsafe links', () => {
    const tree: RichRootNode = root({
      type: 'link',
      href: 'javascript:alert(1)',
      children: [txt('click')],
    } as any);
    normalizeAst(tree);
    const links = tree.children.filter((c) => c.type === 'link');
    expect(links.length).toBe(0);
  });

  it('does not crash on deeply nested tree', () => {
    let current: any = txt('deep');
    for (let i = 0; i < 50; i++) {
      current = { type: 'strong', children: [current] };
    }
    const tree = root(current);
    expect(() => normalizeAst(tree)).not.toThrow();
  });

  it('handles empty root gracefully', () => {
    const tree = root();
    expect(() => normalizeAst(tree)).not.toThrow();
    expect(tree.children.length).toBe(0);
  });
});
