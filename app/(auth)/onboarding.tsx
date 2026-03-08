import { useRouter } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faSearch,
  faHeart,
  faPlay,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { useRef, useState } from 'react';
import { useThemeColors } from '@/hooks/useThemeColors';

const { width } = Dimensions.get('window');
const PRIMARY = '#4a7c7c';

interface Slide {
  id: string;
  title: string;
  description: string;
  icon: IconDefinition;
}

const slides: Slide[] = [
  {
    id: '1',
    title: 'Search & discover',
    description: 'Find any anime by title. Browse trending, this season, and top picks.',
    icon: faSearch,
  },
  {
    id: '2',
    title: 'Track what you love',
    description: 'Save to your watchlist and keep a history of what you’ve watched.',
    icon: faHeart,
  },
  {
    id: '3',
    title: 'Watch and continue',
    description: 'Stream episodes and pick up exactly where you left off.',
    icon: faPlay,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { bg, text, subtext } = useThemeColors();
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<Slide> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = Animated.event<NativeSyntheticEvent<NativeScrollEvent>>(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: Array<{ index: number | null }>;
  }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  };

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  const goToNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.push('./auth');
    }
  };

  return (
    <View className={`flex-1 ${bg}`}>
      <View className="absolute inset-0">
        <View className="absolute top-[-10%] right-[-5%] w-64 h-64 rounded-full opacity-[0.06]" style={{ backgroundColor: PRIMARY }} />
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 items-center justify-center px-10">
            <View
              className="w-28 h-28 rounded-3xl items-center justify-center mb-8"
              style={{ backgroundColor: `${PRIMARY}18` }}
            >
              <FontAwesomeIcon icon={item.icon} size={44} color={PRIMARY} />
            </View>
            <Text className={`${text} text-2xl font-bold text-center max-w-[280px]`}>
              {item.title}
            </Text>
            <Text className={`${subtext} text-base text-center mt-3 max-w-[300px] leading-6`}>
              {item.description}
            </Text>
          </View>
        )}
      />

      {/* Progress bar */}
      <View className="absolute left-0 right-0 px-10" style={{ bottom: insets.bottom + 80 }}>
        <View className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${PRIMARY}22` }}>
          <Animated.View
            className="h-full rounded-full"
            style={{
              width: `${((currentIndex + 1) / slides.length) * 100}%`,
              backgroundColor: PRIMARY,
            }}
          />
        </View>
      </View>

      <View className="absolute left-0 right-0 flex-row justify-between items-center px-8" style={{ bottom: insets.bottom + 16 }}>
        <Pressable
          onPress={() => router.push('./auth')}
          className="py-3.5 px-5 rounded-xl active:opacity-70"
          style={{ minHeight: 48 }}
          android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
        >
          <Text className={`text-base font-medium ${subtext}`}>Skip</Text>
        </Pressable>
        <Pressable
          onPress={goToNext}
          className="py-3.5 px-8 rounded-xl active:opacity-90"
          style={{ backgroundColor: PRIMARY, minHeight: 48 }}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <Text className="text-base font-semibold text-white">
            {currentIndex === slides.length - 1 ? 'Continue' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
