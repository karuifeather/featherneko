/**
 * Unified rich-content node model.
 *
 * Every source (BBCode, HTML, mixed plain text) normalizes into this AST
 * before the single renderer turns it into React Native elements.
 */

// ---------------------------------------------------------------------------
// Inline node types
// ---------------------------------------------------------------------------

export interface RichTextNode {
  type: 'text';
  text: string;
}

export interface RichLineBreakNode {
  type: 'lineBreak';
}

export interface RichStrongNode {
  type: 'strong';
  children: RichInlineNode[];
}

export interface RichEmphasisNode {
  type: 'emphasis';
  children: RichInlineNode[];
}

export interface RichUnderlineNode {
  type: 'underline';
  children: RichInlineNode[];
}

export interface RichLinkNode {
  type: 'link';
  href: string;
  children: RichInlineNode[];
}

export interface RichImageNode {
  type: 'image';
  src: string;
  alt?: string;
}

export interface RichCodeSpanNode {
  type: 'codeSpan';
  text: string;
}

export interface RichColorNode {
  type: 'color';
  color: string;
  children: RichInlineNode[];
}

export type RichInlineNode =
  | RichTextNode
  | RichLineBreakNode
  | RichStrongNode
  | RichEmphasisNode
  | RichUnderlineNode
  | RichLinkNode
  | RichImageNode
  | RichCodeSpanNode
  | RichColorNode;

// ---------------------------------------------------------------------------
// Block node types
// ---------------------------------------------------------------------------

export interface RichParagraphNode {
  type: 'paragraph';
  children: RichInlineNode[];
}

export interface RichHeadingNode {
  type: 'heading';
  level: 1 | 2 | 3;
  children: RichInlineNode[];
}

export interface RichQuoteNode {
  type: 'quote';
  attribution?: string;
  children: RichBlockNode[];
}

export interface RichListNode {
  type: 'list';
  ordered: boolean;
  children: RichListItemNode[];
}

export interface RichListItemNode {
  type: 'listItem';
  children: RichNode[];
}

export interface RichCodeBlockNode {
  type: 'codeBlock';
  text: string;
}

/** Preformatted block (preserves line breaks, no code-editor styling). Used for <pre> in reviews. */
export interface RichPreformattedNode {
  type: 'preformatted';
  text: string;
}

export interface RichSpoilerNode {
  type: 'spoiler';
  label?: string;
  children: RichBlockNode[];
}

/** Generic block wrapper for unsupported structural tags. */
export interface RichBlockNode_Block {
  type: 'block';
  children: RichNode[];
}

export type RichBlockNode =
  | RichParagraphNode
  | RichHeadingNode
  | RichQuoteNode
  | RichListNode
  | RichListItemNode
  | RichCodeBlockNode
  | RichPreformattedNode
  | RichSpoilerNode
  | RichBlockNode_Block;

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface RichRootNode {
  type: 'root';
  children: RichNode[];
}

export type RichNode = RichInlineNode | RichBlockNode | RichRootNode;

// ---------------------------------------------------------------------------
// Source type for entry-point routing
// ---------------------------------------------------------------------------

export type RichContentSource =
  | 'mal-forum'
  | 'anilist-review'
  | 'synopsis'
  | 'generic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isInlineNode(node: RichNode): node is RichInlineNode {
  const inlineTypes: string[] = [
    'text', 'lineBreak', 'strong', 'emphasis', 'underline',
    'link', 'image', 'codeSpan', 'color',
  ];
  return inlineTypes.includes(node.type);
}

export function isBlockNode(node: RichNode): node is RichBlockNode {
  const blockTypes: string[] = [
    'paragraph', 'heading', 'quote', 'list', 'listItem',
    'codeBlock', 'preformatted', 'spoiler', 'block',
  ];
  return blockTypes.includes(node.type);
}

export function txt(text: string): RichTextNode {
  return { type: 'text', text };
}

export function para(...children: RichInlineNode[]): RichParagraphNode {
  return { type: 'paragraph', children };
}

export function root(...children: RichNode[]): RichRootNode {
  return { type: 'root', children };
}
