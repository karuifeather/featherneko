import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Image,
  Platform,
  InteractionManager,
  NativeModules,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import axios from 'axios';
import type { Episode } from '@/types';
import { EpisodesResponse } from '@/types';
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSelectedAnime } from '@/context/anime-provider';
import { useEpisodeContext } from '@/context/episode-provider';
import VideoPlayerControls, { type Headers } from '@/components/video-player-controls';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faChevronLeft,
  faCheck,
  faInfoCircle,
  faComment,
  faComments,
  faStar,
  faThLarge,
  faListOl,
  faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimeDetails from '@/components/anime-details';
import AnimeForum, { type AnimeForumRef } from '@/components/forum';
import ReviewsComponent from '@/components/review';
import { getEpisodeForumTopicId } from '@/utils/episodeForumTopic';
import { toSearchQuery, toPathSegment } from '@/utils/streamingSlugResolver';
import {
  createStreamingApi,
  type StreamingSearchResult,
} from '@/utils/streamingApi';
import { setCachedStreamingPick, type CachedStreamingPick } from '@/utils/streamingPickCache';
import { getAnimeApiSeriesCache } from '@/utils/animeApiSeriesCache';
import { resolveKitsuAnimeId } from '@/utils/kitsuResolver';
import { getLocalEpisode, mergeLocalEpisode, mergeLocalAnime } from '@/utils/localDb';
import EpisodesList from '@/components/episodes-list';
import AnimeRecommendation from '@/components/recom-grid';
import { upsertContinueWatching } from '@/state/continueWatchingSlice';
import { markEpisodeWatched } from '@/state/watchHistorySlice';
import { setEpisodeProgress, selectEpisodeProgress } from '@/state/episodeProgressSlice';
import { RootState } from '@/state/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getStreamingApiConfig } from '@/state/settingsSlice';
import {
  STREAM_PROXY_URL,
  DEV_STREAM_URL,
  DEV_STREAM_REFERER,
  DEV_STREAM_ORIGIN,
  DEV_STREAM_USER_AGENT,
} from '@env';
import { getStreamingBaseUrl } from '@/utils/streamingEnv';

type TabId = 'episodes' | 'comments' | 'about' | 'discussion' | 'reviews' | 'more';

const WATCH_LAST_TAB_KEY = 'featherneko_watch_last_tab';

const ANILIST_ANIME_BY_MAL_QUERY = `
  query ($mal_id: Int) {
    Page {
      media(idMal_in: [$mal_id], type: ANIME) {
        id
        idMal
        title { english romaji }
        genres
        bannerImage
        reviews { pageInfo { total } }
        coverImage { large }
        status
        episodes
        recommendations { pageInfo { total } }
      }
    }
  }
`;

/** Proxy base for banned CDN streams (lightningspark77.pro, haildrop77.pro, etc). When set, all stream URLs are routed through it. Empty = no proxy (use stream URL directly). */
function getStreamProxyBase(): string {
  const envProxy = typeof STREAM_PROXY_URL === 'string' ? String(STREAM_PROXY_URL).trim() : '';
  return envProxy ? envProxy.replace(/\/?$/, '') : '';
}

function maybeProxyStreamUrl(streamUrl: string, proxyBase: string): { url: string; clearHeaders: boolean } {
  if (!proxyBase) return { url: streamUrl, clearHeaders: false };
  return {
    url: `${proxyBase}?url=${encodeURIComponent(streamUrl)}`,
    clearHeaders: true,
  };
}

