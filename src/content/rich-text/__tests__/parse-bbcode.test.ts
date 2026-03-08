import { parseBBCode } from '../parse-bbcode';
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

describe('parseBBCode', () => {
  it('returns empty root for empty input', () => {
    expect(parseBBCode('')).toEqual({ type: 'root', children: [] });
  });

  it('parses [b]bold[/b]', () => {
    const ast = parseBBCode('[b]bold text[/b]');
    const strong = findNodes(ast, 'strong');
    expect(strong.length).toBeGreaterThanOrEqual(1);
    expect(allText(ast)).toContain('bold text');
  });

  it('parses [i]italic[/i]', () => {
    const ast = parseBBCode('[i]italic text[/i]');
    const em = findNodes(ast, 'emphasis');
    expect(em.length).toBeGreaterThanOrEqual(1);
    expect(allText(ast)).toContain('italic text');
  });

  it('parses [u]underline[/u]', () => {
    const ast = parseBBCode('[u]underlined[/u]');
    const u = findNodes(ast, 'underline');
    expect(u.length).toBeGreaterThanOrEqual(1);
  });

  it('parses [url]https://example.com[/url]', () => {
    const ast = parseBBCode('[url]https://example.com[/url]');
    const links = findNodes(ast, 'link');
    expect(links.length).toBe(1);
    expect((links[0] as any).href).toBe('https://example.com');
  });

  it('parses [url=https://example.com]link text[/url]', () => {
    const ast = parseBBCode('[url=https://example.com]click here[/url]');
    const links = findNodes(ast, 'link');
    expect(links.length).toBe(1);
    expect((links[0] as any).href).toBe('https://example.com');
    expect(allText(ast)).toContain('click here');
  });

  it('parses [img]...[/img]', () => {
    const ast = parseBBCode('[img]https://example.com/image.jpg[/img]');
    const imgs = findNodes(ast, 'image');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as any).src).toBe('https://example.com/image.jpg');
  });

  it('parses [quote]...[/quote]', () => {
    const ast = parseBBCode('[quote]some quoted text[/quote]');
    const quotes = findNodes(ast, 'quote');
    expect(quotes.length).toBe(1);
    expect(allText(ast)).toContain('some quoted text');
  });

  it('parses [quote=Author]...[/quote] with attribution', () => {
    const ast = parseBBCode('[quote=John]hello[/quote]');
    const quotes = findNodes(ast, 'quote');
    expect(quotes.length).toBe(1);
    expect((quotes[0] as any).attribution).toBe('John');
  });

  it('parses [color=red]...[/color]', () => {
    const ast = parseBBCode('[color=red]red text[/color]');
    const colors = findNodes(ast, 'color');
    expect(colors.length).toBe(1);
    expect((colors[0] as any).color).toBe('red');
  });

  it('parses [spoiler]...[/spoiler]', () => {
    const ast = parseBBCode('[spoiler]hidden content[/spoiler]');
    const spoilers = findNodes(ast, 'spoiler');
    expect(spoilers.length).toBe(1);
  });

  it('parses [list] with [*] items', () => {
    const ast = parseBBCode('[list][*]one[*]two[*]three[/list]');
    const lists = findNodes(ast, 'list');
    expect(lists.length).toBe(1);
    const items = findNodes(ast, 'listItem');
    expect(items.length).toBe(3);
  });

  it('parses [code]...[/code]', () => {
    const ast = parseBBCode('[code]const x = 1;[/code]');
    const code = findNodes(ast, 'codeBlock');
    expect(code.length).toBe(1);
    expect((code[0] as any).text).toBe('const x = 1;');
  });

  it('degrades gracefully on malformed BBCode', () => {
    const ast = parseBBCode('[b]unclosed bold [i]and italic');
    expect(ast.type).toBe('root');
    expect(allText(ast)).toContain('unclosed bold');
    expect(allText(ast)).toContain('and italic');
  });

  it('handles unknown tags by flattening', () => {
    const ast = parseBBCode('[unknown]content[/unknown]');
    expect(allText(ast)).toContain('content');
  });

  it('handles nested BBCode', () => {
    const ast = parseBBCode('[b][i]bold italic[/i][/b]');
    const strong = findNodes(ast, 'strong');
    expect(strong.length).toBeGreaterThanOrEqual(1);
    const em = findNodes(ast, 'emphasis');
    expect(em.length).toBeGreaterThanOrEqual(1);
  });

  it('handles HTML entities in BBCode', () => {
    const ast = parseBBCode('He said &ldquo;hello&rdquo; &amp; goodbye');
    const text = allText(ast);
    expect(text).toContain('\u201C');
    expect(text).toContain('\u201D');
    expect(text).toContain('&');
  });

  it('does not crash on empty string', () => {
    expect(() => parseBBCode('')).not.toThrow();
  });

  it('does not crash on null-ish input', () => {
    expect(() => parseBBCode(null as any)).not.toThrow();
    expect(() => parseBBCode(undefined as any)).not.toThrow();
  });

  it('[size=...] degrades gracefully (renders children)', () => {
    const ast = parseBBCode('[size=24]big text[/size]');
    expect(allText(ast)).toContain('big text');
  });

  it('[center] content is preserved', () => {
    const ast = parseBBCode('[center]centered text[/center]');
    expect(allText(ast)).toContain('centered text');
  });
});
