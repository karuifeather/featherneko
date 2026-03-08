import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import {
  formatLocalTime,
  formatLocalDateString,
  getTodayDateString,
  getDateStringForOffset,
  getTimeZoneLabel,
} from '@/utils/dateTime';
import { useThemeColors } from '@/hooks/useThemeColors';

const ANILIST = 'https://graphql.anilist.co';
const PER_PAGE = 50;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const query = `
  query ($perPage: Int, $airingAtGreater: Int) {
    Page(page: 1, perPage: $perPage) {
      airingSchedules(
        sort: TIME
        airingAt_greater: $airingAtGreater
      ) {
        id
        airingAt
        episode
        media {
          id
          idMal
          title { romaji english }
          coverImage { large }
        }
      }
    }
  }
`;

type AiringItem = {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    idMal: number;
    title: { romaji: string; english: string };
    coverImage: { large: string };
  };
};

type DaySection = {
  label: string;
  items: AiringItem[];
};

function getDayBounds(dayOffset: number): { start: number; end: number } {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(0, 0, 0, 0);
  const start = Math.floor(d.getTime() / 1000);
  d.setHours(23, 59, 59, 999);
  const end = Math.floor(d.getTime() / 1000);
  return { start, end };
}

function buildThreeDays(schedules: AiringItem[]): DaySection[] {
  const yesterdayStr = getDateStringForOffset(-1);
  const todayStr = getTodayDateString();
  const tomorrowStr = getDateStringForOffset(1);

  const byDay: Record<string, AiringItem[]> = {
    [yesterdayStr]: [],
    [todayStr]: [],
    [tomorrowStr]: [],
  };

  schedules.forEach((s) => {
    const key = formatLocalDateString(s.airingAt);
    if (key in byDay) {
      byDay[key].push(s);
    }
  });

  const sortByTime = (items: AiringItem[]) =>
    [...items].sort((a, b) => a.airingAt - b.airingAt);

  return [
    { label: 'Yesterday', items: sortByTime(byDay[yesterdayStr]) },
    { label: 'Today', items: sortByTime(byDay[todayStr]) },
    { label: 'Tomorrow', items: sortByTime(byDay[tomorrowStr]) },
  ];
}