const WatchEpisode = () => {
  interface Source {
    url: string;
    quality: string;
    isM3U8: boolean;
  }

  const router = useRouter();
  const params = useLocalSearchParams<{ malId?: string; episodeNumber?: string; resumeSeconds?: string }>();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { bg, cardBg, text, subtext, elevated, border } = useThemeColors();
  const defaultStreamingApi = useSelector(
    (state: RootState) => state.settings.defaultStreamingApi
  );
  const currentApiConfig = getStreamingApiConfig(defaultStreamingApi);
  // Single source (AnimeAPI) – no player settings or stream selector UI
  const { selectedAnime, setSelectedAnime } = useSelectedAnime();
  const { selectedEpisode, setSelectedEpisode } = useEpisodeContext();
  const resumeSeconds = useSelector((state: RootState) =>
    selectedAnime?.idMal != null && selectedEpisode?.attributes?.number != null
      ? selectEpisodeProgress(state, selectedAnime.idMal as number, selectedEpisode.attributes.number)
      : 0
  );

  const streamingBaseUrl = currentApiConfig?.envKey
    ? getStreamingBaseUrl(currentApiConfig.envKey)
    : '';
  const streamingApi = useMemo(() => {
    if (!streamingBaseUrl || !currentApiConfig) return null;
    try {
      return createStreamingApi(streamingBaseUrl, { adapterKey: currentApiConfig.adapterKey });
    } catch {
      return null;
    }
  }, [streamingBaseUrl, currentApiConfig]);

  // Hide Android nav bar on watch screen; restore when leaving. User can swipe from bottom to reveal.
  // expo-navigation-bar has limited effect with edge-to-edge/gesture nav; native immersive module is fallback.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const applyHidden = () => {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        if (NativeModules.ImmersiveMode?.setImmersiveMode) {
          NativeModules.ImmersiveMode.setImmersiveMode(true);
        }
      };
      const restore = () => {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
        if (NativeModules.ImmersiveMode?.setImmersiveMode) {
          NativeModules.ImmersiveMode.setImmersiveMode(false);
        }
      };
      const task = InteractionManager.runAfterInteractions(() => applyHidden());
      return () => {
        task.cancel();
        restore();
      };
    }, [])
  );

  const [loading, setLoading] = useState<boolean>(false);
  /** True while looking up anime on streaming service (cache or search) before we have a provider pick. */
  const [resolvingProvider, setResolvingProvider] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [headers, setHeaders] = useState<Headers | null>(null);
  /** Episode snapshot image from streaming API (e.g. animepahe) for player poster. */
  const [episodeImage, setEpisodeImage] = useState<string | null>(null);
  /** Local DB episode (Kitsu thumbnail + AnimeAPI image) for poster priority. */
  const [localEpisodePoster, setLocalEpisodePoster] = useState<{ thumbnail?: string; image?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('episodes');
  const [playerBottomY, setPlayerBottomY] = useState(0);
  /** When opening from Continue Watching (URL params), we fetch anime + episode and set context. */
  const hasResumeParams =
    params.malId != null &&
    params.episodeNumber != null &&
    Number.isInteger(Number(params.malId)) &&
    Number(params.malId) >= 1 &&
    Number.isInteger(Number(params.episodeNumber)) &&
    Number(params.episodeNumber) >= 1;
  const [loadingResumeParams, setLoadingResumeParams] = useState(() => hasResumeParams);
  const [resumeFromParamsError, setResumeFromParamsError] = useState<string | null>(null);

  // Sync resume time from URL params into store so player can seek
  useEffect(() => {
    const malId = params.malId != null ? Number(params.malId) : NaN;
    const episodeNumber = params.episodeNumber != null ? Number(params.episodeNumber) : NaN;
    const seconds = params.resumeSeconds != null ? Number(params.resumeSeconds) : 0;
    if (!Number.isInteger(malId) || malId < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1) return;
    dispatch(setEpisodeProgress({ malId, episodeNumber, seconds }));
  }, [params.malId, params.episodeNumber, params.resumeSeconds, dispatch]);

  // Open from Continue Watching: fetch anime + episode by URL params and set context.
  // Only depend on params so we don't re-run when setSelectedAnime/setSelectedEpisode trigger re-renders (avoids race and loading stuck).
  useEffect(() => {
    const malIdParam = params.malId != null ? Number(params.malId) : NaN;
    const episodeNumberParam = params.episodeNumber != null ? Number(params.episodeNumber) : NaN;
    if (!Number.isInteger(malIdParam) || malIdParam < 1 || !Number.isInteger(episodeNumberParam) || episodeNumberParam < 1) {
      setLoadingResumeParams(false);
      return;
    }
    const alreadyMatching =
      selectedAnime?.idMal === malIdParam && selectedEpisode?.attributes?.number === episodeNumberParam;
    if (alreadyMatching) {
      setLoadingResumeParams(false);
      setResumeFromParamsError(null);
      return;
    }

    let cancelled = false;
    setResumeFromParamsError(null);
    setLoadingResumeParams(true);

    (async () => {
      try {
        const animeRes = await axios.post(
          'https://graphql.anilist.co',
          { query: ANILIST_ANIME_BY_MAL_QUERY, variables: { mal_id: malIdParam } },
          { headers: { 'Content-Type': 'application/json' } }
        );
        const media = animeRes.data?.data?.Page?.media;
        const anime = Array.isArray(media) && media[0] ? media[0] : null;
        if (cancelled) return;
        if (!anime) {
          setResumeFromParamsError('Could not load anime.');
          return;
        }
        setSelectedAnime(anime);

        const kitsuResult = await resolveKitsuAnimeId({
          idMal: malIdParam,
          anilistId: (anime?.id as number) ?? null,
          titleEnglish: anime?.title?.english ?? null,
          titleRomaji: anime?.title?.romaji ?? null,
        });
        if (cancelled) return;
        if (!kitsuResult) {
          setResumeFromParamsError('Could not find episode.');
          return;
        }
        const episodesRes = await axios.get<EpisodesResponse>(
          `https://kitsu.io/api/edge/episodes?filter[mediaType]=Anime&filter[media_id]=${kitsuResult.kitsuId}&sort=number&page[limit]=1&page[offset]=${episodeNumberParam - 1}`
        );
        const episodes: Episode[] = episodesRes.data?.data ?? [];
        const episode = episodes[0]?.attributes?.number === episodeNumberParam ? episodes[0] : null;
        if (cancelled) return;
        if (!episode) {
          setResumeFromParamsError('Could not find episode.');
          return;
        }
        setSelectedEpisode(episode);
      } catch (e) {
        if (cancelled) return;
        if (__DEV__) console.warn('Resume from params failed', e);
        setResumeFromParamsError('Failed to load. Try again.');
      } finally {
        if (!cancelled) setLoadingResumeParams(false);
      }
    })();
    return () => { cancelled = true; };
    // Intentionally omit selectedAnime/selectedEpisode so we don't re-run when we set them during fetch (avoids duplicate fetches and stuck loading).
  }, [params.malId, params.episodeNumber, setSelectedAnime, setSelectedEpisode]);

  useEffect(() => {
    AsyncStorage.getItem(WATCH_LAST_TAB_KEY).then((t) => {
      if (t && (['episodes', 'comments', 'about', 'discussion', 'reviews', 'more'] as TabId[]).includes(t as TabId)) {
        setActiveTab(t as TabId);
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(WATCH_LAST_TAB_KEY, activeTab).catch(() => {});
  }, [activeTab]);
  const [episodeForumTopicId, setEpisodeForumTopicId] = useState<number | null>(null);
  const [discussionDrawerOpen, setDiscussionDrawerOpen] = useState(false);
  const [hasPlayStarted, setHasPlayStarted] = useState(false);
  const [playerOverlayVisible, setPlayerOverlayVisible] = useState(true);
  const playerOverlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerContainerRef = useRef<View>(null);
  const forumRef = useRef<AnimeForumRef>(null);

  const scheduleHidePlayerOverlay = () => {
    if (playerOverlayHideTimerRef.current) clearTimeout(playerOverlayHideTimerRef.current);
    playerOverlayHideTimerRef.current = setTimeout(() => {
      playerOverlayHideTimerRef.current = null;
      setPlayerOverlayVisible(false);
    }, 3000);
  };

  const showPlayerOverlay = () => {
    setPlayerOverlayVisible(true);
    scheduleHidePlayerOverlay();
  };

  useEffect(() => {
    setHasPlayStarted(false);
    setPlayerOverlayVisible(true);
    if (playerOverlayHideTimerRef.current) {
      clearTimeout(playerOverlayHideTimerRef.current);
      playerOverlayHideTimerRef.current = null;
    }
  }, [selectedEpisode?.id]);

  const [selectedProviderAnime, setSelectedProviderAnime] = useState<CachedStreamingPick | null>(null);
  const [searchDrawerVisible, setSearchDrawerVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<StreamingSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');

  // Merge anime into local DB when we have it (fill gaps over time from any source)
  useEffect(() => {
    if (!selectedAnime?.idMal) return;
    const malId = selectedAnime.idMal as number;
    const cover = (selectedAnime.coverImage as { large?: string })?.large;
    const titleObj = selectedAnime.title as { romaji?: string; english?: string } | undefined;
    const title = titleObj?.romaji ?? titleObj?.english;
    mergeLocalAnime(malId, {
      coverImage: cover ?? undefined,
      title: title ?? undefined,
      bannerImage: (selectedAnime.bannerImage as string) ?? undefined,
      status: (selectedAnime.status as string) ?? undefined,
      episodeCount: (selectedAnime.episodes as number) ?? undefined,
    }).catch(() => {});
  }, [selectedAnime]);

  // Load local episode for poster: prefer cached Kitsu thumbnail, then AnimeAPI image
  useEffect(() => {
    if (!selectedAnime?.idMal || selectedEpisode?.attributes?.number == null) {
      setLocalEpisodePoster(null);
      return;
    }
    let cancelled = false;
    getLocalEpisode(selectedAnime.idMal as number, selectedEpisode.attributes.number).then((ep) => {
      if (!cancelled && ep) {
        setLocalEpisodePoster({ thumbnail: ep.thumbnail, image: ep.image });
      } else if (!cancelled) {
        setLocalEpisodePoster(null);
      }
    });
    return () => { cancelled = true; };
  }, [selectedAnime?.idMal, selectedEpisode?.attributes?.number]);

  useEffect(() => {
    if (!selectedAnime?.idMal || !selectedEpisode?.attributes?.number) {
      setEpisodeForumTopicId(null);
      return;
    }
    let cancelled = false;
    getEpisodeForumTopicId(
      selectedAnime.idMal as number,
      selectedEpisode.attributes.number
    ).then((topicId) => {
      if (!cancelled) setEpisodeForumTopicId(topicId);
    });
    return () => { cancelled = true; };
  }, [selectedAnime?.idMal, selectedEpisode?.attributes?.number]);

  useEffect(() => {
    if (!selectedAnime || !selectedEpisode) return;
    const epNum = selectedEpisode.attributes?.number ?? 0;
    const coverImage =
      (selectedAnime.coverImage as { large?: string })?.large ?? '';
    dispatch(
      upsertContinueWatching({
        malId: selectedAnime.idMal as number,
        anilistId: selectedAnime.id as number,
        title:
          selectedAnime.title?.english ||
          selectedAnime.title?.romaji ||
          'Unknown',
        coverImage,
        episodeNumber: epNum,
        episodeId: selectedEpisode.id,
        lastWatchedAt: Date.now(),
        progressSeconds: resumeSeconds || undefined,
      })
    );
    dispatch(
      markEpisodeWatched({
        malId: selectedAnime.idMal as number,
        episodeNumber: epNum,
      })
    );
  }, [selectedAnime?.idMal, selectedEpisode?.id, dispatch, resumeSeconds]);

  const saveProgress = useCallback(
    (currentTimeSeconds: number) => {
      if (!selectedAnime?.idMal || selectedEpisode?.attributes?.number == null) return;
      const malId = selectedAnime.idMal as number;
      const epNum = selectedEpisode.attributes.number;
      dispatch(setEpisodeProgress({ malId, episodeNumber: epNum, seconds: currentTimeSeconds }));
      const coverImage = (selectedAnime.coverImage as { large?: string })?.large ?? '';
      dispatch(
        upsertContinueWatching({
          malId,
          anilistId: selectedAnime.id as number,
          title: selectedAnime.title?.english || selectedAnime.title?.romaji || 'Unknown',
          coverImage,
          episodeNumber: epNum,
          episodeId: selectedEpisode.id,
          lastWatchedAt: Date.now(),
          progressSeconds: currentTimeSeconds,
        })
      );
    },
    [selectedAnime, selectedEpisode, dispatch]
  );

  // Dev: optional static stream from .env (DEV_STREAM_URL). If set, used instead of real API. Use proxy to avoid 403 on banned CDNs.
  const devStreamUrl = typeof DEV_STREAM_URL === 'string' ? String(DEV_STREAM_URL).trim() : '';
  const DEV_STREAM_JSON: {
    success: boolean;
    results?: {
      streamingLink?: {
        link?: { file?: string; type?: string };
        tracks?: { file?: string; label?: string; kind?: string; default?: boolean }[];
      };
    };
    headers?: Headers | null;
  } | null =
    __DEV__ && devStreamUrl
      ? {
          success: true,
          results: {
            streamingLink: {
              link: {
                file: devStreamUrl,
                type: 'hls',
              },
            },
          },
          headers:
            DEV_STREAM_REFERER || DEV_STREAM_ORIGIN
              ? {
                  Referer: typeof DEV_STREAM_REFERER === 'string' ? DEV_STREAM_REFERER : 'https://lightningspark77.pro/',
                  Origin: typeof DEV_STREAM_ORIGIN === 'string' ? DEV_STREAM_ORIGIN : 'https://lightningspark77.pro',
                  'User-Agent':
                    typeof DEV_STREAM_USER_AGENT === 'string' && DEV_STREAM_USER_AGENT.trim()
                      ? DEV_STREAM_USER_AGENT.trim()
                      : 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
                }
              : undefined,
        }
      : null;

  const fetchStreamingLinks = async () => {
    if (!selectedAnime || !selectedEpisode) return;

    // Dev: load from DEV_STREAM_URL (.env) if set. Use proxy to avoid 403 on banned CDNs (lightningspark77.pro, haildrop77.pro).
    if (DEV_STREAM_JSON?.success && DEV_STREAM_JSON?.results?.streamingLink) {
      const sl = DEV_STREAM_JSON.results.streamingLink;
      const file = sl.link?.file;
      if (file) {
        setStreamError(null);
        setEpisodeImage(null);
        const proxyBase = getStreamProxyBase();
        const { url, clearHeaders } = maybeProxyStreamUrl(file, proxyBase);
        if (__DEV__ && proxyBase) console.log('[Stream] Using proxy for dev stream:', proxyBase);
        setSources([
          {
            url,
            quality: 'default',
            isM3U8: (sl.link?.type ?? '').toLowerCase() === 'hls' || file.includes('.m3u8'),
          },
        ]);
        setHeaders(clearHeaders ? null : (DEV_STREAM_JSON.headers ?? null));
        return;
      }
    }

    if (!selectedProviderAnime) return;
    if (!streamingApi) {
      setStreamError('Set streaming API URL in Settings or .env for the selected source.');
      return;
    }
    setLoading(true);
    setStreamError(null);
    const episodeNum = selectedEpisode.attributes.number;
    const providerAnimeId = selectedProviderAnime.id;
    if (__DEV__) {
      console.log('[Stream] Fetching stream:', { animeId: providerAnimeId, episodeNum });
    }
    try {
      const result = await streamingApi.fetchStream(providerAnimeId, episodeNum, {
        ...(selectedAnime?.idMal != null ? { malId: selectedAnime.idMal as number } : {}),
      });
      if (__DEV__) {
        console.log('[Stream] fetchStream() response:', {
          sourcesCount: result.sources.length,
          firstUrl: result.sources[0]?.url?.slice(0, 80) + (result.sources[0]?.url?.length > 80 ? '...' : ''),
          hasHeaders: !!result.headers,
          headersKeys: result.headers ? Object.keys(result.headers) : [],
        });
      }
      if (result.sources.length > 0) {
        const proxyBase = getStreamProxyBase();
        const first = result.sources[0];
        const { url: finalUrl, clearHeaders } = maybeProxyStreamUrl(first.url, proxyBase);
        if (__DEV__ && proxyBase) console.log('[Stream] Using proxy for API stream:', proxyBase);
        setSources([{ ...first, url: finalUrl }]);
        setHeaders(clearHeaders ? null : (result.headers ?? null));
        setEpisodeImage(result.episodeImage ?? null);
        // Persist AnimeAPI episode image to local DB so we can use it when no Kitsu thumbnail
        if (selectedAnime?.idMal != null && result.episodeImage) {
          await mergeLocalEpisode(selectedAnime.idMal as number, episodeNum, { image: result.episodeImage });
          setLocalEpisodePoster((prev) => ({ ...prev, thumbnail: prev?.thumbnail, image: result.episodeImage ?? prev?.image }));
        }
      } else {
        setSources([]);
        setHeaders(null);
        setEpisodeImage(null);
        setStreamError('Stream server returned no playable sources.');
      }
    } catch (error: unknown) {
      setSources([]);
      setHeaders(null);
      setEpisodeImage(null);
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = (error as Error)?.message ?? '';
      if (__DEV__) console.warn('[Stream] fetchStream() failed:', { status, message: String(message), error });
      if (status === 404) {
        setStreamError('Episode not found. Try another provider or re-pick the anime.');
      } else if (status === 429) {
        setStreamError('Too many requests. Wait a moment and try again.');
      } else if (status && status >= 500) {
        setStreamError('Stream server error. Try again later or another server.');
      } else {
        setStreamError(
          streamingBaseUrl?.startsWith('http')
            ? 'Could not load stream. Check your connection and streaming settings.'
            : 'Could not load stream. Set streaming server URL in Settings or .env.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAnime || !selectedEpisode || !streamingApi) {
      setResolvingProvider(false);
      return;
    }
    const malId = selectedAnime.idMal as number;
    let cancelled = false;
    setResolvingProvider(true);
    setStreamError(null);
    if (__DEV__) console.log('[Stream] Provider-pick effect:', { malId });

    getAnimeApiSeriesCache(malId)
      .then((seriesResults) => {
        if (cancelled) return;
        if (__DEV__) console.log('[Stream] AnimeAPI series cache:', seriesResults?.length ?? 0, 'results');
        if (seriesResults?.length) {
          const first = seriesResults[0];
          const pick = { id: first.id ?? '', title: first.title, image: first.image };
          setSelectedProviderAnime(pick);
          setSearchDrawerVisible(false);
          setResolvingProvider(false);
          if (__DEV__) console.log('[Stream] AnimeAPI series cache hit:', malId, pick.title, 'id=', pick.id);
          return;
        }
        runSearch();
      })
      .catch((err) => {
        if (cancelled) return;
        if (__DEV__) console.warn('[Stream] getAnimeApiSeriesCache failed:', err);
        runSearch();
      });

    function runSearch() {
      if (!streamingApi) return;
      setSelectedProviderAnime(null);
      const query = (
        toSearchQuery(selectedAnime!.title?.romaji) ||
        toSearchQuery(selectedAnime!.title?.english) ||
        toPathSegment(selectedAnime!.title?.romaji ?? '') ||
        toPathSegment(selectedAnime!.title?.english ?? '') ||
        'anime'
      )
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setLastSearchQuery(query);
      setSearchLoading(true);
      if (__DEV__) console.log('[Stream] search() request:', { query, malId });
      streamingApi
        .search(query, 1, { malId })
        .then((res) => {
          if (cancelled) return;
          if (__DEV__) console.log('[Stream] search() response:', { resultsCount: res.results.length, first: res.results[0] });
          setSearchResults(res.results);
          if (res.results.length > 0) {
            const pick = { id: res.results[0].id, title: res.results[0].title, image: res.results[0].image };
            setCachedStreamingPick(malId, defaultStreamingApi, pick);
            setSelectedProviderAnime(pick);
            setSearchDrawerVisible(false);
          } else {
            setStreamError('No streams found for this anime. Open the picker below to search manually.');
            setSearchDrawerVisible(true);
          }
        })
        .catch((err) => {
          if (__DEV__) console.warn('[Stream] search() failed:', err);
          if (!cancelled) {
            setSearchResults([]);
            const isNetwork = (err as { message?: string })?.message === 'Network Error' || (err as { code?: string })?.code === 'ERR_NETWORK';
            setStreamError(
              isNetwork
                ? 'Could not reach streaming API. Check your connection and that AnimeAPI URL is set in Settings or .env.'
                : 'Could not load stream source. Try again or check Settings.'
            );
            setSearchDrawerVisible(true);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchLoading(false);
            setResolvingProvider(false);
          }
        });
    }
    return () => { cancelled = true; };
  }, [selectedAnime?.idMal, selectedAnime?.title?.romaji, selectedAnime?.title?.english, selectedEpisode?.id, defaultStreamingApi, streamingApi]);

  useEffect(() => {
    if (
      selectedProviderAnime &&
      selectedAnime &&
      selectedEpisode &&
      defaultStreamingApi
    ) {
      if (__DEV__) console.log('[Stream] fetchStreamingLinks triggered:', { providerAnimeId: selectedProviderAnime.id, episodeNum: selectedEpisode.attributes?.number });
      fetchStreamingLinks();
    }
  }, [selectedProviderAnime?.id, defaultStreamingApi, selectedAnime?.idMal, selectedEpisode?.id, streamingApi]);

  const tabs: { id: TabId; label: string; icon: typeof faInfoCircle }[] = [
    { id: 'episodes', label: 'Episodes', icon: faListOl },
    { id: 'comments', label: 'Comments', icon: faComment },
    { id: 'discussion', label: 'Discussion', icon: faComments },
    { id: 'reviews', label: 'Reviews', icon: faStar },
    { id: 'more', label: 'More like this', icon: faThLarge },
    { id: 'about', label: 'About', icon: faInfoCircle },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'episodes':
        return (
          <View className="flex-1">
            <EpisodesList variant="watch" />
          </View>
        );
      case 'about':
        return (
          <View className="flex-1">
            <AnimeDetails />
          </View>
        );
      case 'comments':
        return (
          <View className="flex-1">
            <AnimeForum
              ref={forumRef}
              id={selectedAnime?.idMal as number}
              filter="episode"
              drawerTopOffset={playerBottomY}
              initialTopicId={episodeForumTopicId ?? undefined}
              initialTopicTitle={
                selectedEpisode?.attributes?.number != null
                  ? `Episode ${selectedEpisode.attributes.number} Discussion`
                  : undefined
              }
              commentsMode
              onDrawerOpenChange={setDiscussionDrawerOpen}
            />
          </View>
        );
      case 'discussion':
        return (
          <View className="flex-1">
            <AnimeForum
              ref={forumRef}
              id={selectedAnime?.idMal as number}
              filter="other"
              drawerTopOffset={playerBottomY}
              onDrawerOpenChange={setDiscussionDrawerOpen}
            />
          </View>
        );
      case 'reviews':
        return (
          <View className="flex-1">
            <ReviewsComponent mal_id={selectedAnime?.idMal as number} />
          </View>
        );
      case 'more':
        return (
          <View className="flex-1">
            <AnimeRecommendation />
          </View>
        );
      default:
        return null;
    }
  };

  const measurePlayerBottom = () => {
    playerContainerRef.current?.measureInWindow((x, y, width, height) => {
      setPlayerBottomY(y + height);
    });
  };

  const posterUri =
    localEpisodePoster?.thumbnail ??
    localEpisodePoster?.image ??
    episodeImage ??
    selectedEpisode?.attributes?.thumbnail?.original ??
    (selectedAnime?.coverImage as { large?: string })?.large ??
    null;

  if (loadingResumeParams) {
    return (
      <View className={`flex-1 justify-center items-center ${bg}`} style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#4a7c7c" />
        <Text className={`${subtext} mt-4`}>Loading...</Text>
      </View>
    );
  }
  if (params.malId && params.episodeNumber && !loadingResumeParams && resumeFromParamsError) {
    return (
      <View className={`flex-1 justify-center items-center px-6 ${bg}`} style={{ paddingTop: insets.top }}>
        <Text className={`${subtext} text-center`}>{resumeFromParamsError}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-5 py-2.5 rounded-full bg-primary"
        >
          <Text className="text-primary-foreground font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${bg}`} style={{ paddingTop: insets.top }}>
      <View ref={playerContainerRef} onLayout={measurePlayerBottom} collapsable={false}>
        {/* Video first (YouTube-style): reserve 16:9 space so layout doesn't jump before stream loads */}
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
          {resolvingProvider ? (
            <View className="flex-1 justify-center items-center">
              {posterUri ? (
                <Image
                  source={{ uri: posterUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : null}
              <View className="absolute inset-0 bg-black/60" />
              <ActivityIndicator size="large" color="#fff" />
              <Text className="text-white mt-2 text-sm">Looking up anime on streaming service...</Text>
              <Text className="text-white/80 mt-1 text-xs">This may take a few seconds</Text>
            </View>
          ) : loading ? (
            <View className="flex-1 justify-center items-center">
              {posterUri ? (
                <Image
                  source={{ uri: posterUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : null}
              <View className="absolute inset-0 bg-black/60" />
              <ActivityIndicator size="large" color="#fff" />
              <Text className="text-white mt-2 text-sm">Loading stream...</Text>
              <Text className="text-white/80 mt-1 text-xs">Fetching video from server</Text>
            </View>
          ) : sources?.length ? (
            <VideoPlayerControls
              sources={sources}
              headers={headers ?? null}
              posterUri={posterUri}
              autoPlay={false}
              initialSeekToSeconds={resumeSeconds > 0 ? resumeSeconds : undefined}
              onProgress={saveProgress}
              controlsVisible={
                sources?.length && hasPlayStarted ? playerOverlayVisible : true
              }
              onOverlayTap={() => setPlayerOverlayVisible(false)}
              onBack={() => router.back()}
              animeTitle={
                (selectedAnime?.title as { romaji?: string; english?: string })?.romaji ??
                (selectedAnime?.title as { romaji?: string; english?: string })?.english ??
                null
              }
              episodeTitle={selectedEpisode?.attributes?.canonicalTitle ?? null}
              episodeNumber={selectedEpisode?.attributes?.number ?? null}
              onPlayStarted={() => {
                setHasPlayStarted(true);
                setPlayerOverlayVisible(true);
                if (playerOverlayHideTimerRef.current) clearTimeout(playerOverlayHideTimerRef.current);
                playerOverlayHideTimerRef.current = setTimeout(() => {
                  playerOverlayHideTimerRef.current = null;
                  setPlayerOverlayVisible(false);
                }, 3000);
              }}
            />
          ) : searchDrawerVisible ? (
            <View className="flex-1 justify-center items-center px-4">
              <Text className={`${subtext} text-center`}>
                {streamError ?? 'Pick the anime below to match it with a streaming source.'}
              </Text>
            </View>
          ) : (
            <View className="flex-1 justify-center items-center px-4">
              <FontAwesomeIcon icon={faCircleExclamation} size={32} color="#9ca3af" />
              <Text className={`${subtext} text-center mt-2`}>
                {streamError ?? 'Couldn\'t load the stream. Tap Retry to try again.'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  fetchStreamingLinks();
                }}
                className="mt-4 px-5 py-2.5 rounded-full bg-primary"
                accessibilityLabel={streamError ? `Retry. ${streamError}` : 'Retry loading stream'}
                accessibilityRole="button"
              >
                <Text className="text-primary-foreground font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Back button when no sources (resolving, loading, error); player has its own back when sources loaded */}
          {!sources?.length && !discussionDrawerOpen ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              className="absolute left-2 z-10 w-10 h-10 rounded-full items-center justify-center bg-black/50"
              style={{ top: insets.top + 8 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <FontAwesomeIcon icon={faChevronLeft} size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {/* When playing and overlay hidden: tap video area to show overlay (back + controls; auto-hide after 3s) */}
          {sources?.length && hasPlayStarted && !playerOverlayVisible && !discussionDrawerOpen ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={showPlayerOverlay}
              accessibilityLabel="Show controls"
            />
          ) : null}
          {/* When discussion drawer is open, tap on video area closes the drawer. Center zone allows touches to pass through so play/pause works. */}
          {discussionDrawerOpen ? (
            <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]} pointerEvents="box-none">
              <Pressable
                style={{ flex: 1 }}
                onPress={() => forumRef.current?.closeDrawer()}
                accessibilityLabel="Close discussion"
              />
              <View style={{ flex: 1 }} pointerEvents="none" />
              <Pressable
                style={{ flex: 1 }}
                onPress={() => forumRef.current?.closeDrawer()}
                accessibilityLabel="Close discussion"
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* Episode title right below player */}
      <View className={`px-3 py-2 border-b ${border} ${cardBg}`} accessibilityRole="summary" accessibilityLabel={`Episode ${selectedEpisode?.attributes?.number ?? '—'}. ${selectedEpisode?.attributes?.canonicalTitle ?? ''}`}>
        <Text
          className={`${text} font-semibold text-base`}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {selectedEpisode?.attributes?.canonicalTitle
            ? `Episode ${selectedEpisode.attributes.number}: ${selectedEpisode.attributes.canonicalTitle}`
            : `Episode ${selectedEpisode?.attributes?.number ?? '—'}`}
        </Text>
      </View>

      {/* Search results drawer: pick which provider anime to use (AnimeAPI cache miss) */}
      <Modal
        visible={searchDrawerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSearchDrawerVisible(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { paddingBottom: Math.max(40, insets.bottom) }]}
          onPress={() => setSearchDrawerVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View className={`${cardBg} rounded-3xl overflow-hidden`} style={styles.modalCardInner}>
              <View style={styles.modalHandle} />
              <View className="flex-row items-center justify-between mb-2">
                <Text className={`${text} font-bold text-lg`}>
                  Pick anime ({currentApiConfig?.label ?? defaultStreamingApi})
                </Text>
                <TouchableOpacity
                  onPress={() => setSearchDrawerVisible(false)}
                  hitSlop={12}
                  className={`w-10 h-10 rounded-full items-center justify-center ${elevated}`}
                >
                  <Text className={`${text} text-xl`}>×</Text>
                </TouchableOpacity>
              </View>
              <Text className={`${subtext} text-xs mb-3`} selectable>
                Search query: "{lastSearchQuery}" · {currentApiConfig?.label ?? defaultStreamingApi}
              </Text>
              {searchLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="large" color="#4a7c7c" />
                  <Text className={`${subtext} mt-2`}>Searching...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View className="py-6">
                  <Text className={`${subtext} text-center`}>
                    No results for query above. Try another provider in Settings.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSearchDrawerVisible(false)}
                    className="mt-4 py-2.5 rounded-full bg-primary self-center px-6"
                  >
                    <Text className="text-primary-foreground font-semibold">Close</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 360 }}
                  showsVerticalScrollIndicator={false}
                >
                  {searchResults.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={async () => {
                        const pick = { id: r.id, title: r.title, image: r.image };
                        if (__DEV__) {
                          console.log('[Stream] Search item selected:', {
                            api: defaultStreamingApi,
                            id: pick.id,
                            title: pick.title,
                          });
                        }
                        await setCachedStreamingPick(
                          selectedAnime!.idMal as number,
                          defaultStreamingApi,
                          pick
                        );
                        setSelectedProviderAnime(pick);
                        setSearchDrawerVisible(false);
                      }}
                      activeOpacity={0.8}
                      className={`flex-row items-center py-3 px-2 rounded-xl mb-1 ${elevated}`}
                    >
                      {r.image ? (
                        <Image
                          source={{ uri: r.image }}
                          style={{ width: 48, height: 64, borderRadius: 6 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          className={`${elevated} rounded`}
                          style={{ width: 48, height: 64 }}
                        />
                      )}
                      <Text
                        className={`${text} flex-1 ml-3 font-medium`}
                        numberOfLines={2}
                      >
                        {r.title ?? r.id}
                      </Text>
                      <FontAwesomeIcon icon={faCheck} size={14} color="#9ca3af" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tabs */}
      <View className={`border-b ${border}`}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 4, flexDirection: 'row', alignItems: 'center' }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                activeTab === tab.id ? 'bg-primary' : elevated
              }`}
            >
              <FontAwesomeIcon
                icon={tab.icon}
                size={12}
                color={activeTab === tab.id ? '#f0f9ff' : '#9ca3af'}
              />
              <Text
                className={`text-xs font-medium ml-1.5 ${
                  activeTab === tab.id ? 'text-primary-foreground' : subtext
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content - each tab provides its own scroll (no nested VirtualizedList) */}
      <View className="flex-1">
        {renderTabContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalCard: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  modalCardInner: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
});

export default WatchEpisode;
