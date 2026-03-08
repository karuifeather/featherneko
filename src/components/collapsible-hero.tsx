import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faPlay, faPlus, faCheck } from '@fortawesome/free-solid-svg-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { GenreTag } from '@/components/ui/genre-tag';
import { SmartTitle } from '@/components/smart-title';
import { DARK_HEX, LIGHT_HEX } from '@/constants/designTokens';

const HERO_EXPANDED_HEIGHT = 320;
const HERO_COLLAPSED_HEIGHT = 72;

interface CollapsibleHeroProps {
  isCollapsed: boolean;
  heroUri: string | null;
  title: string;
  averageScore?: number;
  episodes?: number;
  status?: string;
  genres?: string[];
  inWatchlist: boolean;
  onBack: () => void;
  onWatchPress: () => void;
  onWatchlistPress: () => void;
  coverImageUri?: string | null;
  isDark: boolean;
  insets: { top: number };
}

export function CollapsibleHero({
  isCollapsed,
  heroUri,
  title,
  averageScore,
  episodes,
  status,
  genres = [],
  inWatchlist,
  onBack,
  onWatchPress,
  onWatchlistPress,
  coverImageUri,
  isDark,
  insets,
}: CollapsibleHeroProps) {
  const themeHex = isDark ? DARK_HEX : LIGHT_HEX;
  const elevatedBg = isDark ? '#1c1e21' : '#f4f4f5';
  const contentHeight = isCollapsed ? HERO_COLLAPSED_HEIGHT : HERO_EXPANDED_HEIGHT;
  const totalHeight = contentHeight + insets.top;

  const expandedOpacity = useRef(new Animated.Value(1)).current;
  const collapsedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(expandedOpacity, {
      toValue: isCollapsed ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(collapsedOpacity, {
      toValue: isCollapsed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isCollapsed, expandedOpacity, collapsedOpacity]);

  return (
    <View style={[styles.heroWrapper, { height: totalHeight, paddingTop: insets.top }]}>
      <View style={[styles.heroContent, { height: contentHeight }]}>
      {/* Backdrop — full bleed */}
      {heroUri ? (
        <ImageWithFallback
          source={{ uri: heroUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          fadeInDuration={350}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: elevatedBg }]} />
      )}
      <BlurView intensity={25} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[themeHex.heroGradientStart, themeHex.heroGradientEnd]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }}
      />

      {/* Expanded state — title, metadata, genres, CTAs */}
      <Animated.View
        style={[styles.expandedContent, { opacity: expandedOpacity }]}
        pointerEvents={isCollapsed ? 'none' : 'auto'}
      >
        <View style={styles.expandedInner}>
          <SmartTitle
            title={title}
            maxLines={2}
            className="text-white"
            expandable
            singleLine={false}
          />
          <View style={styles.metadataRow}>
            {averageScore != null && (
              <Text style={styles.metadataText}>★ {averageScore.toFixed(1)}</Text>
            )}
            {episodes != null && (
              <Text style={styles.metadataTextMuted}>· {episodes} eps</Text>
            )}
            {status != null && (
              <Text style={styles.metadataTextMuted}>· {status.replace('_', ' ')}</Text>
            )}
          </View>
          {genres.length > 0 && (
            <View style={styles.genresRow}>
              {genres.slice(0, 4).map((g) => (
                <GenreTag key={g} label={g} />
              ))}
            </View>
          )}
          <View style={styles.ctaRow}>
            <Pressable onPress={onWatchPress} style={styles.primaryCta} accessibilityLabel="Watch episodes" accessibilityRole="button">
              <FontAwesomeIcon icon={faPlay} size={14} color="#0a0a0b" />
              <Text style={styles.primaryCtaText}>Watch</Text>
            </Pressable>
            <Pressable
              onPress={onWatchlistPress}
              style={styles.secondaryCta}
              accessibilityLabel={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              accessibilityRole="button"
            >
              <FontAwesomeIcon icon={inWatchlist ? faCheck : faPlus} size={12} color="#fff" />
              <Text style={styles.secondaryCtaText}>{inWatchlist ? 'In list' : 'Watchlist'}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Collapsed state — compact strip */}
      <Animated.View
        style={[styles.collapsedContent, { opacity: collapsedOpacity }]}
        pointerEvents={isCollapsed ? 'auto' : 'none'}
      >
        <View style={styles.collapsedInner}>
          <View style={styles.collapsedPoster}>
            {coverImageUri ? (
              <ImageWithFallback
                source={{ uri: coverImageUri }}
                style={styles.collapsedPosterImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.collapsedPosterImage, { backgroundColor: elevatedBg }]} />
            )}
          </View>
          <View style={styles.collapsedTextBlock}>
            <SmartTitle title={title} maxLines={1} className="text-white" singleLine />
            <View style={styles.collapsedMetadata}>
              {averageScore != null && (
                <Text style={styles.collapsedMetaText}>★ {averageScore.toFixed(1)}</Text>
              )}
              {episodes != null && (
                <Text style={styles.collapsedMetaMuted}>· {episodes} eps</Text>
              )}
              {status != null && (
                <Text style={styles.collapsedMetaMuted}>· {status.replace('_', ' ')}</Text>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Back button — on top so it always receives touches */}
      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.8}
        style={[styles.backBtn, { top: 8, zIndex: 10 }]}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <FontAwesomeIcon icon={faChevronLeft} size={20} color="#fff" />
      </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    overflow: 'hidden',
    flexShrink: 0,
  },
  heroContent: {
    overflow: 'hidden',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  expandedInner: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  metadataText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  metadataTextMuted: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  primaryCtaText: { color: '#0a0a0b', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  secondaryCtaText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 6 },
  collapsedContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  collapsedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 12,
  },
  collapsedPoster: {
    width: 44,
    height: 62,
    borderRadius: 6,
    overflow: 'hidden',
  },
  collapsedPosterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  collapsedTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  collapsedMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  collapsedMetaText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  collapsedMetaMuted: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
});
