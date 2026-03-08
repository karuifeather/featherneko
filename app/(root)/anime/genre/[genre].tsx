import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';

import { postJsonWithSourceHealth } from '@/cache/fetchWithSourceHealth';
import { fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { get, set } from '@/cache';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ACCENT } from '@/constants/colors';
import { TYPOGRAPHY, RADIUS, SPACING } from '@/constants/designTokens';

type SortOption =
  | 'POPULARITY_DESC'
  | 'TRENDING_DESC'
  | 'SCORE_DESC'
  | 'TITLE_ROMAJI'
  | 'START_DATE_DESC'
  | 'FAVOURITES_DESC';
type StatusFilter = 'ALL' | 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED';
type FormatFilter = 'ALL' | 'TV' | 'TV_SHORT' | 'MOVIE' | 'OVA' | 'ONA';

const SORT_LABELS: Record<SortOption, string> = {
  POPULARITY_DESC: 'Popular',
  TRENDING_DESC: 'Trending',
  SCORE_DESC: 'Score',
  TITLE_ROMAJI: 'A–Z',
  START_DATE_DESC: 'Newest',
  FAVOURITES_DESC: 'Favorites',
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  RELEASING: 'Airing',
  FINISHED: 'Completed',
  NOT_YET_RELEASED: 'Upcoming',
};

const FORMAT_LABELS: Record<FormatFilter, string> = {
  ALL: 'All',
  TV: 'TV',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
};

const GENRE_QUERY = `
  query ($genre: String, $page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $format: MediaFormat) {
    Page(page: $page, perPage: $perPage) {
      media(
        genre: $genre
        type: ANIME
        sort: $sort
        status: $status
        format: $format
        isAdult: false
      ) {
        id
        idMal
        title { romaji english }
        coverImage { large }
        averageScore
        episodes
      }
      pageInfo {
        currentPage
        hasNextPage
      }
    }
  }
`;

interface MediaItem {
  id: number;
  idMal: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string };
  averageScore?: number | null;
  episodes?: number | null;
}

