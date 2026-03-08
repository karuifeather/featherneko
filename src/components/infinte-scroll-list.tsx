import axios from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TYPOGRAPHY, RADIUS, SPACING } from '@/constants/designTokens';

const InfiniteScrollAnime = ({
  query,
  vars,
  title,
}: {
  query: string;
  vars?: any;
  title: string;
}) => {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hex } = useThemeColors();

  const fetchAnime = async (pageNumber: number) => {
    setLoading(true);

    const variables = {
      ...vars,
      page: pageNumber,
      perPage: 12,
    };

    try {
      const response = await axios.post(
        'https://graphql.anilist.co',
        {
          query,
          variables,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const newAnime = response.data.data.Page.media;
      const { hasNextPage } = response.data.data.Page.pageInfo;

      setAnimeList((prev) => [...prev, ...newAnime]);
      setHasNextPage(hasNextPage);
    } catch (error) {
      if (__DEV__) console.error('Error fetching trending anime:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreAnime = () => {
    if (hasNextPage && !loading) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  useEffect(() => {
    fetchAnime(page);
  }, [page]);

  const renderAnimeItem = ({ item }: { item: any }) => {
    const animeTitle = item.title?.english || item.title?.romaji || 'Unknown Title';
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/(root)/anime/details/${item.idMal}`);
        }}
        activeOpacity={0.85}
        style={{ width: '30%', marginBottom: 16 }}
        accessibilityLabel={`${animeTitle}. Double tap to open.`}
        accessibilityRole="button"
      >
        <Image
          source={{ uri: item.coverImage?.large }}
          style={{
            width: '100%',
            aspectRatio: 3 / 4,
            borderRadius: RADIUS.poster,
          }}
          resizeMode="cover"
        />
        <Text
          style={{
            fontSize: TYPOGRAPHY.cardTitle.fontSize - 1,
            fontWeight: '600',
            color: hex.text,
            marginTop: 6,
          }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {animeTitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[{ flex: 1, backgroundColor: hex.bg }]}>
      {/* Header — status bar clearance + back + title */}
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
              fontSize: TYPOGRAPHY.screenTitle.fontSize,
              fontWeight: '700',
              color: hex.text,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: SPACING.base }}>
        <FlatList
          data={animeList}
          renderItem={renderAnimeItem}
          keyExtractor={(item) => `shelf-${item.idMal}-${item.id}`}
          numColumns={3}
          columnWrapperStyle={{
            justifyContent: 'space-between',
          }}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: insets.bottom + 80,
          }}
          onEndReached={loadMoreAnime}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#4a7c7c" />
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
};

export default InfiniteScrollAnime;
