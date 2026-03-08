import { parseHtml, parseSynopsisHtml } from '../parse-html';
import type { RichRootNode, RichNode } from '../types';

function findNodes(root: RichRootNode, type: string): RichNode[] {
  const results: RichNode[] = [];
  function walk(node: RichNode) {
    if (node.type === type) results.push(node);
    if ('children' in node && Array.isArray((node as any).children)) {
      (node as any).children.forEach(walk);
    }
  }
  root.children.forEach(walk);
  return results;
}

function allText(root: RichRootNode): string {
  const parts: string[] = [];
  function walk(node: RichNode) {
    if (node.type === 'text') parts.push((node as any).text);
    if (node.type === 'lineBreak') parts.push('\n');
    if ('children' in node && Array.isArray((node as any).children)) {
      (node as any).children.forEach(walk);
    }
  }
  root.children.forEach(walk);
  return parts.join('');
}

describe('parseHtml', () => {
  it('returns empty root for empty input', () => {
    expect(parseHtml('')).toEqual({ type: 'root', children: [] });
  });

  it('parses paragraphs', () => {
    const ast = parseHtml('<p>Hello world</p>');
    const paragraphs = findNodes(ast, 'paragraph');
    expect(paragraphs.length).toBe(1);
    expect(allText(ast)).toContain('Hello world');
  });

  it('parses <br> as line break', () => {
    const ast = parseHtml('first<br>second');
    const breaks = findNodes(ast, 'lineBreak');
    expect(breaks.length).toBeGreaterThanOrEqual(1);
  });

  it('parses links', () => {
    const ast = parseHtml('<a href="https://example.com">link</a>');
    const links = findNodes(ast, 'link');
    expect(links.length).toBe(1);
    expect((links[0] as any).href).toBe('https://example.com');
  });

  it('parses images', () => {
    const ast = parseHtml('<img src="https://example.com/img.png">');
    const imgs = findNodes(ast, 'image');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as any).src).toBe('https://example.com/img.png');
  });

  it('parses headings', () => {
    const ast = parseHtml('<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>');
    const headings = findNodes(ast, 'heading');
    expect(headings.length).toBe(3);
    expect((headings[0] as any).level).toBe(1);
    expect((headings[1] as any).level).toBe(2);
    expect((headings[2] as any).level).toBe(3);
  });

  it('parses strong and emphasis', () => {
    const ast = parseHtml('<strong>bold</strong> and <em>italic</em>');
    expect(findNodes(ast, 'strong').length).toBe(1);
    expect(findNodes(ast, 'emphasis').length).toBe(1);
  });

  it('parses <b> and <i> as well', () => {
    const ast = parseHtml('<b>bold</b> <i>italic</i>');
    expect(findNodes(ast, 'strong').length).toBe(1);
    expect(findNodes(ast, 'emphasis').length).toBe(1);
  });

  it('parses blockquote', () => {
    const ast = parseHtml('<blockquote>quoted</blockquote>');
    const quotes = findNodes(ast, 'quote');
    expect(quotes.length).toBe(1);
  });

  it('parses unordered list', () => {
    const ast = parseHtml('<ul><li>one</li><li>two</li></ul>');
    const lists = findNodes(ast, 'list');
    expect(lists.length).toBe(1);
    expect((lists[0] as any).ordered).toBe(false);
    const items = findNodes(ast, 'listItem');
    expect(items.length).toBe(2);
  });

  it('parses ordered list', () => {
    const ast = parseHtml('<ol><li>first</li><li>second</li></ol>');
    const lists = findNodes(ast, 'list');
    expect(lists.length).toBe(1);
    expect((lists[0] as any).ordered).toBe(true);
  });

  it('parses nested inline tags', () => {
    const ast = parseHtml('<p><strong><em>bold italic</em></strong></p>');
    expect(findNodes(ast, 'strong').length).toBe(1);
    expect(findNodes(ast, 'emphasis').length).toBe(1);
    expect(allText(ast)).toContain('bold italic');
  });

  it('flattens unsupported tags safely', () => {
    const ast = parseHtml('<custom-tag>content inside</custom-tag>');
    expect(allText(ast)).toContain('content inside');
  });

  it('handles <center> by flattening', () => {
    const ast = parseHtml('<center>centered content</center>');
    expect(allText(ast)).toContain('centered content');
    // Should not have a "center" node type
    expect(findNodes(ast, 'center' as any).length).toBe(0);
  });

  it('does not crash on malformed HTML', () => {
    expect(() => parseHtml('<p>unclosed')).not.toThrow();
    expect(() => parseHtml('<div><p>bad nesting</div></p>')).not.toThrow();
    expect(() => parseHtml('<<<garbage>>>')).not.toThrow();
  });

  it('resolves relative image src to AniList CDN', () => {
    const ast = parseHtml('<img src="/file/some-image.png">');
    const imgs = findNodes(ast, 'image');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as any).src).toContain('https://');
  });

  it('handles protocol-relative image src', () => {
    const ast = parseHtml('<img src="//s4.anilist.co/file/img.jpg">');
    const imgs = findNodes(ast, 'image');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as any).src).toBe('https://s4.anilist.co/file/img.jpg');
  });

  it('parses code and pre tags', () => {
    const ast = parseHtml('<code>inline code</code>');
    expect(findNodes(ast, 'codeSpan').length).toBe(1);

    const ast2 = parseHtml('<pre>code block</pre>');
    expect(findNodes(ast2, 'codeBlock').length).toBe(1);
  });

  it('parses pre as preformatted when preAsPreformatted option is true', () => {
    const ast = parseHtml('<pre>preserved\nline breaks</pre>', { preAsPreformatted: true });
    const preformatted = findNodes(ast, 'preformatted');
    expect(preformatted.length).toBe(1);
    expect((preformatted[0] as { text: string }).text).toBe('preserved\nline breaks');
  });

  it('parses <u> and <ins> as underline', () => {
    const ast = parseHtml('<u>underline</u> and <ins>insert</ins>');
    expect(findNodes(ast, 'underline').length).toBe(2);
  });

  it('strips script and style tags', () => {
    const ast = parseHtml('<script>alert("xss")</script><p>safe</p><style>.x{}</style>');
    expect(allText(ast)).not.toContain('alert');
    expect(allText(ast)).not.toContain('.x');
    expect(allText(ast)).toContain('safe');
  });

  it('parseSynopsisHtml is an alias that works', () => {
    const ast = parseSynopsisHtml('<p>Synopsis <b>text</b></p>');
    expect(findNodes(ast, 'paragraph').length).toBe(1);
    expect(findNodes(ast, 'strong').length).toBe(1);
  });
});