export default function GenreScreen() {
  const { genre } = useLocalSearchParams<{ genre: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bg, text, textSecondary, hex } = useThemeColors();

  const decodedGenre = genre ? decodeURIComponent(String(genre)) : '';
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [sort, setSort] = useState<SortOption>('POPULARITY_DESC');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('ALL');

  const buildCacheKey = useCallback(
    (pageNum: number) =>
      `${decodedGenre}|${sort}|${statusFilter}|${formatFilter}|${pageNum}`,
    [decodedGenre, sort, statusFilter, formatFilter]
  );

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!decodedGenre) return;
      const cacheKey = buildCacheKey(pageNum);

      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        if (pageNum === 1 && !append) {
          const cached = await get('ANILIST_GENRE_PAGE', cacheKey);
          if (
            cached &&
            typeof cached === 'object' &&
            'media' in cached &&
            Array.isArray((cached as { media: MediaItem[] }).media)
          ) {
            const payload = cached as {
              media: MediaItem[];
              pageInfo: { hasNextPage: boolean };
            };
            setItems(payload.media);
            setHasNextPage(payload.pageInfo?.hasNextPage ?? false);
            setLoading(false);
            return;
          }
        }

        const getCached = async () => {
          const cached = await get('ANILIST_GENRE_PAGE', cacheKey);
          if (
            cached &&
            typeof cached === 'object' &&
            'media' in cached &&
            Array.isArray((cached as { media: MediaItem[] }).media)
          ) {
            return cached as { media: MediaItem[]; pageInfo: { hasNextPage: boolean } };
          }
          return null;
        };

        const fetcher = async () => {
          const variables: Record<string, unknown> = {
            genre: decodedGenre,
            page: pageNum,
            perPage: 20,
            sort: [sort],
          };
          if (statusFilter !== 'ALL') variables.status = statusFilter;
          if (formatFilter !== 'ALL') variables.format = formatFilter;

          const res = await postJsonWithSourceHealth<{
            data?: {
              Page?: {
                media?: MediaItem[];
                pageInfo?: { currentPage: number; hasNextPage: boolean };
              };
            };
          }>(
            'https://graphql.anilist.co',
            { query: GENRE_QUERY, variables },
            { source: 'anilist' }
          );

          const media = res.data?.data?.Page?.media ?? [];
          const pageInfo = res.data?.data?.Page?.pageInfo ?? { hasNextPage: false };
          const payload = { media, pageInfo };
          await set('ANILIST_GENRE_PAGE', cacheKey, payload);
          return payload;
        };

        const payload = await fetchWithStaleFallback(getCached, fetcher, {
          source: 'anilist',
          allowStaleOnError: true,
          namespace: 'ANILIST_GENRE_PAGE',
        });

        setItems((prev) => (append ? [...prev, ...payload.media] : payload.media));
        setHasNextPage(payload.pageInfo?.hasNextPage ?? false);
      } catch (err) {
        if (__DEV__) console.error('Genre fetch error:', err);
        setError('Failed to load. Pull to retry.');
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [decodedGenre, sort, statusFilter, formatFilter, buildCacheKey]
  );

  useEffect(() => {
    if (decodedGenre) {
      setPage(1);
      fetchPage(1, false);
    }
  }, [decodedGenre, sort, statusFilter, formatFilter]);

  const loadMore = () => {
    if (!hasNextPage || loadingMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, true);
  };

  const displayTitle = decodedGenre || 'Genre';

  return (
    <View style={[{ flex: 1, backgroundColor: hex.bg }]}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: SPACING.base,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: hex.border,
          backgroundColor: hex.surface,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: hex.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
          hitSlop={8}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <FontAwesomeIcon icon={faChevronLeft} size={18} color={hex.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: TYPOGRAPHY.caption.fontSize,
              fontWeight: '600',
              color: hex.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Genre
          </Text>
          <Text
            style={{
              fontSize: TYPOGRAPHY.screenTitle.fontSize,
              fontWeight: '700',
              color: hex.text,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayTitle}
          </Text>
        </View>
      </View>

      {/* Sort & Filter rail — compact, label on one line, chips horizontal */}
      {decodedGenre && (
        <View
          style={{
            paddingHorizontal: SPACING.base,
            paddingVertical: SPACING.xs + 2,
            borderBottomWidth: 1,
            borderBottomColor: hex.border,
            backgroundColor: hex.surface,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: hex.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, width: 36 }}>
              Sort
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4, flexGrow: 1 }}
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSort(opt);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: RADIUS.sm,
                    backgroundColor: sort === opt ? ACCENT.primary : 'rgba(255,255,255,0.06)',
                  }}
                  accessibilityLabel={`Sort by ${SORT_LABELS[opt]}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === opt }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: sort === opt ? ACCENT.primaryForeground : hex.textTertiary,
                    }}
                  >
                    {SORT_LABELS[opt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: hex.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, width: 36 }}>
              Status
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4 }}
            >
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStatusFilter(opt);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: RADIUS.sm,
                    backgroundColor: statusFilter === opt ? 'rgba(74,124,124,0.25)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: statusFilter === opt ? ACCENT.primary : 'transparent',
                  }}
                  accessibilityLabel={`Filter: ${STATUS_LABELS[opt]}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: statusFilter === opt }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: statusFilter === opt ? ACCENT.primary : hex.textTertiary,
                    }}
                  >
                    {STATUS_LABELS[opt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: hex.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, width: 36 }}>
              Format
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4 }}
            >
              {(Object.keys(FORMAT_LABELS) as FormatFilter[]).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFormatFilter(opt);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: RADIUS.sm,
                    backgroundColor: formatFilter === opt ? 'rgba(74,124,124,0.25)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: formatFilter === opt ? ACCENT.primary : 'transparent',
                  }}
                  accessibilityLabel={`Format: ${FORMAT_LABELS[opt]}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: formatFilter === opt }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: formatFilter === opt ? ACCENT.primary : hex.textTertiary,
                    }}
                  >
                    {FORMAT_LABELS[opt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={ACCENT.primary} />
          <Text style={{ fontSize: 15, color: hex.textSecondary, marginTop: 16 }}>
            Loading…
          </Text>
        </View>
      ) : error && items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: hex.textSecondary, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.idMal ?? item.id)}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: 'space-between',
            paddingHorizontal: SPACING.base,
            marginBottom: SPACING.base,
          }}
          contentContainerStyle={{ paddingVertical: SPACING.base, paddingBottom: 48 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={ACCENT.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const title = item.title?.english || item.title?.romaji || 'Untitled';
            return (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(root)/anime/details/${item.idMal}`);
                }}
                activeOpacity={0.85}
                style={{ width: '48%' }}
                accessibilityLabel={`${title}. Double tap to open.`}
                accessibilityRole="button"
              >
                <View style={{ position: 'relative' }}>
                  <ImageWithFallback
                    source={{ uri: item.coverImage?.large }}
                    style={{
                      width: '100%',
                      aspectRatio: 3 / 4,
                      borderRadius: RADIUS.poster,
                    }}
                    resizeMode="cover"
                    fadeInDuration={250}
                  />
                  {item.averageScore != null && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 6,
                        backgroundColor: 'rgba(0,0,0,0.75)',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                        ★ {item.averageScore.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: TYPOGRAPHY.cardTitle.fontSize,
                    fontWeight: '600',
                    color: hex.text,
                    marginTop: 8,
                  }}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {title}
                </Text>
                {item.episodes != null && (
                  <Text
                    style={{
                      fontSize: TYPOGRAPHY.caption.fontSize,
                      color: hex.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {item.episodes} eps
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
