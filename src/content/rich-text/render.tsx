/**
 * Unified RichContentRenderer.
 *
 * Takes a normalized RichRootNode and renders it into React Native elements
 * using the app's premium design tokens for consistent styling.
 *
 * Includes:
 *  - Aspect-ratio-aware images with tap-to-fullscreen lightbox
 *  - Syntax-tinted code blocks with line numbers + copy button
 *  - Animated spoiler reveal (Reanimated)
 *  - Long-press "Copy link" / "Copy image URL" on links and images
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Text,
  View,
  Image,
  TouchableOpacity,
  Pressable,
  Linking,
  Modal,
  ScrollView,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import type {
  RichNode,
  RichRootNode,
  RichInlineNode,
  RichBlockNode,
  RichContentSource,
} from './types';
import { parseBBCode } from './parse-bbcode';
import { parseHtml, parseSynopsisHtml, type ParseHtmlOptions } from './parse-html';
import { ACCENT, DARK_HEX, LIGHT_HEX, TYPOGRAPHY, RADIUS, SPACING } from '@/constants/designTokens';
import { useIsDark } from '@/hooks/useThemeColors';

// ---------------------------------------------------------------------------
// Theme-aware palette
// ---------------------------------------------------------------------------

interface Palette {
  text: string;
  textSecondary: string;
  textTertiary: string;
  surface: string;
  elevated: string;
  border: string;
  bg: string;
  accent: string;
  scrim: string;
}

function palette(isDark: boolean): Palette {
  const h = isDark ? DARK_HEX : LIGHT_HEX;
  return {
    text: h.text,
    textSecondary: h.textSecondary ?? h.subtext,
    textTertiary: h.textTertiary,
    surface: h.surface,
    elevated: h.elevated,
    border: h.border,
    bg: h.bg,
    accent: ACCENT.primary,
    scrim: h.scrim,
  };
}

// ---------------------------------------------------------------------------
// Key counter (stable enough for flat lists; not used in FlatList)
// ---------------------------------------------------------------------------

let _k = 0;
function k(): string {
  return `rc${_k++}`;
}

// ---------------------------------------------------------------------------
// Syntax tinting for code blocks
// ---------------------------------------------------------------------------

const CODE_PATTERNS: { re: RegExp; color: string }[] = [
  { re: /(\/\/.*|#.*)/g, color: '#6A9955' },
  { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, color: '#CE9178' },
  { re: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|new|this|async|await|try|catch|throw|switch|case|break|default|typeof|instanceof|void|null|undefined|true|false)\b/g, color: '#569CD6' },
  { re: /\b(\d+(?:\.\d+)?)\b/g, color: '#B5CEA8' },
];

function tintCodeLine(line: string, p: Palette): React.ReactNode[] {
  interface Span { start: number; end: number; color: string }
  const spans: Span[] = [];

  for (const pat of CODE_PATTERNS) {
    pat.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.re.exec(line)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (!spans.some((sp) => s < sp.end && e > sp.start)) {
        spans.push({ start: s, end: e, color: pat.color });
      }
    }
  }

  spans.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const sp of spans) {
    if (sp.start > cursor) {
      parts.push(<Text key={k()} style={{ color: p.textSecondary }}>{line.slice(cursor, sp.start)}</Text>);
    }
    parts.push(<Text key={k()} style={{ color: sp.color }}>{line.slice(sp.start, sp.end)}</Text>);
    cursor = sp.end;
  }
  if (cursor < line.length) {
    parts.push(<Text key={k()} style={{ color: p.textSecondary }}>{line.slice(cursor)}</Text>);
  }
  return parts.length ? parts : [<Text key={k()} style={{ color: p.textSecondary }}>{line}</Text>];
}

// ---------------------------------------------------------------------------
// Copy-toast (ephemeral feedback)
// ---------------------------------------------------------------------------

function CopyToast({ visible, label }: { visible: boolean; label: string }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 150 });
    } else {
      opacity.value = 0;
    }
  }, [visible, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          bottom: 24,
          alignSelf: 'center',
          backgroundColor: 'rgba(0,0,0,0.82)',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: RADIUS.pill,
          zIndex: 100,
        },
        animatedStyle,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: TYPOGRAPHY.caption.fontSize, fontWeight: '600' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// ImgBB page URL → direct image URL resolution
// ---------------------------------------------------------------------------

/** Detect ImgBB/ibb.co page URLs (HTML) vs direct image URLs (i.ibb.co). */
const IMGBB_PAGE_RE = /^https?:\/\/(?:www\.)?(?:ibb\.co|imgbb\.com)\/[a-zA-Z0-9]+(?:\/.*)?$/i;
const IMGBB_DIRECT_RE = /^https?:\/\/(?:i\.ibb\.co)/i;

