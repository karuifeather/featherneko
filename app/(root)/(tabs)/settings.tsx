import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faMoon,
  faSun,
  faServer,
  faTrashAlt,
  faInfoCircle,
  faSignOutAlt,
  faChartLine,
  faChevronRight,
  faMobile,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { RootState } from '@/state/store';
import { setTheme, setDefaultStreamingApi, STREAMING_APIS, getStreamingApiConfig, type ThemeMode } from '@/state/settingsSlice';
import { logout } from '@/state/userSlice';
import { clearAllHistory } from '@/state/watchHistorySlice';
import { clearContinueWatching } from '@/state/continueWatchingSlice';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useEdgeToEdgeInsets } from '@/hooks/useEdgeToEdgeInsets';
import { OverlayHeader } from '@/components/overlay-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { ACCENT, SEMANTIC } from '@/constants/colors';
import { TYPOGRAPHY, RADIUS } from '@/constants/designTokens';
import {
  clearResponseCachesOnly,
  clearStreamingCachesOnly,
  clearDiscoveryCachesOnly,
} from '@/cache';
import { getCacheMetricsSnapshot } from '@/cache/metrics';
import { buildCacheInsightsViewModel } from '@/cache/metrics';
import { clearSlugCacheMemory } from '@/utils/streamingSlugResolver';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const theme = useSelector((state: RootState) => state.settings.theme);
  const defaultStreamingApi = useSelector(
    (state: RootState) => state.settings.defaultStreamingApi
  );
  const currentApiConfig = getStreamingApiConfig(defaultStreamingApi);
  const { bg, surface, elevated, text, textSecondary, textOnPrimary } = useThemeColors();
  const { overlayHeaderHeight, tabBarHeight } = useEdgeToEdgeInsets();
  const [cachePreview, setCachePreview] = useState<string | null>(null);

  const refreshCachePreview = () => {
    try {
      const snap = getCacheMetricsSnapshot();
      const vm = buildCacheInsightsViewModel(snap, 'lifetime');
      if (vm.hasData) {
        const rate = (vm.cacheHitRate * 100).toFixed(0);
        const avoided = vm.requestsAvoidedTotal >= 1000
          ? `${(vm.requestsAvoidedTotal / 1000).toFixed(1)}k`
          : String(vm.requestsAvoidedTotal);
        setCachePreview(`${rate}% hit · ${avoided} avoided`);
      } else {
        setCachePreview(null);
      }
    } catch {
      setCachePreview(null);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      refreshCachePreview();
    }, [])
  );

  // If persisted API was removed (e.g. stream-neko, anime-api), reset to default
  useEffect(() => {
    if (!currentApiConfig && defaultStreamingApi) {
      dispatch(setDefaultStreamingApi('animeapi'));
    }
  }, [currentApiConfig, defaultStreamingApi, dispatch]);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          dispatch(logout());
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const handleClearApiCache = () => {
    Alert.alert(
      'Clear API cache',
      'Clear all cached anime data, home feed, and streaming links? Watch history, watchlist, and your streaming pick preferences are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          onPress: async () => {
            await clearResponseCachesOnly();
            await clearStreamingCachesOnly();
            clearSlugCacheMemory();
            Alert.alert('Done', 'API cache cleared.');
          },
        },
      ]
    );
  };

  const handleClearDiscoveryCache = () => {
    Alert.alert(
      'Clear discovery cache',
      'Clear home feed and trending/season data? Other caches are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await clearDiscoveryCachesOnly();
            Alert.alert('Done', 'Discovery cache cleared.');
          },
        },
      ]
    );
  };

  const handleClearStreamingCache = () => {
    Alert.alert(
      'Clear streaming cache',
      'Clear streaming links and slug resolution cache? Your pick preferences are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await clearStreamingCachesOnly();
            clearSlugCacheMemory();
            Alert.alert('Done', 'Streaming cache cleared.');
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear watch history',
      'Clear watch history and continue watching? Your watchlist will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            dispatch(clearAllHistory());
            dispatch(clearContinueWatching());
            Alert.alert('Done', 'Watch history cleared.');
          },
        },
      ]
    );
  };

  const { hex } = useThemeColors();

  const SectionHeader = ({ label, first }: { label: string; first?: boolean }) => (
    <Text
      style={{
        fontSize: TYPOGRAPHY.caption.fontSize,
        fontWeight: '600',
        color: hex.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginTop: first ? 0 : 20,
      }}
    >
      {label}
    </Text>
  );

  return (
    <View className={`flex-1 ${bg}`}>
      <ScrollView
        className={`flex-1 ${bg}`}
        contentContainerStyle={{
          padding: 20,
          paddingTop: overlayHeaderHeight + 20,
          paddingBottom: tabBarHeight + 40,
        }}
      >
      <SectionHeader label="Appearance" first />
      <View style={{ backgroundColor: hex.surface, borderRadius: RADIUS.card, overflow: 'hidden' }}>
        <View className="flex-row gap-2" style={{ padding: 16 }}>
          {(['dark', 'light', 'system'] as ThemeMode[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => dispatch(setTheme(t))}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: RADIUS.button,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme === t ? ACCENT.primary : hex.elevated,
              }}
              accessibilityLabel={`Theme: ${t}`}
              accessibilityRole="button"
            >
              {t === 'dark' && <FontAwesomeIcon icon={faMoon} color={theme === t ? ACCENT.primaryForeground : hex.textTertiary} size={16} />}
              {t === 'light' && <FontAwesomeIcon icon={faSun} color={theme === t ? ACCENT.primaryForeground : hex.textTertiary} size={16} />}
              {t === 'system' && <FontAwesomeIcon icon={faMobile} color={theme === t ? ACCENT.primaryForeground : hex.textTertiary} size={16} />}
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme === t ? ACCENT.primaryForeground : hex.textSecondary,
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <SectionHeader label="Streaming" />
      <View style={{ backgroundColor: hex.surface, borderRadius: RADIUS.card, overflow: 'hidden' }}>
        {STREAMING_APIS.map((api, idx) => (
          <View key={api.id} style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: hex.border }}>
            <SettingsRow
              icon={<FontAwesomeIcon icon={faServer} color={defaultStreamingApi === api.id ? ACCENT.primary : hex.textTertiary} size={18} />}
              title={api.label}
              onPress={() => dispatch(setDefaultStreamingApi(api.id))}
              rightElement={defaultStreamingApi === api.id ? <FontAwesomeIcon icon={faCheck} color={ACCENT.primary} size={16} /> : null}
              accessibilityLabel={`Streaming API: ${api.label}${defaultStreamingApi === api.id ? ', selected' : ''}`}
            />
          </View>
        ))}
      </View>

      <SectionHeader label="Cache & Data" />
      <View style={{ backgroundColor: hex.surface, borderRadius: RADIUS.card, overflow: 'hidden' }}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: hex.border }}>
          <SettingsRow
            icon={<FontAwesomeIcon icon={faChartLine} color={ACCENT.primary} size={18} />}
            title="Cache Insights"
            subtitle="Hit rate, requests avoided"
            onPress={() => router.push('/(root)/cache-insights')}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {cachePreview ? <Text style={{ fontSize: 12, color: hex.textSecondary, fontWeight: '500' }}>{cachePreview}</Text> : null}
                <FontAwesomeIcon icon={faChevronRight} size={12} color={hex.textTertiary} />
              </View>
            }
            accessibilityLabel="Open cache insights"
          />
        </View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: hex.border }}>
          <SettingsRow
            icon={<FontAwesomeIcon icon={faTrashAlt} color={hex.textTertiary} size={18} />}
            title="Clear API cache"
            subtitle="Anime data, home feed, streaming links. Keeps watch history and watchlist."
            onPress={handleClearApiCache}
            accessibilityLabel="Clear API cache"
          />
        </View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: hex.border }}>
          <SettingsRow
            icon={<FontAwesomeIcon icon={faTrashAlt} color={hex.textTertiary} size={18} />}
            title="Clear discovery cache"
            subtitle="Home feed and trending data only."
            onPress={handleClearDiscoveryCache}
            accessibilityLabel="Clear discovery cache"
          />
        </View>
        <SettingsRow
          icon={<FontAwesomeIcon icon={faTrashAlt} color={hex.textTertiary} size={18} />}
          title="Clear streaming cache"
          subtitle="Streaming links and slug cache. Keeps your pick preferences."
          onPress={handleClearStreamingCache}
          accessibilityLabel="Clear streaming cache"
        />
      </View>

      <SectionHeader label="History" />
      <View style={{ backgroundColor: hex.surface, borderRadius: RADIUS.card, overflow: 'hidden' }}>
        <SettingsRow
          icon={<FontAwesomeIcon icon={faTrashAlt} color={hex.textTertiary} size={18} />}
          title="Clear watch history & continue watching"
          subtitle="Does not remove your watchlist or API cache."
          onPress={handleClearCache}
          accessibilityLabel="Clear watch history"
        />
      </View>

      <SectionHeader label="About" />
      <View style={{ backgroundColor: hex.surface, borderRadius: RADIUS.card, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <FontAwesomeIcon icon={faInfoCircle} color={ACCENT.primary} size={18} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: '600', color: hex.text }}>
              FeatherNeko
            </Text>
            <Text style={{ fontSize: 13, color: hex.textSecondary, marginTop: 6, lineHeight: 19 }}>
              Discover anime, track your watchlist, and stream episodes. Data from AniList, MyAnimeList, and Kitsu.
            </Text>
            <Text style={{ fontSize: 11, color: hex.textTertiary, marginTop: 10 }}>
              Created by karuifeather.com
            </Text>
          </View>
        </View>
      </View>

      <SectionHeader label="Account" />
      <View style={{ backgroundColor: hex.surface, borderRadius: RADIUS.card, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
        <SettingsRow
          icon={<FontAwesomeIcon icon={faSignOutAlt} color={SEMANTIC.destructive} size={18} />}
          title="Log out"
          onPress={handleLogout}
          destructive
          accessibilityLabel="Log out"
        />
      </View>
      </ScrollView>
      <OverlayHeader />
    </View>
  );
}
