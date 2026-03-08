/**
 * Post-parse normalization / cleanup passes that run on the unified AST.
 *
 * 1. decodeEntities — HTML/numeric entities in text nodes
 * 2. normalizeWhitespace — collapse runs, trim empties
 * 3. mergeAdjacentText — combine consecutive text nodes
 * 4. removeEmptyContainers — prune useless wrappers
 * 5. capNestingDepth — safety valve against pathological nesting
 */

import type {
  RichNode,
  RichRootNode,
  RichInlineNode,
  RichTextNode,
  RichBlockNode,
} from './types';
import { isBlockNode, isInlineNode } from './types';

// ---------------------------------------------------------------------------
// 1. Entity decoding
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: '\u00A0', ndash: '\u2013', mdash: '\u2014',
  rsquo: '\u2019', lsquo: '\u2018',
  rdquo: '\u201D', ldquo: '\u201C',
  hellip: '\u2026', copy: '\u00A9', reg: '\u00AE',
  trade: '\u2122', bull: '\u2022', '#039': "'",
};

function decodeEntity(match: string, hex: string | undefined, dec: string | undefined, named: string | undefined): string {
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  if (dec) return String.fromCodePoint(Number(dec));
  if (named) return NAMED_ENTITIES[named] ?? match;
  return match;
}

const ENTITY_RE = /&(?:#x([0-9a-fA-F]{1,6});|#(\d{1,6});|([a-zA-Z]\w{0,15});)/g;

export function decodeEntities(str: string): string {
  return str.replace(ENTITY_RE, (m, named, dec, hex) => decodeEntity(m, named, dec, hex));
}

// ---------------------------------------------------------------------------
// 2. Pre-parse input normalization (run before parsing)
// ---------------------------------------------------------------------------

/** Replace literal <br>, <br/>, <br /> etc. with newlines. Content often contains these as plain text. */
const BR_TAG_RE = /<br\s*\/?>/gi;

/** Normalize CRLF, sanitize null bytes, and replace literal <br> tags with newlines. */
export function normalizeInputWhitespace(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\0/g, '')
    .replace(BR_TAG_RE, '\n');
}

// ---------------------------------------------------------------------------
// 3. AST passes
// ---------------------------------------------------------------------------

type NodeWithChildren = RichNode & { children?: RichNode[] };

function hasChildren(node: RichNode): node is NodeWithChildren & { children: RichNode[] } {
  return 'children' in node && Array.isArray((node as NodeWithChildren).children);
}

/**
 * Walk every node depth-first, applying `fn` to each. Mutates in place.
 */
function walk(node: RichNode, fn: (n: RichNode) => void): void {
  fn(node);
  if (hasChildren(node)) {
    for (const child of node.children) walk(child, fn);
  }
}

/** Decode entities and replace literal <br> tags with newlines in text nodes (not in code). */
export function decodeEntitiesPass(root: RichRootNode): RichRootNode {
  walk(root, (n) => {
    if (n.type === 'text') {
      const t = n as RichTextNode;
      t.text = decodeEntities(t.text).replace(BR_TAG_RE, '\n');
    }
    if (n.type === 'codeSpan' || n.type === 'codeBlock' || n.type === 'preformatted') {
      (n as { text: string }).text = decodeEntities((n as { text: string }).text);
    }
  });
  return root;
}

/** Collapse runs of whitespace in text nodes (except inside code). */
export function normalizeWhitespacePass(root: RichRootNode): RichRootNode {
  walk(root, (n) => {
    if (n.type === 'text') {
      const t = n as RichTextNode;
      t.text = t.text.replace(/[ \t]+/g, ' ');
    }
  });
  return root;
}

/** Merge consecutive text nodes inside the same parent. */
export function mergeAdjacentTextPass(root: RichRootNode): RichRootNode {
  function merge(children: RichNode[]): RichNode[] {
    const out: RichNode[] = [];
    for (const child of children) {
      if (hasChildren(child)) {
        child.children = merge(child.children) as any;
      }
      const prev = out[out.length - 1];
      if (child.type === 'text' && prev?.type === 'text') {
        (prev as RichTextNode).text += (child as RichTextNode).text;
      } else {
        out.push(child);
      }
    }
    return out;
  }
  root.children = merge(root.children);
  return root;
}

function isEmptyInline(n: RichNode): boolean {
  if (n.type === 'text') return (n as RichTextNode).text.trim() === '';
  if (n.type === 'lineBreak') return false;
  if (n.type === 'image') return false;
  if (hasChildren(n)) return (n as NodeWithChildren).children!.every(isEmptyInline);
  return false;
}

/** Remove paragraphs/blocks that contain only whitespace. */
export function removeEmptyContainersPass(root: RichRootNode): RichRootNode {
  function prune(children: RichNode[]): RichNode[] {
    return children
      .map((child) => {
        if (hasChildren(child)) {
          child.children = prune(child.children) as any;
        }
        return child;
      })
      .filter((child) => {
        if (child.type === 'paragraph' || child.type === 'block') {
          return !isEmptyInline(child);
        }
        return true;
      });
  }
  root.children = prune(root.children);
  return root;
}

const MAX_DEPTH = 20;

/** Flatten children beyond a maximum nesting depth. */
export function capNestingDepthPass(root: RichRootNode): RichRootNode {
  function cap(node: RichNode, depth: number): RichNode {
    if (!hasChildren(node)) return node;
    if (depth >= MAX_DEPTH) {
      return { type: 'text', text: extractTextContent(node) } as RichTextNode;
    }
    const parent = node as NodeWithChildren;
    parent.children = parent.children!.map((c) => cap(c, depth + 1)) as any;
    return node;
  }
  cap(root, 0);
  return root;
}

function extractTextContent(node: RichNode): string {
  if (node.type === 'text') return (node as RichTextNode).text;
  if (node.type === 'lineBreak') return '\n';
  if (node.type === 'image') return '';
  if (hasChildren(node)) return (node as NodeWithChildren).children!.map(extractTextContent).join('');
  return '';
}

// ---------------------------------------------------------------------------
// Validate URLs
// ---------------------------------------------------------------------------

const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return true;
  try {
    const u = new URL(trimmed);
    return SAFE_SCHEMES.includes(u.protocol);
  } catch {
    return /^\/[^/]/.test(trimmed);
  }
}

/** Validate link/image URLs; drop or convert unsafe ones. */
export function validateUrlsPass(root: RichRootNode): RichRootNode {
  function fix(children: RichNode[]): RichNode[] {
    return children.flatMap((child): RichNode[] => {
      if (child.type === 'link') {
        if (!isSafeUrl(child.href)) {
          return (child.children as RichNode[]) ?? [];
        }
      }
      if (child.type === 'image') {
        if (!isSafeUrl(child.src)) return [];
      }
      if (hasChildren(child)) {
        (child as NodeWithChildren).children = fix(
          (child as NodeWithChildren).children!,
        ) as any;
      }
      return [child];
    });
  }
  root.children = fix(root.children);
  return root;
}

// ---------------------------------------------------------------------------
// Convenience: run all post-parse passes in order
// ---------------------------------------------------------------------------

export function normalizeAst(root: RichRootNode): RichRootNode {
  decodeEntitiesPass(root);
  normalizeWhitespacePass(root);
  mergeAdjacentTextPass(root);
  removeEmptyContainersPass(root);
  validateUrlsPass(root);
  capNestingDepthPass(root);
  return root;
}