async function tryResolveImgBbUrl(pageUrl: string): Promise<string | null> {
  if (!IMGBB_PAGE_RE.test(pageUrl) || IMGBB_DIRECT_RE.test(pageUrl)) return null;
  try {
    const res = await fetch(pageUrl, { redirect: 'follow' });
    const html = await res.text();
    const ogMatch = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i)
      ?? html.match(/content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']/i);
    if (ogMatch?.[1]) return ogMatch[1].trim();
    const srcMatch = html.match(/https:\/\/i\.ibb\.co\/[a-zA-Z0-9]+\/[^\s"'<>]+\.(?:jpe?g|png|gif|webp)/i);
    if (srcMatch) return srcMatch[0];
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// RichImage — aspect-ratio-aware, tap fullscreen, long-press copy URL
// ---------------------------------------------------------------------------

/** Clamp aspect ratio to avoid thin-line rendering from bad URLs (e.g. imgbb page links). */
const MIN_ASPECT = 0.25;
const MAX_ASPECT = 4;
const MIN_IMAGE_HEIGHT = 100;
const MAX_IMAGE_HEIGHT = 320;
const MIN_DIM = 20; // Reject getSize results with tiny dimensions (tracking pixels, error pages)

function RichImage({ uri, p, inline, wrappedInLink }: { uri: string; p: Palette; inline?: boolean; wrappedInLink?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [copied, setCopied] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const displayUri = resolvedUri ?? uri;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const direct = await tryResolveImgBbUrl(uri);
      if (!cancelled && direct) setResolvedUri(direct);
    })();
    return () => { cancelled = true; };
  }, [uri]);

  useEffect(() => {
    Image.getSize(
      displayUri,
      (w, h) => {
        if (w && h && w >= MIN_DIM && h >= MIN_DIM) {
          const raw = w / h;
          setAspectRatio(Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, raw)));
        }
      },
      () => {},
    );
  }, [displayUri]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleLongPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(uri);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }, [uri]);

  if (failed) return null;

  const rawHeight = (screenWidth - 48) / aspectRatio;
  const containerHeight = Math.min(MAX_IMAGE_HEIGHT, Math.max(MIN_IMAGE_HEIGHT, rawHeight));

  const imageElement = (
    <Image
      source={{ uri: displayUri }}
      style={{
        width: '100%',
        height: containerHeight,
        borderRadius: RADIUS.md,
        backgroundColor: p.elevated,
      }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );

  if (wrappedInLink) {
    return (
      <View style={{ marginVertical: SPACING.sm, width: '100%', alignSelf: 'stretch' }}>
        {imageElement}
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setLightbox(true)}
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          marginVertical: inline ? 2 : SPACING.sm,
          position: 'relative',
          width: '100%',
          alignSelf: 'stretch',
        })}
      >
        {imageElement}
        <CopyToast visible={copied} label="Image URL copied" />
      </Pressable>

      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setLightbox(false)}
        >
          <Image
            source={{ uri: displayUri }}
            style={{ width: screenWidth - 32, height: (screenWidth - 32) / aspectRatio, borderRadius: RADIUS.md }}
            resizeMode="contain"
          />
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: TYPOGRAPHY.caption.fontSize, marginTop: SPACING.md }}>
            Tap anywhere to close
          </Text>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// RichLinkBlock — block-level link wrapping an image (never inside Text)
// ---------------------------------------------------------------------------

