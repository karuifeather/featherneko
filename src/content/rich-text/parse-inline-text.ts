/**
 * Inline / mixed-text parser.
 *
 * Detects and converts:
 * - plain URLs → link nodes
 * - standalone image URLs (.jpg, .png, .gif, .webp) → image nodes
 * - markdown links: [text](url)
 * - markdown emphasis: **bold**, *italic*, __italic__
 * - newlines / blank-line paragraph boundaries
 *
 * Designed to be called on raw text nodes after the primary BBCode/HTML
 * parse, so hybrid content is handled uniformly.
 */

import type { RichInlineNode } from './types';

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)(\?[^\s]*)?$/i;

const URL_RE =
  /https?:\/\/[^\s<>\[\]"'`]+/g;

const MD_LINK_RE =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_STAR_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
const ITALIC_UNDER_RE = /__(.+?)__/g;

// ---------------------------------------------------------------------------
// Main parse
// ---------------------------------------------------------------------------

/**
 * Parse a plain-text string for inline formatting, URLs, images.
 * Returns an array of inline nodes.
 */
export function parseInlineText(input: string): RichInlineNode[] {
  if (!input) return [];

  // We process in a specific priority order to avoid double-matching.
  // 1. markdown links  [text](url)
  // 2. **bold**
  // 3. *italic* / __italic__
  // 4. bare URLs (split into image vs link)

  const segments = splitByPatterns(input);
  return segments;
}

// ---------------------------------------------------------------------------
// Pattern-based segmentation
// ---------------------------------------------------------------------------

interface Span {
  start: number;
  end: number;
  node: RichInlineNode;
}

function splitByPatterns(input: string): RichInlineNode[] {
  const spans: Span[] = [];

  // Collect all markdown links first (highest priority)
  for (const m of input.matchAll(MD_LINK_RE)) {
    const text = m[1];
    const url = m[2];
    spans.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: { type: 'link', href: url, children: [{ type: 'text', text }] },
    });
  }

  // Bold **...**
  for (const m of input.matchAll(BOLD_RE)) {
    if (overlaps(spans, m.index!, m.index! + m[0].length)) continue;
    spans.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: { type: 'strong', children: [{ type: 'text', text: m[1] }] },
    });
  }

  // Italic *...* (single star, not inside bold)
  for (const m of input.matchAll(ITALIC_STAR_RE)) {
    if (overlaps(spans, m.index!, m.index! + m[0].length)) continue;
    spans.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: { type: 'emphasis', children: [{ type: 'text', text: m[1] }] },
    });
  }

  // Italic __...__
  for (const m of input.matchAll(ITALIC_UNDER_RE)) {
    if (overlaps(spans, m.index!, m.index! + m[0].length)) continue;
    spans.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: { type: 'emphasis', children: [{ type: 'text', text: m[1] }] },
    });
  }

  // Bare URLs (not already captured by markdown links)
  for (const m of input.matchAll(URL_RE)) {
    if (overlaps(spans, m.index!, m.index! + m[0].length)) continue;
    const url = m[0];
    // Check if standalone image URL
    if (isStandaloneImageUrl(input, m.index!, m[0].length, url)) {
      spans.push({
        start: m.index!,
        end: m.index! + m[0].length,
        node: { type: 'image', src: url },
      });
    } else {
      spans.push({
        start: m.index!,
        end: m.index! + m[0].length,
        node: { type: 'link', href: url, children: [{ type: 'text', text: url }] },
      });
    }
  }

  // Sort spans by start position
  spans.sort((a, b) => a.start - b.start);

  // Build output with text gaps filled in
  const result: RichInlineNode[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      pushText(result, input.slice(cursor, span.start));
    }
    result.push(span.node);
    cursor = span.end;
  }
  if (cursor < input.length) {
    pushText(result, input.slice(cursor));
  }

  return result.length > 0 ? result : [{ type: 'text', text: input }];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function overlaps(spans: Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

/**
 * Determines whether a URL match is a "standalone" image URL:
 * - has an image extension
 * - is on its own line, or surrounded only by whitespace / nothing
 * Falls back to link if embedded in flowing text (words touching it).
 */
function isStandaloneImageUrl(
  input: string,
  matchStart: number,
  matchLen: number,
  url: string,
): boolean {
  if (!IMAGE_EXT_RE.test(url)) return false;

  const before = matchStart > 0 ? input[matchStart - 1] : '';
  const after = matchStart + matchLen < input.length ? input[matchStart + matchLen] : '';

  const isStartClean = matchStart === 0 || before === '\n' || before === ' ' || before === '\t';
  const isEndClean = matchStart + matchLen >= input.length || after === '\n' || after === ' ' || after === '\t';

  return isStartClean && isEndClean;
}

function pushText(out: RichInlineNode[], raw: string): void {
  if (!raw) return;
  // Convert newlines
  const parts = raw.split('\n');
  parts.forEach((part, i) => {
    if (i > 0) out.push({ type: 'lineBreak' });
    if (part) out.push({ type: 'text', text: part });
  });
}
