/**
 * BBCode → unified rich-node AST parser.
 *
 * Handles MAL forum post bodies. Gracefully degrades on malformed input.
 */

import type {
  RichNode,
  RichRootNode,
  RichInlineNode,
  RichBlockNode,
} from './types';
import { txt, para, root } from './types';
import { normalizeInputWhitespace, decodeEntities, normalizeAst } from './normalize';
import { parseInlineText } from './parse-inline-text';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

interface BBOpenTag {
  kind: 'open';
  tag: string;
  param?: string;
  raw: string;
}

interface BBCloseTag {
  kind: 'close';
  tag: string;
  raw: string;
}

interface BBTextToken {
  kind: 'text';
  text: string;
}

type BBToken = BBOpenTag | BBCloseTag | BBTextToken;

const TAG_RE = /\[(\/?)([\w*#]+)(?:=([^\]]*))?\]/g;

function tokenize(input: string): BBToken[] {
  const tokens: BBToken[] = [];
  let last = 0;

  for (const m of input.matchAll(TAG_RE)) {
    if (m.index! > last) {
      tokens.push({ kind: 'text', text: input.slice(last, m.index!) });
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (closing) {
      tokens.push({ kind: 'close', tag, raw: m[0] });
    } else {
      tokens.push({ kind: 'open', tag, param: m[3], raw: m[0] });
    }
    last = m.index! + m[0].length;
  }
  if (last < input.length) {
    tokens.push({ kind: 'text', text: input.slice(last) });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Supported tags
// ---------------------------------------------------------------------------

const SELF_CLOSING = new Set(['*', 'br', 'hr']);
const KNOWN_TAGS = new Set([
  'b', 'i', 'u', 's', 'url', 'img', 'quote', 'color', 'size',
  'spoiler', 'list', '*', 'code', 'br', 'hr', 'center',
]);

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

interface BuildCtx {
  tokens: BBToken[];
  pos: number;
}

function buildNodes(ctx: BuildCtx, until?: string): RichNode[] {
  const nodes: RichNode[] = [];

  while (ctx.pos < ctx.tokens.length) {
    const tok = ctx.tokens[ctx.pos];

    if (tok.kind === 'close') {
      if (until && tok.tag === until) {
        ctx.pos++;
        break;
      }
      // Unmatched close tag — emit as text and skip
      nodes.push(txt(tok.raw));
      ctx.pos++;
      continue;
    }

    if (tok.kind === 'text') {
      nodes.push(...textToNodes(tok.text));
      ctx.pos++;
      continue;
    }

    // Open tag
    const { tag, param } = tok;

    if (!KNOWN_TAGS.has(tag)) {
      // Unknown tag — flatten as text
      nodes.push(txt(tok.raw));
      ctx.pos++;
      continue;
    }

    if (SELF_CLOSING.has(tag)) {
      ctx.pos++;
      if (tag === '*') {
        const children = buildNodes(ctx, '*');
        if (children.length === 0) children.push(txt(''));
        nodes.push({ type: 'listItem', children } as RichNode);
        // Don't consume an extra close; `*` acts as self-terminating on next `*`
        continue;
      }
      if (tag === 'br' || tag === 'hr') {
        nodes.push({ type: 'lineBreak' });
        continue;
      }
      continue;
    }

    ctx.pos++;
    const children = buildNodes(ctx, tag);

    switch (tag) {
      case 'b':
        nodes.push({ type: 'strong', children: flatInline(children) });
        break;
      case 'i':
        nodes.push({ type: 'emphasis', children: flatInline(children) });
        break;
      case 'u':
        nodes.push({ type: 'underline', children: flatInline(children) });
        break;
      case 's':
        nodes.push({ type: 'emphasis', children: flatInline(children) });
        break;
      case 'url': {
        const href = param ?? plainText(children);
        const linkChildren = flatInline(children);
        if (linkChildren.length === 0) linkChildren.push(txt(href));
        nodes.push({ type: 'link', href, children: linkChildren });
        break;
      }
      case 'img': {
        const src = plainText(children).trim();
        if (src) nodes.push({ type: 'image', src });
        break;
      }
      case 'quote': {
        const blocks = wrapInBlocks(children);
        nodes.push({ type: 'quote', attribution: param ?? undefined, children: blocks });
        break;
      }
      case 'color': {
        const color = param ?? '#ffffff';
        nodes.push({ type: 'color', color, children: flatInline(children) });
        break;
      }
      case 'size':
        // Degrade gracefully — just render children
        nodes.push(...children);
        break;
      case 'spoiler': {
        const blocks = wrapInBlocks(children);
        nodes.push({ type: 'spoiler', label: param ?? undefined, children: blocks });
        break;
      }
      case 'list': {
        const items = children.filter((c) => c.type === 'listItem');
        if (items.length > 0) {
          nodes.push({ type: 'list', ordered: false, children: items as any });
        } else {
          nodes.push(...children);
        }
        break;
      }
      case 'code':
        nodes.push({ type: 'codeBlock', text: plainText(children) });
        break;
      case 'center':
        // Absorb: just emit children
        nodes.push(...children);
        break;
      default:
        nodes.push(...children);
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textToNodes(raw: string): RichNode[] {
  const decoded = decodeEntities(raw);
  const parts = decoded.split(/\n{2,}/);
  if (parts.length <= 1) {
    const lines = decoded.split('\n');
    const out: RichNode[] = [];
    lines.forEach((line, i) => {
      if (i > 0) out.push({ type: 'lineBreak' });
      if (line) out.push(txt(line));
    });
    return out;
  }
  return parts.map((p) => {
    const inlines: RichInlineNode[] = [];
    const lines = p.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) inlines.push({ type: 'lineBreak' });
      if (line) inlines.push(txt(line));
    });
    return para(...inlines);
  });
}

function flatInline(nodes: RichNode[]): RichInlineNode[] {
  return nodes.flatMap((n): RichInlineNode[] => {
    if (n.type === 'paragraph') return (n as any).children ?? [];
    if (n.type === 'block') return (n as any).children ?? [];
    return [n as RichInlineNode];
  });
}

function wrapInBlocks(nodes: RichNode[]): RichBlockNode[] {
  const blocks: RichBlockNode[] = [];
  let inlineBuf: RichInlineNode[] = [];

  function flush() {
    if (inlineBuf.length > 0) {
      blocks.push(para(...inlineBuf));
      inlineBuf = [];
    }
  }

  for (const n of nodes) {
    if (
      n.type === 'paragraph' || n.type === 'heading' || n.type === 'quote' ||
      n.type === 'list' || n.type === 'codeBlock' || n.type === 'spoiler' ||
      n.type === 'block'
    ) {
      flush();
      blocks.push(n as RichBlockNode);
    } else if (n.type === 'image') {
      // Promote images to blocks so they're never inside Text (fixes thin-line layout on RN)
      flush();
      blocks.push({ type: 'block', children: [n] } as RichBlockNode);
    } else if (n.type === 'link' && (n as any).children?.length === 1 && (n as any).children[0].type === 'image') {
      // [url=...][img]...[/img][/url] — promote link+image to block (otherwise Image ends up inside Text)
      flush();
      blocks.push({ type: 'block', children: [n] } as RichBlockNode);
    } else {
      inlineBuf.push(n as RichInlineNode);
    }
  }
  flush();
  return blocks;
}

function plainText(nodes: RichNode[]): string {
  return nodes.map((n) => {
    if (n.type === 'text') return n.text;
    if (n.type === 'lineBreak') return '\n';
    if ('children' in n && Array.isArray((n as any).children)) {
      return plainText((n as any).children);
    }
    return '';
  }).join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseBBCode(raw: string): RichRootNode {
  if (!raw || typeof raw !== 'string') return root();

  const input = normalizeInputWhitespace(raw);
  const tokens = tokenize(input);
  const ctx: BuildCtx = { tokens, pos: 0 };
  const children = buildNodes(ctx);

  // Run inline-text pass on all text nodes to catch URLs / markdown-ish syntax
  const tree = root(...postProcessInlineText(children));
  return normalizeAst(tree);
}

/** Recursively apply inline text parsing to text nodes for URL/markdown detection.
 *  Skips link/image nodes (their content is already resolved). */
function postProcessInlineText(nodes: RichNode[]): RichNode[] {
  return nodes.map((n) => {
    if (n.type === 'link' || n.type === 'image') return n;
    if (n.type === 'text') {
      const parsed = parseInlineText(n.text);
      return parsed.length === 1 && parsed[0].type === 'text' ? n : { type: 'block', children: parsed } as any;
    }
    if ('children' in n && Array.isArray((n as any).children)) {
      const withChildren = n as RichNode & { children: RichNode[] };
      withChildren.children = postProcessInlineText(withChildren.children) as any;
    }
    return n;
  });
}