function DayTabStrip({
  currentIndex,
  onSelect,
  cardBg,
  text,
  subtext,
}: {
  currentIndex: number;
  onSelect: (index: number) => void;
  cardBg: string;
  text: string;
  subtext: string;
}) {
  const labels = ['Yesterday', 'Today', 'Tomorrow'];
  return (
    <View className="flex-row px-4 py-3 gap-2">
      {labels.map((label, index) => (
        <TouchableOpacity
          key={label}
          onPress={() => onSelect(index)}
          className={`flex-1 py-2.5 rounded-lg items-center ${
            currentIndex === index ? 'bg-primary' : cardBg
          }`}
        >
          <Text
            className={`font-semibold ${
              currentIndex === index ? 'text-primary-foreground' : subtext
            }`}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const EPISODE_ROW_HEIGHT = 84;

function getTodayScrollIndex(items: AiringItem[]): number {
  if (items.length === 0) return 0;
  const now = Math.floor(Date.now() / 1000);
  const idx = items.findIndex((s) => s.airingAt >= now);
  return idx >= 0 ? idx : Math.max(0, items.length - 1);
}

function EpisodeCard({
  item,
  onPress,
  cardBg,
  text,
  subtext,
}: {
  item: AiringItem;
  onPress: () => void;
  cardBg: string;
  text: string;
  subtext: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center ${cardBg} rounded-lg p-2 mb-1 mx-4`}
    >
      <Image
        source={{ uri: item.media.coverImage.large }}
        style={{ width: 44, height: 62, borderRadius: 6 }}
      />
      <View className="flex-1 ml-2.5 justify-center min-w-0">
        <Text className={`${text} font-semibold text-sm`} numberOfLines={1}>
          {item.media.title.english || item.media.title.romaji}
        </Text>
        <Text className={`${subtext} text-xs mt-0.5`}>
          Ep {item.episode} · {formatLocalTime(item.airingAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bg, cardBg, text, subtext, border } = useThemeColors();
  const pagerRef = useRef<FlatList>(null);
  const todayListRef = useRef<FlatList>(null);
  const prevDayIndexRef = useRef<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<AiringItem[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(1);

  const { start: startYesterday } = useMemo(() => getDayBounds(-1), []);

  const days = useMemo(() => buildThreeDays(schedules), [schedules]);

  const todayScrollIndex = useMemo(
    () => (days[1] ? getTodayScrollIndex(days[1].items) : 0),
    [days]
  );

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(ANILIST, {
        query,
        variables: {
          perPage: PER_PAGE,
          airingAtGreater: startYesterday,
        },
      });

      const pageData = data?.data?.Page;
      const items = (pageData?.airingSchedules ?? []) as AiringItem[];
      setSchedules(items);
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 429
          ? 'Too many requests. Wait a moment and try again.'
          : err?.message ?? 'Failed to load schedule.'
      );
    } finally {
      setLoading(false);
    }
  }, [startYesterday]);

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    if (currentDayIndex === 1 && todayListRef.current != null) {
      todayListRef.current.scrollToIndex({
        index: todayScrollIndex,
        animated: prevDayIndexRef.current !== 1,
      });
    }
    prevDayIndexRef.current = currentDayIndex;
  }, [currentDayIndex, todayScrollIndex]);

  const onPagerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / SCREEN_WIDTH);
      if (index >= 0 && index <= 2 && index !== currentDayIndex)
        setCurrentDayIndex(index);
    },
    [currentDayIndex]
  );

  const onSelectDay = useCallback((index: number) => {
    setCurrentDayIndex(index);
    pagerRef.current?.scrollToOffset({
      offset: index * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  const renderDayPage = useCallback(
    ({ item }: { item: DaySection }) => {
      const isToday = item.label === 'Today';
      return (
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <FlatList
            ref={isToday ? todayListRef : undefined}
            data={item.items}
            keyExtractor={(s) => String(s.id)}
            renderItem={({ item: s }) => (
              <View style={{ height: EPISODE_ROW_HEIGHT, justifyContent: 'center', paddingVertical: 2 }}>
                <EpisodeCard
                  item={s}
                  onPress={() => router.push(`/(root)/anime/details/${s.media.idMal}`)}
                  cardBg={cardBg}
                  text={text}
                  subtext={subtext}
                />
              </View>
            )}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            getItemLayout={(_, i) => ({
              length: EPISODE_ROW_HEIGHT,
              offset: EPISODE_ROW_HEIGHT * i,
              index: i,
            })}
            initialScrollIndex={isToday ? todayScrollIndex : 0}
            ListEmptyComponent={
              <Text className={`${subtext} text-center mt-8 px-4`}>
                No episodes this day
              </Text>
            }
          />
        </View>
      );
    },
    [router, todayScrollIndex, cardBg, text, subtext]
  );

  if (loading) {
    return (
      <View className={`flex-1 ${bg} justify-center items-center`} style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <ActivityIndicator size="large" color="#4a7c7c" />
        <Text className={`${subtext} mt-4`}>Loading schedule...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 ${bg} justify-center items-center p-4`} style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Text className={`${subtext} text-center mb-4`}>{error}</Text>
        <TouchableOpacity
          onPress={loadSchedule}
          className="bg-primary px-4 py-2 rounded-lg"
        >
          <Text className="text-primary-foreground font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${bg}`} style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className={`border-b ${border}`}>
        <Text className={`${text} text-xl font-bold px-4 pt-4`}>
          Airing schedule
        </Text>
        <Text className={`${subtext} text-xs px-4 pb-1.5`} style={{ opacity: 0.9 }}>
          Soonest at top · times in {getTimeZoneLabel()}
        </Text>
        <DayTabStrip currentIndex={currentDayIndex} onSelect={onSelectDay} cardBg={cardBg} text={text} subtext={subtext} />
      </View>

      <FlatList
        ref={pagerRef}
        data={days}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        onScrollEndDrag={onPagerScroll}
        keyExtractor={(d) => d.label}
        renderItem={renderDayPage}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        initialScrollIndex={1}
        style={{ flex: 1 }}
      />
    </View>
  );
}
