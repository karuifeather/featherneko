import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPlus, faCheck, faPlay } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import type { RootState } from '@/state/store';
import { addToWatchlist, removeFromWatchlist } from '@/state/watchlistSlice';
import { selectWatchlistMalIds } from '@/state/selectors';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useEdgeToEdgeInsets } from '@/hooks/useEdgeToEdgeInsets';
import { DARK_HEX, LIGHT_HEX } from '@/constants/designTokens';
import { ACCENT } from '@/constants/colors';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_BASE_HEIGHT = 280;
const PADDING_H = 16;

interface Anime {
  id: number;
  idMal: number;
  title: { romaji: string; english: string };
  coverImage: { large: string };
  bannerImage: string;
  description: string;
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html.replace(/<\/?[^>]+(>|$)/g, '').trim();
}

function shortenSynopsis(text: string, maxLen = 100): string {
  const stripped = stripHtmlTags(text);
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen).trim() + '…';
}

const REPEAT_COUNT = 3;

/** Hero overlay text is always light — gradient is dark in both themes */
const HERO_TEXT = DARK_HEX.text;
const HERO_TEXT_SECONDARY = DARK_HEX.textSecondary;

export default function CarouselHeroSection({
  trendingAnime,
}: {
  trendingAnime?: Anime[] | null;
}) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { overlayHeaderHeight } = useEdgeToEdgeInsets();
  const { isDark, hex } = useThemeColors();
  const TOP_OFFSET = 14; // Reduced from overlayHeaderHeight for tighter header-to-hero gap
  const heroTop = overlayHeaderHeight - TOP_OFFSET;
  const HERO_HEIGHT = HERO_BASE_HEIGHT + heroTop;
  const themeHex = isDark ? DARK_HEX : LIGHT_HEX;
  const watchlistIds = useSelector(selectWatchlistMalIds);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const list = Array.isArray(trendingAnime) ? trendingAnime : [];
  const n = list.length;
  const infiniteData = n <= 1 ? list : Array(REPEAT_COUNT).fill(list).flat();
  const middleStart = n <= 1 ? 0 : n;

  useEffect(() => {
    if (n <= 1) return;
    const interval = setInterval(() => {
      const nextLogical = (currentIndex + 1) % n;
      const nextVirtualIndex = middleStart + nextLogical;
      flatListRef.current?.scrollToIndex({
        animated: true,
        index: nextVirtualIndex,
      });
      setCurrentIndex(nextLogical);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, n, middleStart]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    if (n <= 1) return;
    const rawIndex = Math.round(offset / SCREEN_WIDTH);
    const logical = ((rawIndex % n) + n) % n;
    setCurrentIndex(logical);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (n <= 1) return;
    const offset = e.nativeEvent.contentOffset.x;
    const sectionSize = n * SCREEN_WIDTH;
    if (offset < sectionSize) {
      flatListRef.current?.scrollToOffset({
        offset: offset + sectionSize,
        animated: false,
      });
    } else if (offset >= 2 * sectionSize) {
      flatListRef.current?.scrollToOffset({
        offset: offset - sectionSize,
        animated: false,
      });
    }
  };

  const getItemLayout = (_: unknown, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  const handleWatchlistPress = (e: { stopPropagation: () => void }, item: Anime) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const malId = item.idMal;
    if (watchlistIds.includes(malId)) {
      dispatch(removeFromWatchlist(malId));
    } else {
      dispatch(
        addToWatchlist({
          malId,
          anilistId: item.id,
          title: item.title?.english || item.title?.romaji || 'Unknown',
          coverImage: item.coverImage?.large,
          addedAt: Date.now(),
        })
      );
    }
  };

  const renderItem = ({ item }: { item: Anime }) => {
    const inWatchlist = watchlistIds.includes(item.idMal);
    const title = item.title?.english || item.title?.romaji || 'Untitled';

    return (
      <Pressable
        onPress={() => router.push(`/(root)/anime/details/${item.idMal}`)}
        style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
        accessibilityLabel={`${title}. Double tap to open.`}
        accessibilityRole="button"
      >
        {/* 1. Blurred background — same image, cover, full hero */}
        <ImageWithFallback
          source={{ uri: item.bannerImage || item.coverImage?.large }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: SCREEN_WIDTH,
            height: HERO_HEIGHT,
          }}
          resizeMode="cover"
        />
        <BlurView
          intensity={80}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        {/* 2. Sharp image — aspect-ratio box on top */}
        <View
          style={{
            position: 'absolute',
            top: heroTop,
            left: 0,
            right: 0,
            width: SCREEN_WIDTH,
            aspectRatio: 16 / 9,
            overflow: 'hidden',
          }}
        >
          <ImageWithFallback
            source={{ uri: item.bannerImage || item.coverImage?.large }}
            style={{
              width: '100%',
              height: '100%',
            }}
            resizeMode="cover"
          />
        </View>
        <LinearGradient
          colors={[themeHex.heroGradientStart, themeHex.heroGradientEnd]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '75%',
          }}
        />
        {/* Watchlist button — below header overlay */}
        <View
          style={{
            position: 'absolute',
            top: heroTop + 12,
            right: PADDING_H,
          }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={(e) => handleWatchlistPress(e as unknown as { stopPropagation: () => void }, item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: themeHex.cardOverlay,
            }}
            accessibilityLabel={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            accessibilityRole="button"
          >
            <FontAwesomeIcon
              icon={inWatchlist ? faCheck : faPlus}
              size={11}
              color={HERO_TEXT}
            />
            <Text
              style={{
                color: HERO_TEXT,
                fontSize: 11,
                fontWeight: '600',
                marginLeft: 5,
              }}
            >
              {inWatchlist ? 'In list' : 'Watchlist'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Content */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: PADDING_H,
            right: PADDING_H + 90,
            paddingBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 23,
              fontWeight: '700',
              color: HERO_TEXT,
              textShadowColor: 'rgba(0,0,0,0.85)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 6,
              letterSpacing: -0.3,
              lineHeight: 28,
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <Text
            style={{
              color: HERO_TEXT_SECONDARY,
              fontSize: 13,
              marginTop: 6,
              lineHeight: 18,
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {shortenSynopsis(item.description || '')}
          </Text>
          <TouchableOpacity
            onPress={() => router.push(`/(root)/anime/details/${item.idMal}`)}
            activeOpacity={0.9}
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
            }}
            accessibilityLabel={`Play ${title}`}
            accessibilityRole="button"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: HERO_TEXT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faPlay} size={14} color="#0a0a0b" />
            </View>
            <Text style={{ color: HERO_TEXT, fontSize: 15, fontWeight: '600' }}>
              Play
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  if (n === 0) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <FlatList
        ref={flatListRef}
        data={infiniteData}
        renderItem={renderItem}
        keyExtractor={(item, index) => `hero-${item.idMal}-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={n > 1 ? middleStart : 0}
        getItemLayout={getItemLayout}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
      />
      {list.length > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
          }}
          accessibilityLabel={`Featured anime ${currentIndex + 1} of ${list.length}`}
        >
          {list.map((_, i) => (
            <View
              key={i}
              style={{
                width: currentIndex === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  currentIndex === i
                    ? ACCENT.primary
                    : isDark
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(0,0,0,0.2)',
              }}
              accessibilityElementsHidden
            />
          ))}
        </View>
      )}
    </View>
  );
}
