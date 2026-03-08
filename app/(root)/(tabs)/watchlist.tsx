import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBookmark, faTrash } from '@fortawesome/free-solid-svg-icons';
import { RootState } from '@/state/store';
import { removeFromWatchlist } from '@/state/watchlistSlice';
import { OverlayHeader } from '@/components/overlay-header';
import { useEdgeToEdgeInsets } from '@/hooks/useEdgeToEdgeInsets';
import { useThemeColors } from '@/hooks/useThemeColors';
import { BRAND } from '@/constants/colors';
import { SmartTitle } from '@/components/smart-title';
import BrandButton from '@/components/ui/brand-button';

export default function WatchlistScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const items = useSelector((state: RootState) => state.watchlist.items);
  const { bg, cardBg, text, subtext, border } = useThemeColors();
  const { overlayHeaderHeight, tabBarHeight } = useEdgeToEdgeInsets();

  if (items.length === 0) {
    return (
      <View className={`flex-1 ${bg}`}>
        <View style={{ flex: 1, paddingTop: overlayHeaderHeight, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
        <View
          className="w-24 h-24 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(74, 124, 124, 0.2)' }}
        >
          <FontAwesomeIcon icon={faBookmark} size={40} color={BRAND.primary} />
        </View>
        <Text className={`${text} text-2xl font-bold text-center`}>
          Your watchlist
        </Text>
        <Text
          className={`${subtext} text-center mt-3 leading-5`}
          style={{ maxWidth: 300 }}
        >
          Save shows you want to watch. Tap "Add to Watchlist" on any anime
          page, then find them here.
        </Text>
        <View className="mt-10 w-full">
          <BrandButton
            label="Discover anime"
            onPress={() => router.navigate('/(root)/(tabs)/home')}
            fullWidth
          />
        </View>
        </View>
        <OverlayHeader />
      </View>
    );
  }

  return (
    <View className={`flex-1 ${bg}`}>
      <View style={{ paddingTop: overlayHeaderHeight, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text className={`${text} text-xl font-bold`}>Your watchlist</Text>
        <Text className={`${subtext} text-sm mt-0.5`}>
          {items.length} show{items.length !== 1 ? 's' : ''} saved — tap to open
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => `watchlist-${item.malId}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: tabBarHeight + 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(root)/anime/details/${item.malId}`)}
            activeOpacity={0.9}
            className={`flex-row items-center ${cardBg} rounded-lg overflow-hidden mb-2 ${border}`}
            style={{
              borderWidth: 1,
              paddingVertical: 8,
              paddingLeft: 0,
              paddingRight: 10,
            }}
          >
            <Image
              source={{ uri: item.coverImage }}
              style={{ width: 56, height: 80, borderRadius: 6, marginRight: 12 }}
              resizeMode="cover"
            />
            <View className="flex-1 min-w-0">
              <SmartTitle
                title={item.title}
                maxLines={2}
                className={`${text} font-semibold text-sm`}
              />
              <Text className={`${subtext} text-xs mt-0.5`}>
                Tap to open
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                dispatch(removeFromWatchlist(item.malId));
              }}
              hitSlop={12}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faTrash} size={14} color={BRAND.destructive} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      <OverlayHeader />
    </View>
  );
}
