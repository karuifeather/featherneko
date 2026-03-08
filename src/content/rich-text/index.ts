/**
 * Rich content pipeline — barrel export.
 *
 * Usage:
 *   import { RichContent, ExpandableRichContent } from '@/content/rich-text';
 *
 * Or lower-level:
 *   import { parseBBCode } from '@/content/rich-text';
 *   import { RichContentRenderer } from '@/content/rich-text';
 */

// Types
export type {
  RichNode,
  RichRootNode,
  RichInlineNode,
  RichBlockNode,
  RichContentSource,
  RichTextNode,
  RichLineBreakNode,
  RichStrongNode,
  RichEmphasisNode,
  RichUnderlineNode,
  RichLinkNode,
  RichImageNode,
  RichCodeSpanNode,
  RichColorNode,
  RichParagraphNode,
  RichHeadingNode,
  RichQuoteNode,
  RichListNode,
  RichListItemNode,
  RichCodeBlockNode,
  RichSpoilerNode,
  RichBlockNode_Block,
} from './types';

export { isInlineNode, isBlockNode, txt, para, root } from './types';

// Parsers
export { parseBBCode } from './parse-bbcode';
export { parseHtml, parseSynopsisHtml } from './parse-html';
export { parseInlineText } from './parse-inline-text';

// Normalization
export { normalizeAst, decodeEntities, isSafeUrl } from './normalize';

// Renderer
export {
  RichContentRenderer,
  RichContent,
  ExpandableRichContent,
} from './render';
