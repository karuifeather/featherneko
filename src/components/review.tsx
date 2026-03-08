import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faArrowLeft, faThumbsUp } from '@fortawesome/free-solid-svg-icons';
import { postJsonWithSourceHealth, fetchWithStaleFallback } from '@/cache/fetchWithSourceHealth';
import { RichContent } from '@/content/rich-text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { get, set } from '@/cache';

interface Review {
  id: number;
  body: string;
  summary: string;
  createdAt?: number;
  user: {
    name?: string;
    avatar?: {
      medium: string;
    };
  };
  rating: number;
  ratingAmount: number;
  score: number;
  userRating: string;
  media: {
    title: {
      english: string;
    };
  };
}

interface ScrollProps {
  onScroll: unknown;
  scrollEventThrottle: number;
}

const ReviewsComponent: React.FC<{ mal_id: number; scrollProps?: ScrollProps }> = ({ mal_id, scrollProps }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number | null>(null);
  const cooldownIntervalRef = useRef<any>(null);
  const retryTimeoutRef = useRef<any>(null);
  const { bg, cardBg, text, subtext, elevated, border } = useThemeColors();

  const COOLDOWN_SECONDS = 60;

  const fetchReviewsList = async () => {
    const cacheKey = String(mal_id);
    const cached = await get('ANILIST_REVIEWS', cacheKey);
    if (cached && Array.isArray(cached)) {
      setReviews(cached as Review[]);
      setRateLimited(false);
      setCooldownSecondsLeft(null);
      return;
    }

    const query = `
      query {
        Page {
          media(idMal_in: [${mal_id}], type: ANIME) {
            reviews(sort: RATING_DESC) {
              nodes {
                id
                summary
                createdAt
                user {
                  name
                  avatar {
                    medium
                  }
                }
                rating
                ratingAmount
                score
              }
              pageInfo {
                currentPage
                hasNextPage
                total
              }
            }
          }
        }
      }
    `;

    try {
      const fetchedReviews = await fetchWithStaleFallback(
        async () => {
          const c = await get('ANILIST_REVIEWS', cacheKey);
          return Array.isArray(c) ? (c as Review[]) : null;
        },
        async () => {
          const response = await postJsonWithSourceHealth(
            'https://graphql.anilist.co',
            { query },
            { source: 'anilist' }
          );
          const nodes =
            (response?.data as { data?: { Page?: { media?: Array<{ reviews?: { nodes?: unknown[] } }> } } })?.data?.Page?.media?.[0]?.reviews?.nodes ?? [];
          await set('ANILIST_REVIEWS', cacheKey, nodes);
          return nodes as Review[];
        },
        { source: 'anilist', allowStaleOnError: true, namespace: 'ANILIST_REVIEWS' }
      );
      setReviews(fetchedReviews ?? []);
      setRateLimited(false);
      setCooldownSecondsLeft(null);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        if (__DEV__) {
          console.warn('AniList rate limited (429); starting cooldown for reviews list.');
        }
        if (!rateLimited) {
          setRateLimited(true);
          setCooldownSecondsLeft(COOLDOWN_SECONDS);
          if (!cooldownIntervalRef.current) {
            cooldownIntervalRef.current = setInterval(() => {
              setCooldownSecondsLeft((prev) => {
                if (prev == null) return null;
                if (prev <= 1) return 0;
                return prev - 1;
              });
            }, 1000);
          }
          if (!retryTimeoutRef.current) {
            retryTimeoutRef.current = setTimeout(() => {
              retryTimeoutRef.current = null;
              // Let the next effect run fetchReviewsList again
              fetchReviewsList();
            }, COOLDOWN_SECONDS * 1000);
          }
        }
        return;
      }
      if (__DEV__) console.error('Error fetching reviews:', error as Error);
    }
  };

  useEffect(() => {
    fetchReviewsList();
  }, [mal_id]);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSelectedReview = (review: Review) => {
    const fetchReviews = async (id: string) => {
      const query = `
        query Review($reviewId: Int, $asHtml: Boolean) {
          Review(id: $reviewId) {
            body(asHtml: $asHtml)
            createdAt
            user {
              name
              avatar { medium }
            }
          }
        }
      `;
      try {
        const { data: res } = await postJsonWithSourceHealth(
          'https://graphql.anilist.co',
          { query, variables: { reviewId: id, asHtml: true } },
          { source: 'anilist' }
        );
        const r = (res as { data?: { Review?: { body?: string; createdAt?: number; user?: { name?: string; avatar?: { medium: string } } } } })?.data?.Review;
        setSelectedReview({
          ...review,
          body: r?.body ?? review.body,
          createdAt: r?.createdAt ?? review.createdAt,
          user: r?.user ? { name: r.user.name, avatar: r.user.avatar } : review.user,
        });
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          if (__DEV__) {
            console.warn('AniList rate limited (429); skipping review body.');
          }
          return;
        }
        if (__DEV__) console.error('Error fetching reviews:', error as Error);
      }
    };
    fetchReviews(review.id.toString());
  };

  function formatReviewDate(timestamp?: number): string {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const renderReviewSummary = ({ item }: { item: Review }) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => handleSelectedReview(item)}
      activeOpacity={0.85}
      className={`flex-row items-center p-3 ${cardBg} rounded-xl mb-2.5 border ${border} overflow-hidden`}
    >
      <Image
        source={{ uri: item.user?.avatar?.medium }}
        className="w-11 h-11 rounded-full"
        style={{ borderWidth: 2, borderColor: '#4a7c7c' }}
      />
      <View className="flex-1 ml-3 min-w-0">
        <Text
          className={`text-sm ${text} font-semibold`}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item.summary || 'No summary'}
        </Text>
        <View className="flex-row items-center mt-1">
          <FontAwesomeIcon icon={faThumbsUp} size={10} color="#4a7c7c" />
          <Text className={`${subtext} text-xs ml-1`}>
            {item.rating}/{item.ratingAmount} liked
          </Text>
        </View>
      </View>
      <View className="bg-primary w-10 h-10 rounded-full items-center justify-center ml-2">
        <Text className="text-primary-foreground text-sm font-bold">
          {item.score ?? '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const ScrollComp = ScrollView;
  const ListComp = FlatList;

  const renderReviewDetails = () => {
    const approval =
      selectedReview?.ratingAmount && selectedReview.ratingAmount > 0
        ? ((selectedReview.rating! / selectedReview.ratingAmount) * 100).toFixed(1)
        : '—';
    const userName = selectedReview?.user?.name ?? 'Anonymous';
    const dateStr = formatReviewDate(selectedReview?.createdAt);

    return (
      <View className={`flex-1 ${bg}`}>
        <View className={`flex-row items-center p-3 ${cardBg} border-b ${border}`}>
          <TouchableOpacity
            onPress={() => setSelectedReview(null)}
            className="flex-row items-center py-2 pr-4"
          >
            <FontAwesomeIcon icon={faArrowLeft} size={18} color="#4a7c7c" />
            <Text className="text-primary font-semibold ml-2">Reviews</Text>
          </TouchableOpacity>
        </View>
        <ScrollComp
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onScroll={scrollProps?.onScroll}
          scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
        >
          {/* Article header */}
          <Text
            className={`${text} text-2xl font-bold leading-tight mb-4`}
            style={{ lineHeight: 32 }}
          >
            {selectedReview?.summary}
          </Text>
          <View className={`flex-row items-center mb-6 pb-4 border-b ${border}`}>
            <Image
              source={{ uri: selectedReview?.user?.avatar?.medium }}
              className="w-10 h-10 rounded-full"
              style={{ borderWidth: 1, borderColor: 'rgba(74, 124, 124, 0.5)' }}
            />
            <View className="ml-3 flex-1 min-w-0">
              <Text className={`${text} font-semibold text-sm`}>{userName}</Text>
              {dateStr ? (
                <Text className={`${subtext} text-xs mt-0.5`}>{dateStr}</Text>
              ) : null}
            </View>
            <View className="flex-row items-center">
              <View className="bg-primary rounded-full w-10 h-10 items-center justify-center">
                <Text className="text-primary-foreground text-sm font-bold">
                  {selectedReview?.score ?? '—'}
                </Text>
              </View>
              <Text className={`${subtext} text-xs ml-2`}>Score</Text>
            </View>
          </View>

          {/* Article body */}
          <View className={`${elevated} rounded-xl px-4 py-5 mb-6`}>
            <RichContent
              content={selectedReview?.body || ''}
              source="anilist-review"
            />
          </View>

          {/* Article footer / meta */}
          <View
            className={`flex-row items-center justify-between ${cardBg} rounded-xl p-4 border ${border}`}
          >
            <View className="flex-row items-center">
              <FontAwesomeIcon icon={faThumbsUp} size={16} color="#4a7c7c" />
              <Text className={`${text} font-semibold ml-2`}>{approval}%</Text>
              <Text className={`${subtext} text-sm ml-1`}>approval</Text>
            </View>
            <Text className={`${subtext} text-sm`}>
              {selectedReview?.rating} of {selectedReview?.ratingAmount} users liked this review
            </Text>
          </View>
        </ScrollComp>
      </View>
    );
  };

  return (
    <View className={`flex-1 ${bg}`}>
      {selectedReview ? (
        renderReviewDetails()
      ) : (
        <ListComp
          data={reviews}
          keyExtractor={(item) => `review-${item.id}`}
          renderItem={renderReviewSummary}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onScroll={scrollProps?.onScroll}
          scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
          ListEmptyComponent={
            <View className="py-8">
              {rateLimited && cooldownSecondsLeft != null ? (
                <>
                  <Text className={`${subtext} text-center mb-1`}>
                    Reviews are temporarily rate-limited by AniList.
                  </Text>
                  <Text className={`${subtext} text-center`}>
                    Fetching again in ~{cooldownSecondsLeft}s…
                  </Text>
                </>
              ) : (
                <Text className={`${subtext} text-center`}>No reviews yet.</Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

export default ReviewsComponent;
