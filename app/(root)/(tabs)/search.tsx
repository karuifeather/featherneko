import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimeClient, Anime, JikanResponse } from '@tutkli/jikan-ts';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faArrowRight, faSearch } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import ErrorMessage from '@/components/error-message';
import { useEdgeToEdgeInsets } from '@/hooks/useEdgeToEdgeInsets';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SmartTitle } from '@/components/smart-title';
import { ExpandableDescription } from '@/components/expandable-description';
import BrandButton from '@/components/ui/brand-button';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { SearchResultSkeleton } from '@/components/ui/skeleton';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';
import { ACCENT } from '@/constants/colors';

const animeClient = new AnimeClient();

type SortOption = 'relevance' | 'score' | 'title' | 'popularity';

export default function SearchResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bg, elevated, text, textSecondary, hex } =
    useThemeColors();
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  useEffect(() => {
    if (keyword.trim().length > 0) {
      fetchSearchResults();
    }
  }, [keyword]);

  const fetchSearchResults = async () => {
    if (!keyword.trim()) return;
    setError(null);
    try {
      const response: JikanResponse<Anime[]> =
        await animeClient.getAnimeSearch({
          q: keyword,
          limit: 25,
        });
      setSearchResults(response.data ?? []);
    } catch (err) {
      if (__DEV__) console.error('Error fetching search results:', err);
      setError('Failed to load results. Check your connection.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (sortBy === 'relevance' || searchResults.length === 0) return searchResults;
    const copy = [...searchResults];
    if (sortBy === 'score') {
      copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else if (sortBy === 'title') {
      copy.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    } else if (sortBy === 'popularity') {
      copy.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    }
    return copy;
  }, [searchResults, sortBy]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setLoading(true);
      setKeyword(searchQuery.trim());
    }
  };

  const { tabBarHeight } = useEdgeToEdgeInsets();
  /** Search bar: insets.top + outer padding + input row ~56 + outer padding ≈ 84 */
  const searchBarTotalHeight = insets.top + 84;
  const contentTopOffset = searchBarTotalHeight + 8;

  return (
    <View style={{ flex: 1 }} className={bg}>
      {/* Search bar — status bar clearance only */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          zIndex: 10,
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: hex.surface,
          borderBottomWidth: 1,
          borderBottomColor: hex.border,
        }}
      >
        <View
          className={`flex-row items-center rounded-xl px-4 py-3 ${elevated}`}
          style={{
            borderWidth: 1,
            borderColor: isFocused ? ACCENT.primary : hex.border,
          }}
        >
          <FontAwesomeIcon
            icon={faSearch}
            size={18}
            color={isFocused ? ACCENT.primary : hex.textTertiary}
          />
          <TextInput
            style={{
              flex: 1,
              color: hex.text,
              marginLeft: 12,
              fontSize: 16,
            }}
            placeholder="Search anime by title..."
            placeholderTextColor={hex.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={handleSearch}
            accessibilityLabel="Search anime"
          />
          <TouchableOpacity
            onPress={handleSearch}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: ACCENT.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Search"
            accessibilityRole="button"
          >
            <FontAwesomeIcon icon={faArrowRight} size={16} color={ACCENT.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content area — below search bar */}
      <View style={{ flex: 1, paddingTop: contentTopOffset }}>
      {/* Sort pills — lightweight rail */}
      {!loading && searchResults.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
          className={bg}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: hex.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginRight: 8,
            }}
          >
            Sort
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4 }}
          >
            {(['relevance', 'score', 'title', 'popularity'] as SortOption[]).map(
              (opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setSortBy(opt)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: sortBy === opt ? 'rgba(74,124,124,0.25)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: sortBy === opt ? ACCENT.primary : 'transparent',
                  }}
                  accessibilityLabel={`Sort by ${opt}`}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: sortBy === opt ? ACCENT.primary : hex.textTertiary,
                    }}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, padding: 16 }}>
          <SearchResultSkeleton />
          <SearchResultSkeleton />
          <SearchResultSkeleton />
          <SearchResultSkeleton />
        </View>
      ) : error ? (
        <View className={`flex-1 p-4 ${bg}`}>
          <ErrorMessage message={error} onRetry={fetchSearchResults} />
        </View>
      ) : !keyword.trim().length ? (
        <View className={`flex-1 justify-center items-center px-10 ${bg}`}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: hex.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <FontAwesomeIcon icon={faSearch} size={36} color={hex.textTertiary} />
          </View>
          <Text
            className={text}
            style={{
              fontSize: TYPOGRAPHY.screenTitle.fontSize,
              fontWeight: TYPOGRAPHY.screenTitle.fontWeight,
              textAlign: 'center',
            }}
          >
            Discover anime
          </Text>
          <Text
            className={textSecondary}
            style={{
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 22,
              maxWidth: 280,
            }}
          >
            Search by title to find shows, then tap to see details and add to
            your watchlist.
          </Text>
          <View style={{ marginTop: 32, width: '100%' }}>
            <BrandButton
              label="Browse home"
              onPress={() => router.navigate('/(root)/(tabs)/home')}
              fullWidth
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={sortedResults}
          keyExtractor={(item) => `search-${item.mal_id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 32, flexGrow: 1 }}
          ListHeaderComponent={
            sortedResults.length > 0 ? (
              <Text
                className={textSecondary}
                style={{ fontSize: 13, marginBottom: 16 }}
              >
                {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''} for "{keyword}"
              </Text>
            ) : null
          }
          ListEmptyComponent={
            sortedResults.length === 0 && keyword ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: hex.elevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}
                >
                  <FontAwesomeIcon icon={faSearch} size={32} color={hex.textTertiary} />
                </View>
                <Text
                  style={{ fontSize: TYPOGRAPHY.screenTitle.fontSize, fontWeight: '600', color: hex.text }}
                >
                  No results found
                </Text>
                <Text
                  style={{ fontSize: 14, color: hex.textSecondary, marginTop: 8, textAlign: 'center' }}
                >
                  Try a different search term or browse from home.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(root)/anime/details/${item.mal_id}`);
              }}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                padding: 10,
                backgroundColor: hex.surface,
                borderRadius: RADIUS.card,
                marginBottom: 8,
                overflow: 'hidden',
              }}
              accessibilityLabel={`${item.title ?? 'Untitled'}. Double tap to open.`}
              accessibilityRole="button"
            >
              <View style={{ position: 'relative' }}>
                <ImageWithFallback
                  source={{ uri: item.images?.jpg?.image_url }}
                  style={{
                    width: 80,
                    height: 114,
                    borderRadius: RADIUS.poster,
                  }}
                  resizeMode="cover"
                  fadeInDuration={250}
                />
                {item.score != null && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 3,
                      left: 3,
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      borderRadius: 3,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      ★ {item.score}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10, minWidth: 0, justifyContent: 'center' }}>
                <SmartTitle
                  title={item.title ?? 'Untitled'}
                  maxLines={2}
                  className={`${text} font-semibold`}
                />
                <View style={{ marginTop: 2 }}>
                  <ExpandableDescription
                    text={item.synopsis || 'No synopsis available.'}
                    maxLines={2}
                    textClassName={`${textSecondary}`}
                    linkClassName="text-primary font-medium text-xs"
                  />
                </View>
                <Text
                  className={textSecondary}
                  style={{ marginTop: 4, fontSize: 11 }}
                >
                  {item.episodes ?? '?'} eps
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      </View>
    </View>
  );
}
