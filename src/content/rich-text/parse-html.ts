/**
 * HTML → unified rich-node AST parser.
 *
 * Handles AniList review bodies, synopsis/description HTML, and any
 * other provider HTML content.  Uses htmlparser2 (already a dependency).
 */

import { parseDocument } from 'htmlparser2';
import type { ChildNode, Element as HtmlElement, DataNode } from 'domhandler';
import type {
  RichNode,
  RichRootNode,
  RichInlineNode,
  RichBlockNode,
} from './types';
import { txt, para, root } from './types';
import { normalizeInputWhitespace, normalizeAst } from './normalize';
import { parseInlineText } from './parse-inline-text';

// ---------------------------------------------------------------------------
// Resolve img src
// ---------------------------------------------------------------------------

const ANILIST_ORIGIN = 'https://anilist.co';
const ANILIST_CDN = 'https://s4.anilist.co';

function resolveImageSrc(src: string | undefined): string | null {
  if (!src?.trim()) return null;
  const s = src.trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('http://')) return s.replace(/^http:\/\//i, 'https://');
  if (s.startsWith('https://')) return s;
  if (s.startsWith('/')) {
    const path = s.slice(1);
    if (path.startsWith('file/') || path.includes('anilistcdn')) {
      return `${ANILIST_CDN}/${path}`;
    }
    return `${ANILIST_ORIGIN}/${path}`;
  }
  return `${ANILIST_ORIGIN}/${s.replace(/^\//, '')}`;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ParseHtmlOptions {
  /** When true, <pre> becomes preformatted (preserves line breaks, no code-editor UI). Used for AniList reviews. */
  preAsPreformatted?: boolean;
}

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------

function convertNode(node: ChildNode, options?: ParseHtmlOptions): RichNode[] {
  if (node.type === 'text') {
    const text = (node as DataNode).data ?? '';
    if (!text.trim() && !text.includes('\n')) return text ? [txt(text)] : [];
    return [txt(text)];
  }

  if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') {
    return [];
  }

  // Skip script/style entirely
  if (node.type === 'script' || node.type === 'style') return [];

  const el = node as HtmlElement;
  const tag = el.name?.toLowerCase();
  const children = el.children ?? [];
  const childNodes = (): RichNode[] => children.flatMap((c) => convertNode(c, options));
  const inlineChildren = (): RichInlineNode[] => flatInline(childNodes());

  switch (tag) {
    case 'h1':
      return [{ type: 'heading', level: 1, children: inlineChildren() }];
    case 'h2':
      return [{ type: 'heading', level: 2, children: inlineChildren() }];
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return [{ type: 'heading', level: 3, children: inlineChildren() }];

    case 'p':
      return [para(...inlineChildren())];

    case 'br':
      return [{ type: 'lineBreak' }];

    case 'strong':
    case 'b':
      return [{ type: 'strong', children: inlineChildren() }];

    case 'em':
    case 'i':
      return [{ type: 'emphasis', children: inlineChildren() }];

    case 'u':
    case 'ins':
      return [{ type: 'underline', children: inlineChildren() }];

    case 'a': {
      const href = el.attribs?.href?.trim();
      if (!href) return inlineChildren();
      return [{ type: 'link', href, children: inlineChildren() }];
    }

    case 'img': {
      const src = resolveImageSrc(el.attribs?.src ?? el.attribs?.['data-src']);
      if (!src) return [];
      return [{ type: 'image', src, alt: el.attribs?.alt }];
    }

    case 'ul':
      return [{ type: 'list', ordered: false, children: extractListItems(children, options) }];
    case 'ol':
      return [{ type: 'list', ordered: true, children: extractListItems(children, options) }];
    case 'li':
      return [{ type: 'listItem', children: childNodes() }];

    case 'blockquote':
      return [{ type: 'quote', children: wrapInBlocks(childNodes()) }];

    case 'code': {
      const t = textContent(el);
      return [{ type: 'codeSpan', text: t }];
    }
    case 'pre': {
      const t = textContent(el);
      if (options?.preAsPreformatted) {
        return [{ type: 'preformatted', text: t }];
      }
      return [{ type: 'codeBlock', text: t }];
    }

    // Layout / wrapper tags — flatten
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'aside':
    case 'header':
    case 'footer':
    case 'nav':
    case 'figure':
    case 'figcaption':
    case 'center': {
      const inner = childNodes();
      // If all inline, wrap in paragraph; otherwise return blocks
      if (inner.length === 0) return [];
      if (inner.every(isInlineish)) return [para(...flatInline(inner))];
      return inner;
    }

    case 'span': {
      const style = el.attribs?.style ?? '';
      const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
      if (colorMatch) {
        return [{ type: 'color', color: colorMatch[1].trim(), children: inlineChildren() }];
      }
      return inlineChildren();
    }

    case 'hr':
      return [{ type: 'lineBreak' }];

    default:
      return childNodes();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInlineish(n: RichNode): boolean {
  const types = ['text', 'lineBreak', 'strong', 'emphasis', 'underline', 'link', 'image', 'codeSpan', 'color'];
  return types.includes(n.type);
}

function flatInline(nodes: RichNode[]): RichInlineNode[] {
  return nodes.flatMap((n): RichInlineNode[] => {
    if (n.type === 'paragraph') return (n as any).children ?? [];
    if (n.type === 'block') return (n as any).children ?? [];
    if (isInlineish(n)) return [n as RichInlineNode];
    // Non-inline node inside inline context — extract text
    return [txt(textContent(n as any))];
  });
}

function wrapInBlocks(nodes: RichNode[]): RichBlockNode[] {
  const blocks: RichBlockNode[] = [];
  let buf: RichInlineNode[] = [];

  function flush() {
    if (buf.length > 0) {
      blocks.push(para(...buf));
      buf = [];
    }
  }

  for (const n of nodes) {
    if (isInlineish(n)) {
      buf.push(n as RichInlineNode);
    } else {
      flush();
      blocks.push(n as RichBlockNode);
    }
  }
  flush();
  return blocks;
}

function textContent(el: HtmlElement | ChildNode): string {
  if (!el) return '';
  if ((el as DataNode).data != null) return (el as DataNode).data;
  if ('children' in el && Array.isArray(el.children)) {
    return el.children.map((c) => textContent(c as ChildNode)).join('');
  }
  return '';
}

function extractListItems(children: ChildNode[], options?: ParseHtmlOptions): any[] {
  return children.flatMap((c) => {
    if (c.type === 'tag' && (c as HtmlElement).name === 'li') {
      return [{ type: 'listItem', children: (c as HtmlElement).children.flatMap((ch) => convertNode(ch, options)) }];
    }
    return [];
  });
}

/** Recursively apply inline text parsing to text nodes for URL/markdown detection.
 *  Skips link/image nodes (their content is already resolved). */
function postProcessInlineText(nodes: RichNode[]): RichNode[] {
  return nodes.map((n) => {
    if (n.type === 'link' || n.type === 'image') return n;
    if (n.type === 'text') {
      const parsed = parseInlineText(n.text);
      if (parsed.length === 1 && parsed[0].type === 'text') return n;
      return parsed.length === 1 ? parsed[0] : { type: 'block', children: parsed } as any;
    }
    if ('children' in n && Array.isArray((n as any).children)) {
      const withChildren = n as RichNode & { children: RichNode[] };
      withChildren.children = postProcessInlineText(withChildren.children) as any;
    }
    return n;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseHtml(rawHtml: string, options?: ParseHtmlOptions): RichRootNode {
  if (!rawHtml || typeof rawHtml !== 'string') return root();

  const input = normalizeInputWhitespace(rawHtml);
  const doc = parseDocument(input);
  const children = doc.children.flatMap((c) => convertNode(c, options));
  const tree = root(...postProcessInlineText(children));
  return normalizeAst(tree);
}

/**
 * Parse synopsis/description HTML preserving structure instead of stripping.
 * Same pipeline as full HTML, just a named entry point for clarity.
 */
export function parseSynopsisHtml(rawHtml: string): RichRootNode {
  return parseHtml(rawHtml);
}
