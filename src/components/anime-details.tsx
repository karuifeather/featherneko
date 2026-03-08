import { useState, useEffect } from 'react';
import { useSelectedAnime } from '@/context/anime-provider';
import { Anime, DateDetails } from '@/types';
import { formatLocalTime, getTimeZoneLabel } from '@/utils/dateTime';
import {
  faCalendarAlt,
  faChartLine,
  faFilm,
  faHeart,
  faPlayCircle,
  faSquare,
  faStar,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ExpandableRichContent } from '@/content/rich-text';
import { MetadataRow } from '@/components/ui/metadata-row';
import { ACCENT } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/designTokens';

interface NextAiringDetails {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

const STATUS_COLORS: Record<string, string> = {
  CURRENT: ACCENT.primary,
  PLANNING: '#3B82F6',
  COMPLETED: '#F59E0B',
  DROPPED: '#EF4444',
  PAUSED: '#8B5CF6',
};

function formatDate(date: { day: number | null; month: number | null; year: number | null }) {
  if (!date?.year) return 'Unknown';
  const d = date.day ? String(date.day).padStart(2, '0') : '01';
  const m = date.month ? String(date.month).padStart(2, '0') : '01';
  return new Date(`${date.year}-${m}-${d}`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${s}s`;
}

interface ScrollProps {
  onScroll: unknown;
  scrollEventThrottle: number;
}

const AnimeDetails: React.FC<{ scrollProps?: ScrollProps }> = ({ scrollProps }) => {
  const { selectedAnime } = useSelectedAnime();
  const { bg, surface, text, textSecondary, elevated, hex } = useThemeColors();
  const data = selectedAnime as Partial<Anime> | null | undefined;
  const nextAiring = (data?.nextAiringEpisode as NextAiringDetails | null | undefined) ?? null;
  const totalStats = data?.stats?.statusDistribution?.reduce((s, i) => s + i.amount, 0) ?? 0;

  return (
    <ScrollView
      className={bg}
      style={{ paddingBottom: 40 }}
      onScroll={scrollProps?.onScroll}
      scrollEventThrottle={scrollProps?.scrollEventThrottle ?? 16}
    >
      {nextAiring && <NextAiringCard {...nextAiring} />}

      {/* Brief Stats — compact metadata block */}
      <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
        <View
          style={{
            backgroundColor: hex.surface,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: hex.border,
          }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: '600',
              color: hex.text,
              marginBottom: 8,
            }}
          >
            Info
          </Text>
          <MetadataRow compact label="Score" value={data?.averageScore?.toFixed(1) ?? 'N/A'} />
          <MetadataRow compact label="Popularity" value={data?.popularity?.toLocaleString() ?? 'N/A'} />
          <MetadataRow compact label="Favorites" value={data?.favourites?.toLocaleString() ?? 'N/A'} />
          <MetadataRow
            compact
            label="Status"
            value={String(data?.status ?? 'Unknown').replace('_', ' ')}
          />
          <MetadataRow compact label="Episodes" value={data?.episodes ?? '?'} />
          <MetadataRow
            compact
            label="Start"
            value={data?.startDate ? formatDate(data.startDate as DateDetails) : '—'}
          />
          <MetadataRow
            compact
            label="End"
            value={data?.endDate ? formatDate(data.endDate as DateDetails) : '—'}
            hideBorder
          />
        </View>
      </View>

      {/* Synopsis — editorial */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View
          style={{
            backgroundColor: hex.surface,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: hex.border,
          }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: '600',
              color: hex.text,
              marginBottom: 8,
            }}
          >
            Synopsis
          </Text>
          <ExpandableRichContent
            content={data?.description ?? ''}
            source="synopsis"
            maxCollapsedHeight={110}
            emptyText="No synopsis available."
          />
        </View>
      </View>

      {/* Viewer Stats — progress bars */}
      {data?.stats?.statusDistribution?.length ? (
        <View
          style={{
            paddingHorizontal: 16,
            marginBottom: 32,
          }}
        >
          <View
            style={{
              backgroundColor: hex.surface,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: hex.border,
            }}
          >
            <Text
              style={{
                fontSize: TYPOGRAPHY.cardTitle.fontSize,
                fontWeight: '600',
                color: hex.text,
                marginBottom: 8,
              }}
            >
              Viewer stats
            </Text>
            {data.stats.statusDistribution.map((item) => {
              const pct = totalStats ? ((item.amount / totalStats) * 100).toFixed(0) : '0';
              const color = STATUS_COLORS[item.status] ?? hex.textTertiary;
              return (
                <View key={item.status} style={{ marginBottom: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: color,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: TYPOGRAPHY.caption.fontSize,
                          fontWeight: '500',
                          color: hex.text,
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.status.toLowerCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: TYPOGRAPHY.caption.fontSize, fontWeight: '600', color: hex.textSecondary }}>
                      {pct}%
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: hex.elevated,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Number(pct)}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

const NextAiringCard: React.FC<NextAiringDetails> = ({
  episode,
  airingAt,
  timeUntilAiring,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeUntilAiring);
  const { text, hex } = useThemeColors();

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <LinearGradient
      colors={[ACCENT.primary, ACCENT.primaryDark]}
      start={[0, 0]}
      end={[1, 1]}
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 14,
      }}
    >
      <Text style={{ color: hex.text, fontSize: 17, fontWeight: '700' }}>
        Ep {episode} — {formatLocalTime(airingAt)} ({getTimeZoneLabel()})
      </Text>
      <Text
        style={{
          color: hex.text,
          fontSize: 22,
          fontWeight: '800',
          marginTop: 6,
          letterSpacing: 0.5,
        }}
      >
        {timeLeft > 0 ? formatTime(timeLeft) : 'Airing now'}
      </Text>
    </LinearGradient>
  );
};

export default AnimeDetails;
