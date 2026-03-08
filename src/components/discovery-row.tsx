import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';

type RecItem = {
  idMal: number;
  title: { romaji: string; english: string };
  coverImage: { large: string };
};

type Props = {
  recs?: RecItem[];
  sourceTitle?: string | null;
};

export default function DiscoveryRow({ recs = [], sourceTitle = null }: Props) {
  const router = useRouter();
  const { text } = useThemeColors();

  if (recs.length === 0) return null;

  return (
    <View className="my-5">
      <View className="flex-row items-center px-4" style={{ minWidth: 0 }}>
        <Text
          className={`text-xl font-bold ${text}`}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flex: 1 }}
        >
          {sourceTitle
          ? `Because you watched ${sourceTitle}`
          : 'Recommended for you'}
        </Text>
      </View>
      <ScrollView
        horizontal
        className="mt-3 mx-4"
        contentContainerStyle={{ gap: 16 }}
        showsHorizontalScrollIndicator={false}
      >
        {recs.map((anime) => (
          <TouchableOpacity
            key={anime.idMal}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/(root)/anime/details/${anime.idMal}`);
            }}
            activeOpacity={0.85}
            style={{ width: 128 }}
            accessibilityLabel={`${anime.title?.english ?? anime.title?.romaji ?? 'Unknown'}. Double tap to open.`}
            accessibilityRole="button"
          >
            <ImageWithFallback
              source={{ uri: anime.coverImage?.large }}
              style={{
                width: 128,
                height: 192,
                borderRadius: RADIUS.poster,
              }}
              resizeMode="cover"
              fadeInDuration={250}
            />
            <Text
              className={`${text} text-sm font-semibold mt-2`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {anime.title?.english ?? anime.title?.romaji ?? 'Unknown'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
