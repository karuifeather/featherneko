import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faChartLine,
  faDatabase,
  faShieldHalved,
  faLayerGroup,
  faServer,
  faInfoCircle,
  faTrashAlt,
  faSync,
  faClock,
  faCopy,
  faBolt,
  faGlobe,
} from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import { useCacheMetrics, buildCacheInsightsViewModel, resetCacheMetrics } from '@/cache/metrics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { DetailOverlayHeader } from '@/components/overlay-header';
import { useEdgeToEdgeInsets } from '@/hooks/useEdgeToEdgeInsets';
import { ACCENT, SEMANTIC } from '@/constants/colors';
import { TYPOGRAPHY, RADIUS, SPACING } from '@/constants/designTokens';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatMs(ms: number): string {
  if (ms >= 60_000) return `~${Math.round(ms / 60_000)} min`;
  if (ms >= 1_000) return `~${(ms / 1_000).toFixed(1)} s`;
  return `~${Math.round(ms)} ms`;
}

function formatRelativeTime(ms: number): string {
  if (ms < 60_000) return 'just now';
  const min = Math.floor(ms / 60_000);
  return min === 1 ? '1 min ago' : `${min} min ago`;
}

const CIRCLE_SIZE = 140;
const STROKE_WIDTH = 10;

function HitRateGauge({ rate, color }: { rate: number; color: string }) {
  const normalized = Math.min(1, Math.max(0, rate));
  const circumference = 2 * Math.PI * ((CIRCLE_SIZE - STROKE_WIDTH) / 2);
  const strokeDashoffset = circumference * (1 - normalized);

  return (
    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={(CIRCLE_SIZE - STROKE_WIDTH) / 2}
          stroke="rgba(74, 124, 124, 0.2)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={(CIRCLE_SIZE - STROKE_WIDTH) / 2}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: 32, fontWeight: '700', color }}>{(rate * 100).toFixed(0)}%</Text>
      <Text style={{ fontSize: 12, fontWeight: '500', color, opacity: 0.8, marginTop: 2 }}>hit rate</Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  const { hex } = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: hex.elevated,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: hex.border,
        minWidth: 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {icon}
        <Text style={{ fontSize: 11, fontWeight: '600', color: hex.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: accent ? ACCENT.primary : hex.text,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sublabel && (
        <Text style={{ fontSize: 10, color: hex.textTertiary, marginTop: 2 }} numberOfLines={1}>
          {sublabel}
        </Text>
      )}
    </View>
  );
}

function DataFlowBar({
  vm,
  hex,
}: {
  vm: ReturnType<typeof buildCacheInsightsViewModel>;
  hex: { border: string; text: string; textSecondary: string; textTertiary: string };
}) {
  const total = vm.memoryHits + vm.persistentHits + vm.entityHits + vm.networkFetches + vm.cacheMisses;
  if (total === 0) return null;

  const segments = [
    { value: vm.memoryHits, color: '#4a7c7c', label: 'Memory' },
    { value: vm.persistentHits, color: '#5a9a9a', label: 'Disk' },
    { value: vm.entityHits, color: '#6ab8b8', label: 'Entity' },
    { value: vm.networkFetches, color: '#71717a', label: 'Network' },
    { value: vm.cacheMisses, color: hex.textTertiary, label: 'Miss' },
  ].filter((s) => s.value > 0);

  return (
    <View>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: hex.border }}>
        {segments.map((s, i) => (
          <View
            key={i}
            style={{
              flex: s.value / total,
              backgroundColor: s.color,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        {segments.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ fontSize: 11, color: hex.textSecondary }}>{s.label}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: hex.text }}>{formatNumber(s.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function CacheInsightsScreen() {
  const [timeWindow, setTimeWindow] = useState<'session' | 'lifetime'>('lifetime');
  const { snapshot, refresh, isLoading } = useCacheMetrics();
  const vm = useMemo(
    () => buildCacheInsightsViewModel(snapshot, timeWindow),
    [snapshot, timeWindow]
  );
  const { bg, hex, elevated, text, textSecondary, subtext, border } = useThemeColors();
  const { overlayHeaderHeight, tabBarHeight } = useEdgeToEdgeInsets();

  const handleCopySummary = async () => {
    if (!vm.hasData) return;
    const lines: string[] = [
      'Cache Insights',
      `Cache hit rate: ${(vm.cacheHitRate * 100).toFixed(1)}%`,
      `Reads served from cache: ${formatNumber(vm.readsServedWithoutNetwork)}`,
      `Requests fully avoided: ${formatNumber(vm.requestsAvoidedTotal)}`,
      `Recovered during source issues: ${formatNumber(vm.recoveredDuringSourceIssues)}`,
      `Top namespaces: ${vm.topNamespaces.slice(0, 3).map((n) => n.label).join(', ')}`,
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const performReset = async () => {
    try {
      await resetCacheMetrics();
      refresh();
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Failed to reset cache metrics.');
      } else {
        Alert.alert('Error', 'Failed to reset cache metrics.');
      }
    }
  };

  const handleReset = () => {
    const message =
      'This will clear all cache metrics (session and lifetime). Cache contents are not affected.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Reset cache metrics\n\n${message}`)) {
        performReset();
      }
    } else {
      Alert.alert('Reset cache metrics', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => performReset() },
      ]);
    }
  };

  return (
    <View className={`flex-1 ${bg}`}>
      <DetailOverlayHeader title="Cache Insights" />

      <ScrollView
        style={{ flex: 1, backgroundColor: hex.bg }}
        contentContainerStyle={{
          paddingHorizontal: SPACING.base,
          paddingTop: overlayHeaderHeight - 56,
          paddingBottom: tabBarHeight + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT.primary} />
          </View>
        ) : !vm.hasData ? (
          <View
            style={{
              backgroundColor: hex.elevated,
              borderRadius: RADIUS.xl,
              padding: SPACING.xxl,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: hex.border,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: 'rgba(74, 124, 124, 0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: SPACING.lg,
              }}
            >
              <FontAwesomeIcon icon={faChartLine} size={32} color={ACCENT.primary} />
            </View>
            <Text style={{ fontSize: TYPOGRAPHY.screenTitle.fontSize, fontWeight: '700', color: hex.text }}>
              No metrics yet
            </Text>
            <Text
              style={{
                fontSize: TYPOGRAPHY.body.fontSize,
                color: hex.textSecondary,
                textAlign: 'center',
                marginTop: SPACING.sm,
                lineHeight: 22,
                maxWidth: 280,
              }}
            >
              Browse anime, open details, and stream episodes. Cache metrics will appear here as you use the app.
            </Text>
          </View>
        ) : (
          <>
            {/* Time window pills */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: hex.elevated,
                borderRadius: RADIUS.pill,
                padding: 4,
                marginBottom: SPACING.xl,
                borderWidth: 1,
                borderColor: hex.border,
              }}
            >
              {(['session', 'lifetime'] as const).map((w) => (
                <TouchableOpacity
                  key={w}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeWindow(w);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: RADIUS.pill,
                    alignItems: 'center',
                    backgroundColor: timeWindow === w ? ACCENT.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: timeWindow === w ? ACCENT.primaryForeground : hex.textSecondary,
                    }}
                  >
                    {w === 'session' ? 'Session' : 'Lifetime'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: timeWindow === w ? 'rgba(240,249,255,0.8)' : hex.textTertiary,
                      marginTop: 1,
                    }}
                  >
                    {w === 'session' ? 'Since launch' : 'All time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hero: Hit rate gauge */}
            <View
              style={{
                alignItems: 'center',
                paddingVertical: SPACING.lg,
                marginBottom: SPACING.lg,
              }}
            >
              <HitRateGauge rate={vm.cacheHitRate} color={ACCENT.primary} />
              {snapshot?.lastUpdated && (
                <Text style={{ fontSize: 11, color: hex.textTertiary, marginTop: SPACING.sm }}>
                  Updated {formatRelativeTime(Date.now() - snapshot.lastUpdated)}
                </Text>
              )}
            </View>

            {/* Key stats row */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl }}>
              <StatCard
                icon={<FontAwesomeIcon icon={faBolt} size={12} color={ACCENT.primary} />}
                label="Served from cache"
                value={formatNumber(vm.readsServedWithoutNetwork)}
                sublabel="no network wait"
              />
              <StatCard
                icon={<FontAwesomeIcon icon={faGlobe} size={12} color={ACCENT.primary} />}
                label="Requests avoided"
                value={formatNumber(vm.requestsAvoidedTotal)}
                sublabel="no fetch at all"
              />
              <StatCard
                icon={<FontAwesomeIcon icon={faClock} size={12} color={ACCENT.primary} />}
                label="Time saved"
                value={formatMs(vm.estimatedSavedMs)}
                sublabel="approx. load time"
              />
            </View>

            {/* Data flow */}
            <View
              style={{
                backgroundColor: hex.elevated,
                borderRadius: RADIUS.lg,
                padding: SPACING.base,
                marginBottom: SPACING.base,
                borderWidth: 1,
                borderColor: hex.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
                <FontAwesomeIcon icon={faDatabase} size={16} color={ACCENT.primary} />
                <Text style={{ fontSize: TYPOGRAPHY.sectionTitle.fontSize, fontWeight: '600', color: hex.text }}>
                  Where data came from
                </Text>
              </View>
              <DataFlowBar vm={vm} hex={hex} />
            </View>

            {/* Resilience */}
            <View
              style={{
                backgroundColor: hex.elevated,
                borderRadius: RADIUS.lg,
                padding: SPACING.base,
                marginBottom: SPACING.base,
                borderWidth: 1,
                borderColor: hex.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
                <FontAwesomeIcon icon={faShieldHalved} size={16} color={ACCENT.primary} />
                <Text style={{ fontSize: TYPOGRAPHY.sectionTitle.fontSize, fontWeight: '600', color: hex.text }}>
                  Resilience
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {vm.duplicateRequestsCollapsed > 0 && (
                  <Pill label={`${formatNumber(vm.duplicateRequestsCollapsed)} deduped`} />
                )}
                {vm.entityReconstructions > 0 && (
                  <Pill label={`${formatNumber(vm.entityReconstructions)} reconstructed`} />
                )}
                {vm.negativeCacheHits > 0 && (
                  <Pill label={`${formatNumber(vm.negativeCacheHits)} negative hits`} />
                )}
                {vm.recoveredDuringSourceIssues > 0 && (
                  <Pill label={`${formatNumber(vm.recoveredDuringSourceIssues)} recovered`} accent />
                )}
                {vm.duplicateRequestsCollapsed === 0 &&
                  vm.entityReconstructions === 0 &&
                  vm.negativeCacheHits === 0 &&
                  vm.recoveredDuringSourceIssues === 0 && (
                    <Text style={{ fontSize: 13, color: hex.textSecondary }}>No resilience events yet</Text>
                  )}
              </View>
            </View>

            {/* Top namespaces */}
            {vm.topNamespaces.length > 0 && (
              <View
                style={{
                  backgroundColor: hex.elevated,
                  borderRadius: RADIUS.lg,
                  padding: SPACING.base,
                  marginBottom: SPACING.base,
                  borderWidth: 1,
                  borderColor: hex.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
                  <FontAwesomeIcon icon={faLayerGroup} size={16} color={ACCENT.primary} />
                  <Text style={{ fontSize: TYPOGRAPHY.sectionTitle.fontSize, fontWeight: '600', color: hex.text }}>
                    Top namespaces
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {vm.topNamespaces.slice(0, 5).map((ns) => (
                    <View
                      key={ns.namespace}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        backgroundColor: hex.surface,
                        borderRadius: RADIUS.md,
                        borderWidth: 1,
                        borderColor: hex.border,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: hex.text }} numberOfLines={1}>
                        {ns.label}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Text style={{ fontSize: 12, color: hex.textSecondary }}>{formatNumber(ns.hits)} hits</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: ACCENT.primary }}>
                          {formatNumber(ns.avoidedRequests)} avoided
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Source health */}
            {vm.sourceMetrics.some((s) => s.failures > 0 || s.rateLimited > 0 || s.staleFallbacks > 0) && (
              <View
                style={{
                  backgroundColor: hex.elevated,
                  borderRadius: RADIUS.lg,
                  padding: SPACING.base,
                  marginBottom: SPACING.base,
                  borderWidth: 1,
                  borderColor: hex.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
                  <FontAwesomeIcon icon={faServer} size={16} color={ACCENT.primary} />
                  <Text style={{ fontSize: TYPOGRAPHY.sectionTitle.fontSize, fontWeight: '600', color: hex.text }}>
                    Source health
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {vm.sourceMetrics
                    .filter((s) => s.failures > 0 || s.rateLimited > 0 || s.staleFallbacks > 0)
                    .map((s) => (
                      <View
                        key={s.source}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '500', color: hex.text }}>{s.label}</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {s.failures > 0 && (
                            <Text style={{ fontSize: 11, color: SEMANTIC.warning }}>{s.failures} fail</Text>
                          )}
                          {s.rateLimited > 0 && (
                            <Text style={{ fontSize: 11, color: SEMANTIC.warning }}>{s.rateLimited} 429</Text>
                          )}
                          {s.staleFallbacks > 0 && (
                            <Text style={{ fontSize: 11, color: hex.textSecondary }}>{s.staleFallbacks} fallback</Text>
                          )}
                        </View>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* About */}
            <View
              style={{
                backgroundColor: hex.elevated,
                borderRadius: RADIUS.lg,
                padding: SPACING.base,
                marginBottom: SPACING.base,
                borderWidth: 1,
                borderColor: hex.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm }}>
                <FontAwesomeIcon icon={faInfoCircle} size={14} color={hex.textTertiary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: hex.textSecondary }}>
                  About these numbers
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: hex.textTertiary, lineHeight: 18 }}>
                Session = since app launch. Lifetime = persisted across restarts. Saved time is estimated from
                observed network latency. Clearing metrics resets counters but does not clear cached data.
              </Text>
            </View>

            {/* Actions */}
            <View
              style={{
                flexDirection: 'row',
                gap: SPACING.sm,
                marginTop: SPACING.sm,
              }}
            >
              <TouchableOpacity
                onPress={refresh}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  backgroundColor: hex.elevated,
                  borderRadius: RADIUS.button,
                  borderWidth: 1,
                  borderColor: hex.border,
                }}
              >
                <FontAwesomeIcon icon={faSync} size={14} color={hex.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: hex.text }}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopySummary}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  backgroundColor: hex.elevated,
                  borderRadius: RADIUS.button,
                  borderWidth: 1,
                  borderColor: hex.border,
                }}
              >
                <FontAwesomeIcon icon={faCopy} size={14} color={hex.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: hex.text }}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReset}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  borderRadius: RADIUS.button,
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <FontAwesomeIcon icon={faTrashAlt} size={14} color={SEMANTIC.destructive} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: SEMANTIC.destructive }}>Reset</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  const { hex } = useThemeColors();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        backgroundColor: accent ? 'rgba(74, 124, 124, 0.2)' : hex.surface,
        borderWidth: 1,
        borderColor: accent ? 'rgba(74, 124, 124, 0.4)' : hex.border,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: accent ? ACCENT.primary : hex.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
