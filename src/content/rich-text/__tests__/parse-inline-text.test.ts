import { parseInlineText } from '../parse-inline-text';
import type { RichInlineNode } from '../types';

function findType(nodes: RichInlineNode[], type: string): RichInlineNode[] {
  return nodes.filter((n) => n.type === type);
}

function allText(nodes: RichInlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'lineBreak') return '\n';
      if ('children' in n) return allText((n as any).children);
      return '';
    })
    .join('');
}

describe('parseInlineText', () => {
  it('returns text node for plain text', () => {
    const result = parseInlineText('hello world');
    expect(result).toEqual([{ type: 'text', text: 'hello world' }]);
  });

  it('returns empty array for empty string', () => {
    expect(parseInlineText('')).toEqual([]);
  });

  it('detects plain URL and creates link node', () => {
    const result = parseInlineText('visit https://example.com today');
    const links = findType(result, 'link');
    expect(links.length).toBe(1);
    expect((links[0] as any).href).toBe('https://example.com');
  });

  it('detects standalone image URL and creates image node', () => {
    const result = parseInlineText('https://example.com/photo.jpg');
    const images = findType(result, 'image');
    expect(images.length).toBe(1);
    expect((images[0] as any).src).toBe('https://example.com/photo.jpg');
  });

  it('converts embedded image URL to link when touching text', () => {
    const result = parseInlineText('see:https://example.com/photo.jpg!');
    const images = findType(result, 'image');
    const links = findType(result, 'link');
    expect(images.length).toBe(0);
    expect(links.length).toBe(1);
  });

  it('converts space-separated image URL to image node', () => {
    const result = parseInlineText('check out https://example.com/photo.jpg here');
    const images = findType(result, 'image');
    expect(images.length).toBe(1);
  });

  it('detects markdown link [text](url)', () => {
    const result = parseInlineText('click [here](https://example.com) please');
    const links = findType(result, 'link');
    expect(links.length).toBe(1);
    expect((links[0] as any).href).toBe('https://example.com');
    expect(allText((links[0] as any).children)).toBe('here');
  });

  it('detects **bold** markdown', () => {
    const result = parseInlineText('this is **bold** text');
    const strong = findType(result, 'strong');
    expect(strong.length).toBe(1);
    expect(allText((strong[0] as any).children)).toBe('bold');
  });

  it('detects *italic* markdown', () => {
    const result = parseInlineText('this is *italic* text');
    const em = findType(result, 'emphasis');
    expect(em.length).toBe(1);
    expect(allText((em[0] as any).children)).toBe('italic');
  });

  it('detects __italic__ markdown', () => {
    const result = parseInlineText('this is __italic__ text');
    const em = findType(result, 'emphasis');
    expect(em.length).toBe(1);
    expect(allText((em[0] as any).children)).toBe('italic');
  });

  it('handles mixed markdown and URLs', () => {
    const result = parseInlineText('**bold** and https://example.com');
    const strong = findType(result, 'strong');
    const links = findType(result, 'link');
    expect(strong.length).toBe(1);
    expect(links.length).toBe(1);
  });

  it('preserves text around patterns', () => {
    const result = parseInlineText('before **bold** after');
    const text = allText(result);
    expect(text).toContain('before');
    expect(text).toContain('bold');
    expect(text).toContain('after');
  });

  it('handles newlines', () => {
    const result = parseInlineText('line one\nline two');
    const breaks = findType(result, 'lineBreak');
    expect(breaks.length).toBeGreaterThanOrEqual(1);
  });

  it('supports multiple image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
      const result = parseInlineText(`https://example.com/img.${ext}`);
      const images = findType(result, 'image');
      expect(images.length).toBe(1);
    }
  });

  it('handles image URL with query string', () => {
    const result = parseInlineText('https://example.com/img.png?w=200&h=100');
    const images = findType(result, 'image');
    expect(images.length).toBe(1);
  });
});