function RichLinkBlock({ href, children, p }: { href: string; children: React.ReactNode; p: Palette }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handlePress = useCallback(() => {
    const url = href.trim();
    if (url) WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
  }, [href]);

  const handleLongPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(href);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }, [href]);

  return (
    <Pressable
      key={k()}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {children}
      <CopyToast visible={copied} label="Link copied" />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// RichLink — tappable, long-press copy URL (inline, uses Text)
// ---------------------------------------------------------------------------

function RichLink({ href, children, p }: { href: string; children: React.ReactNode; p: Palette }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handlePress = useCallback(() => {
    const url = href.trim();
    if (url) WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
  }, [href]);

  const handleLongPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(href);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }, [href]);

  return (
    <Text
      key={k()}
      style={{ color: p.accent, fontWeight: '600', position: 'relative' }}
      onPress={handlePress}
      onLongPress={handleLongPress}
      suppressHighlighting={false}
    >
      {children}
      {copied ? (
        <Text style={{ color: p.textTertiary, fontSize: TYPOGRAPHY.helper.fontSize }}> (copied)</Text>
      ) : null}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// CodeBlock — syntax tinting, line numbers, copy button
// ---------------------------------------------------------------------------

function CodeBlock({ text, p }: { text: string; p: Palette }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lines = text.split('\n');
  const gutterWidth = String(lines.length).length * 9 + 12;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(text);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }, [text]);

  return (
    <View
      style={{
        backgroundColor: p.surface,
        borderRadius: RADIUS.sm,
        marginVertical: SPACING.sm,
        borderWidth: 1,
        borderColor: p.border,
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.xs + 2,
          borderBottomWidth: 1,
          borderBottomColor: p.border,
        }}
      >
        <Text style={{ color: p.textTertiary, fontSize: TYPOGRAPHY.helper.fontSize, fontWeight: '500' }}>
          {lines.length} line{lines.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} hitSlop={8}>
          <Text style={{ color: copied ? ACCENT.primary : p.textTertiary, fontSize: TYPOGRAPHY.helper.fontSize, fontWeight: '600' }}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Code area */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ paddingVertical: SPACING.sm, paddingRight: SPACING.md, flexDirection: 'column' }}>
          {lines.map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', minHeight: 20 }}>
              <Text
                style={{
                  width: gutterWidth,
                  textAlign: 'right',
                  paddingRight: SPACING.sm,
                  fontFamily: 'monospace',
                  fontSize: TYPOGRAPHY.caption.fontSize - 1,
                  lineHeight: 20,
                  color: p.textTertiary,
                  opacity: 0.5,
                }}
              >
                {i + 1}
              </Text>
              <Text
                style={{
                  fontFamily: 'monospace',
                  fontSize: TYPOGRAPHY.caption.fontSize,
                  lineHeight: 20,
                }}
              >
                {tintCodeLine(line, p)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SpoilerBlock — animated reveal
// ---------------------------------------------------------------------------

function SpoilerBlock({ node, palette: p }: { node: { label?: string; children: RichBlockNode[] }; palette: Palette }) {
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
    if (next) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [open, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    maxHeight: progress.value === 0 ? 0 : undefined,
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: p.border,
        borderRadius: RADIUS.md,
        marginVertical: SPACING.sm,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        style={{
          backgroundColor: p.surface,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm + 2,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Animated.Text
            style={[{ color: p.textTertiary, fontSize: 11 }, chevronStyle]}
          >
            ▶
          </Animated.Text>
          <Text style={{ color: p.textSecondary, fontSize: TYPOGRAPHY.metadata.fontSize, fontWeight: '600' }}>
            {node.label || 'Spoiler'}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: open ? `${ACCENT.primary}22` : `${p.textTertiary}18`,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: RADIUS.pill,
          }}
        >
          <Text
            style={{
              color: open ? ACCENT.primary : p.textTertiary,
              fontSize: TYPOGRAPHY.helper.fontSize,
              fontWeight: '600',
            }}
          >
            {open ? 'Hide' : 'Reveal'}
          </Text>
        </View>
      </TouchableOpacity>
      <Animated.View style={[{ paddingHorizontal: SPACING.md }, bodyStyle]}>
        {open && (
          <View style={{ paddingVertical: SPACING.sm }}>
            {node.children.map((c) => renderBlock(c, p))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inline renderer
// ---------------------------------------------------------------------------

function renderInline(node: RichInlineNode, p: Palette): React.ReactNode {
  switch (node.type) {
    case 'text':
      return node.text;

    case 'lineBreak':
      return '\n';

    case 'strong':
      return (
        <Text key={k()} style={{ fontWeight: '700', color: p.text }}>
          {node.children.map((c) => renderInline(c, p))}
        </Text>
      );

    case 'emphasis':
      return (
        <Text key={k()} style={{ fontStyle: 'italic', color: p.textSecondary }}>
          {node.children.map((c) => renderInline(c, p))}
        </Text>
      );

    case 'underline':
      return (
        <Text key={k()} style={{ textDecorationLine: 'underline', color: p.text }}>
          {node.children.map((c) => renderInline(c, p))}
        </Text>
      );

    case 'link':
      return (
        <RichLink key={k()} href={node.href} p={p}>
          {node.children.map((c) => renderInline(c, p))}
        </RichLink>
      );

    case 'image':
      return <RichImage key={k()} uri={node.src} p={p} inline />;

    case 'codeSpan':
      return (
        <Text
          key={k()}
          style={{
            fontFamily: 'monospace',
            fontSize: TYPOGRAPHY.caption.fontSize,
            backgroundColor: p.elevated,
            color: p.textSecondary,
            paddingHorizontal: 4,
            borderRadius: 4,
          }}
        >
          {node.text}
        </Text>
      );

    case 'color':
      return (
        <Text key={k()} style={{ color: node.color }}>
          {node.children.map((c) => renderInline(c, p))}
        </Text>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------

function renderBlock(node: RichBlockNode | RichNode, p: Palette): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <Text
          key={k()}
          style={{
            color: p.textSecondary,
            fontSize: TYPOGRAPHY.body.fontSize - 1,
            lineHeight: TYPOGRAPHY.body.lineHeight - 2,
            marginBottom: SPACING.xs + 2,
          }}
        >
          {node.children.map((c) => renderInline(c, p))}
        </Text>
      );

    case 'heading': {
      const styles: Record<number, TextStyle> = {
        1: {
          fontSize: TYPOGRAPHY.screenTitle.fontSize,
          fontWeight: '700',
          lineHeight: TYPOGRAPHY.screenTitle.lineHeight,
          color: p.text,
          marginBottom: SPACING.sm,
          marginTop: SPACING.md,
        },
        2: {
          fontSize: TYPOGRAPHY.sectionTitle.fontSize,
          fontWeight: '600',
          lineHeight: TYPOGRAPHY.sectionTitle.lineHeight,
          color: p.text,
          marginBottom: SPACING.xs,
          marginTop: SPACING.sm,
        },
        3: {
          fontSize: TYPOGRAPHY.cardTitle.fontSize,
          fontWeight: '600',
          lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
          color: p.textSecondary,
          marginBottom: SPACING.xs,
          marginTop: SPACING.sm,
        },
      };
      return (
        <Text key={k()} style={styles[node.level] ?? styles[3]}>
          {node.children.map((c) => renderInline(c, p))}
        </Text>
      );
    }

    case 'quote':
      return (
        <View
          key={k()}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: p.accent,
            backgroundColor: p.surface,
            borderRadius: RADIUS.sm,
            paddingLeft: SPACING.md,
            paddingVertical: SPACING.sm,
            paddingRight: SPACING.sm,
            marginVertical: SPACING.sm,
          }}
        >
          {node.attribution ? (
            <Text
              style={{
                color: p.textTertiary,
                fontSize: TYPOGRAPHY.caption.fontSize,
                fontWeight: '600',
                marginBottom: SPACING.xs,
              }}
            >
              {node.attribution}
            </Text>
          ) : null}
          {node.children.map((c) => renderBlock(c, p))}
        </View>
      );

    case 'list':
      return (
        <View key={k()} style={{ paddingLeft: SPACING.base, marginVertical: SPACING.xs }}>
          {node.children.map((item, idx) => (
            <View key={k()} style={{ flexDirection: 'row', marginBottom: SPACING.xs }}>
              <Text style={{ color: p.textTertiary, fontSize: TYPOGRAPHY.body.fontSize, marginRight: SPACING.xs }}>
                {node.ordered ? `${idx + 1}.` : '•'}
              </Text>
              <View style={{ flex: 1 }}>
                {item.children.map((c) => renderNode(c, p))}
              </View>
            </View>
          ))}
        </View>
      );

    case 'listItem':
      return (
        <View key={k()}>
          {node.children.map((c) => renderNode(c, p))}
        </View>
      );

    case 'codeBlock':
      return <CodeBlock key={k()} text={node.text} p={p} />;

    case 'preformatted':
      return (
        <Text
          key={k()}
          style={{
            color: p.textSecondary,
            fontSize: TYPOGRAPHY.body.fontSize - 1,
            lineHeight: TYPOGRAPHY.body.lineHeight - 2,
            marginVertical: SPACING.sm,
            fontFamily: 'monospace',
          }}
        >
          {(node as { text: string }).text}
        </Text>
      );

    case 'spoiler':
      return <SpoilerBlock key={k()} node={node} palette={p} />;

    case 'block':
      return (
        <View key={k()}>
          {node.children.map((c) => renderNode(c, p))}
        </View>
      );

    case 'link': {
      const linkNode = node as RichNode & { href: string; children: RichNode[] };
      const children = linkNode.children ?? [];
      const soleImage = children.length === 1 && children[0].type === 'image';
      if (soleImage) {
        // Link wrapping image: use View+Pressable so Image is never inside Text (fixes thin-line layout)
        return (
          <RichLinkBlock key={k()} href={linkNode.href} p={p}>
            <RichImage uri={(children[0] as any).src} p={p} wrappedInLink />
          </RichLinkBlock>
        );
      }
      return (
        <Text
          key={k()}
          style={{
            color: p.textSecondary,
            fontSize: TYPOGRAPHY.body.fontSize,
            lineHeight: TYPOGRAPHY.body.lineHeight,
          }}
        >
          {renderInline(linkNode as RichInlineNode, p)}
        </Text>
      );
    }

    case 'text':
    case 'strong':
    case 'emphasis':
    case 'underline':
    case 'codeSpan':
    case 'color':
      return (
        <Text
          key={k()}
          style={{
            color: p.textSecondary,
            fontSize: TYPOGRAPHY.body.fontSize,
            lineHeight: TYPOGRAPHY.body.lineHeight,
          }}
        >
          {renderInline(node as RichInlineNode, p)}
        </Text>
      );

    case 'lineBreak':
      return <View key={k()} style={{ height: SPACING.xs }} />;

    case 'image':
      return <RichImage key={k()} uri={(node as any).src} p={p} />;

    default:
      return null;
  }
}

function renderNode(node: RichNode, p: Palette): React.ReactNode {
  return renderBlock(node as RichBlockNode, p);
}

// ---------------------------------------------------------------------------
// Public components
// ---------------------------------------------------------------------------

interface RichContentRendererProps {
  ast: RichRootNode;
}

/**
 * Low-level renderer: takes a pre-parsed AST.
 */
export function RichContentRenderer({ ast }: RichContentRendererProps) {
  const isDark = useIsDark();
  const p = useMemo(() => palette(isDark), [isDark]);

  if (!ast?.children?.length) return null;

  return (
    <View>
      {ast.children.map((child) => renderNode(child, p))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Convenience: source-aware entry-point component
// ---------------------------------------------------------------------------

interface RichContentProps {
  /** Raw content string. */
  content: string;
  /** Source type for parser routing. */
  source: RichContentSource;
}

/**
 * High-level component: parses raw content based on source and renders it.
 */
export function RichContent({ content, source }: RichContentProps) {
  const ast = useMemo(() => {
    if (!content) return { type: 'root' as const, children: [] };
    const htmlOpts: ParseHtmlOptions | undefined =
      source === 'anilist-review' ? { preAsPreformatted: true } : undefined;
    switch (source) {
      case 'mal-forum':
        return parseBBCode(content);
      case 'anilist-review':
        return parseHtml(content, htmlOpts);
      case 'synopsis':
        return parseSynopsisHtml(content);
      case 'generic':
      default:
        return parseHtml(content, htmlOpts);
    }
  }, [content, source]);

  return <RichContentRenderer ast={ast} />;
}

// ---------------------------------------------------------------------------
// Expandable rich content (replaces ExpandableDescription for rich sources)
// ---------------------------------------------------------------------------

interface ExpandableRichContentProps {
  content: string;
  source: RichContentSource;
  /** Max height when collapsed (in px). */
  maxCollapsedHeight?: number;
  /** Fallback text when content is empty. */
  emptyText?: string;
}

/**
 * Rich-content-aware expandable description.
 * Collapses long rich content behind a "Read more" toggle.
 */
export function ExpandableRichContent({
  content,
  source,
  maxCollapsedHeight = 120,
  emptyText = 'No description available.',
}: ExpandableRichContentProps) {
  const isDark = useIsDark();
  const p = useMemo(() => palette(isDark), [isDark]);
  const [expanded, setExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const shouldCollapse = contentHeight > maxCollapsedHeight;

  if (!content?.trim()) {
    return (
      <Text style={{ color: p.textSecondary, fontSize: TYPOGRAPHY.body.fontSize }}>
        {emptyText}
      </Text>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => shouldCollapse && setExpanded((e) => !e)}
      activeOpacity={shouldCollapse ? 0.7 : 1}
      disabled={!shouldCollapse}
    >
      <View
        style={
          !expanded && shouldCollapse
            ? { maxHeight: maxCollapsedHeight, overflow: 'hidden' }
            : undefined
        }
      >
        <View
          onLayout={(e) => {
            if (contentHeight === 0) setContentHeight(e.nativeEvent.layout.height);
          }}
        >
          <RichContent content={content} source={source} />
        </View>
      </View>
      {shouldCollapse && (
        <Text
          style={{
            color: p.accent,
            fontSize: TYPOGRAPHY.caption.fontSize,
            fontWeight: '600',
            marginTop: SPACING.xs,
          }}
        >
          {expanded ? 'Read less' : 'Read more'}
        </Text>
      )}
    </TouchableOpacity>
  );
}
