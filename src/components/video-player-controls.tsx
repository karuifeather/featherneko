import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Platform,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { VideoSource } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { WebHLSPlayer, type WebHLSPlayerRef } from '@/components/web-hls-player';
import { DARK_HEX } from '@/constants/designTokens';
import {
  PlayerTopBar,
  PlayerCenterControls,
  PlayerBottomControls,
  PlayerStateOverlay,
  DoubleTapZone,
  PlayerOverlayGradients,
} from '@/components/player';

interface Source {
  url: string;
  quality: string;
  isM3U8: boolean;
}

export interface Headers {
  Referer?: string;
  'User-Agent'?: string;
  Origin?: string;
  [key: string]: string | undefined;
}

interface VideoPlayerControlsProps {
  sources: Source[];
  headers: Headers | null;
  posterUri?: string | null;
  autoPlay?: boolean;
  onPlayStarted?: () => void;
  initialSeekToSeconds?: number;
  onProgress?: (currentTimeSeconds: number) => void;
  /** When true, show custom controls overlay (for parent to control visibility) */
  controlsVisible?: boolean;
  /** Called when user single-taps overlay (to hide) */
  onOverlayTap?: () => void;
  /** Back navigation (rendered in top zone) */
  onBack?: () => void;
  /** Anime title for top bar */
  animeTitle?: string | null;
  /** Episode title for top bar */
  episodeTitle?: string | null;
  /** Episode number for top bar */
  episodeNumber?: number | null;
}

function buildExpoVideoSource(
  uri: string,
  headers: Headers | null,
  isM3U8: boolean
): VideoSource {
  if (!uri) return null;
  const base: { uri: string; headers?: Record<string, string>; contentType?: 'hls' } = {
    uri,
  };
  if (headers && Object.keys(headers).length > 0) {
    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v != null && typeof v === 'string') rec[k] = v;
    }
    if (Object.keys(rec).length > 0) {
      base.headers = rec;
    }
  }
  if (isM3U8) {
    base.contentType = 'hls';
  }
  return base;
}

const DEFAULT_ASPECT = 16 / 9;

/** Set to true when streaming servers support seeking. */
const SEEK_ENABLED = false;

const VideoPlayerControls = ({
  sources,
  headers,
  posterUri,
  autoPlay = false,
  onPlayStarted,
  initialSeekToSeconds,
  onProgress,
  controlsVisible = true,
  onOverlayTap,
  onBack,
  animeTitle,
  episodeTitle,
  episodeNumber,
}: VideoPlayerControlsProps) => {
  const [hasStartedPlaying, setHasStartedPlaying] = useState(autoPlay);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState<number | undefined>(undefined);
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optimisticPlayPauseAtRef = useRef<number>(0);
  const webHlsRef = useRef<WebHLSPlayerRef>(null);
  const videoViewRef = useRef<InstanceType<typeof VideoView> | null>(null);
  const hasAppliedInitialSeekRef = useRef(false);
  const firstSource = sources[0];
  const aspectRatio = videoAspectRatio ?? DEFAULT_ASPECT;

  const useWebHLS =
    Platform.OS === 'web' &&
    !!headers &&
    Object.keys(headers).length > 0 &&
    (firstSource?.isM3U8 ?? false);

  const expoVideoSource = buildExpoVideoSource(
    firstSource?.url ?? '',
    headers,
    firstSource?.isM3U8 ?? false
  );

  const player = useVideoPlayer(
    useWebHLS ? null : expoVideoSource,
    (p) => {
      p.loop = true;
      p.timeUpdateEventInterval = 0.5;
      if (hasStartedPlaying && autoPlay) {
        p.play();
      }
    }
  );

  const setBuffering = useCallback((value: boolean) => {
    if (value) {
      setIsBuffering(true);
      if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = setTimeout(() => {
        bufferingTimeoutRef.current = null;
        setIsBuffering(false);
      }, 15000);
    } else {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
      setIsBuffering(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setStreamError(null);
    setBufferedEnd(undefined);
  }, [firstSource?.url]);

  useEffect(() => {
    if (useWebHLS || !player) return;
    const unsubStatus = player.addListener('statusChange', (e) => {
      if (e.status === 'loading') setBuffering(true);
      else if (e.status === 'readyToPlay' || e.status === 'idle') setBuffering(false);
      else if (e.status === 'error' && e.error) {
        setStreamError(e.error.message);
        setBuffering(false);
        if (__DEV__) console.error('[Video]', e.error.message);
      }
    });
    const unsubPlaying = player.addListener('playingChange', (e) => {
      const now = Date.now();
      if (now - optimisticPlayPauseAtRef.current >= 200) {
        setIsPlaying(e.isPlaying);
      }
    });
    const unsubTime = player.addListener('timeUpdate', (e) => {
      setCurrentTime(e.currentTime);
      if (e.bufferedPosition >= 0) setBufferedEnd(e.bufferedPosition);
    });
    const unsubLoad = player.addListener('sourceLoad', (e) => {
      if (e.duration > 0) setDuration(e.duration);
      if (e.availableVideoTracks?.length) {
        const track = e.availableVideoTracks[0];
        if (track?.size?.width && track?.size?.height) {
          setVideoAspectRatio(track.size.width / track.size.height);
        }
      }
    });
    return () => {
      unsubStatus?.remove();
      unsubPlaying?.remove();
      unsubTime?.remove();
      unsubLoad?.remove();
    };
  }, [useWebHLS, player, setBuffering]);

  const lastReplacedUriRef = useRef<string | null>(null);
  useEffect(() => {
    if (useWebHLS || !player || !expoVideoSource) return;
    const uri = firstSource?.url ?? '';
    if (lastReplacedUriRef.current === uri) return;
    lastReplacedUriRef.current = uri;
    player.replaceAsync(expoVideoSource).catch(() => {});
  }, [useWebHLS, player, expoVideoSource, firstSource?.url]);

  const onFirstFrameRender = useCallback(() => {
    if (player?.status === 'readyToPlay' && player.duration > 0) {
      setDuration(player.duration);
      const track = player.videoTrack;
      if (track?.size?.width && track?.size?.height) {
        setVideoAspectRatio(track.size.width / track.size.height);
      }
    }
  }, [player]);

  const onPlayPress = () => {
    setHasStartedPlaying(true);
    setStreamError(null);
    onPlayStarted?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (useWebHLS) {
      webHlsRef.current?.play();
    } else {
      player?.play();
    }
  };

  const onPausePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (useWebHLS) {
      webHlsRef.current?.pause();
    } else {
      player?.pause();
    }
  };

  const onPlayPause = () => {
    if (useWebHLS) {
      if (isPlaying) {
        webHlsRef.current?.pause();
        setIsPlaying(false);
      } else {
        webHlsRef.current?.play();
        setIsPlaying(true);
      }
    } else if (isPlaying) {
      optimisticPlayPauseAtRef.current = Date.now();
      setIsPlaying(false);
      onPausePress();
    } else {
      optimisticPlayPauseAtRef.current = Date.now();
      setIsPlaying(true);
      onPlayPress();
    }
  };

  const onSeek = useCallback(
    (x: number) => {
      if (scrubberWidth <= 0 || duration <= 0) return;
      const ratio = Math.max(0, Math.min(1, x / scrubberWidth));
      const target = ratio * duration;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (useWebHLS && webHlsRef.current) {
        (webHlsRef.current as { seekTo?: (s: number) => void }).seekTo?.(target);
        setCurrentTime(target);
      } else if (player) {
        player.currentTime = target;
        setCurrentTime(target);
      }
    },
    [scrubberWidth, duration, useWebHLS, player]
  );

  const onSkipBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = Math.max(0, currentTime - 10);
    if (useWebHLS && webHlsRef.current) {
      webHlsRef.current.seekBy(-10);
      setCurrentTime(target);
    } else if (player) {
      player.seekBy(-10);
      setCurrentTime(target);
    }
  };

  const onSkipForward = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = Math.min(duration, currentTime + 10);
    if (useWebHLS && webHlsRef.current) {
      webHlsRef.current.seekBy(10);
      setCurrentTime(target);
    } else if (player) {
      player.seekBy(10);
      setCurrentTime(target);
    }
  };

  const onWebHlsError = useCallback((msg: string) => {
    setStreamError(msg);
    if (__DEV__) console.error('[Video]', msg);
  }, []);

  const onFullscreen = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (useWebHLS && webHlsRef.current?.enterFullscreen) {
      await webHlsRef.current.enterFullscreen();
    } else {
      await videoViewRef.current?.enterFullscreen();
    }
  }, [useWebHLS]);

  useEffect(() => {
    if (useWebHLS || !onProgress) return;
    const interval = setInterval(() => {
      if (isPlaying && duration > 0) {
        onProgress(currentTime);
      }
    }, 5000);
    return () => {
      clearInterval(interval);
      if (duration > 0) onProgress(currentTime);
    };
  }, [useWebHLS, isPlaying, duration, currentTime, onProgress]);

  useEffect(() => {
    if (!useWebHLS && player && hasStartedPlaying && autoPlay) {
      player.play();
    }
  }, [useWebHLS, hasStartedPlaying, autoPlay, player]);

  useEffect(() => {
    if (
      !useWebHLS &&
      player &&
      SEEK_ENABLED &&
      player.playing &&
      initialSeekToSeconds != null &&
      initialSeekToSeconds > 0 &&
      !hasAppliedInitialSeekRef.current
    ) {
      hasAppliedInitialSeekRef.current = true;
      player.currentTime = initialSeekToSeconds;
    }
  }, [useWebHLS, player?.playing, initialSeekToSeconds]);

  const showPoster = !hasStartedPlaying && (posterUri || !autoPlay);
  const showControls = hasStartedPlaying && controlsVisible && !showPoster;
  const showError = !!streamError && hasStartedPlaying;
  const shouldRenderOverlay = hasStartedPlaying && !showPoster && !showError;

  const overlayOpacity = useRef(new Animated.Value(controlsVisible ? 1 : 0)).current;
  useEffect(() => {
    if (!shouldRenderOverlay) return;
    Animated.timing(overlayOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, shouldRenderOverlay, overlayOpacity]);

  const renderPosterOverlay = () => (
    <View style={[StyleSheet.absoluteFill, styles.overlayRoot]}>
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.posterScrim} />
      {onBack && (
        <PlayerTopBar
          onBack={onBack}
          animeTitle={animeTitle}
          episodeTitle={episodeTitle}
          episodeNumber={episodeNumber}
          onFullscreen={onFullscreen}
        />
      )}
      <PlayerStateOverlay
        variant="pre-play"
        onTapToPlay={onPlayPress}
      />
    </View>
  );

  const renderControlsOverlay = () => (
    <View style={[StyleSheet.absoluteFill, styles.overlayRoot]} pointerEvents="box-none">
      <PlayerOverlayGradients />
      <View style={styles.overlayContent}>
        {onBack && (
          <PlayerTopBar
            onBack={onBack}
            animeTitle={animeTitle}
            episodeTitle={episodeTitle}
            episodeNumber={episodeNumber}
            onFullscreen={onFullscreen}
          />
        )}
        <View style={styles.centerRow}>
          <DoubleTapZone
            side="left"
            onSingleTap={() => onOverlayTap?.()}
            onDoubleTap={SEEK_ENABLED ? onSkipBack : () => {}}
            style={styles.doubleTapPane}
          />
          <View style={styles.centerPane}>
            <PlayerCenterControls
              isPlaying={isPlaying}
              onPlayPause={onPlayPause}
              onSkipBack={SEEK_ENABLED ? onSkipBack : undefined}
              onSkipForward={SEEK_ENABLED ? onSkipForward : undefined}
            />
          </View>
          <DoubleTapZone
            side="right"
            onSingleTap={() => onOverlayTap?.()}
            onDoubleTap={SEEK_ENABLED ? onSkipForward : () => {}}
            style={styles.doubleTapPane}
          />
        </View>
        <PlayerBottomControls
          currentTime={currentTime}
          duration={duration}
          bufferedEnd={bufferedEnd}
          scrubberWidth={scrubberWidth}
          onScrubberLayout={setScrubberWidth}
          onSeek={SEEK_ENABLED ? onSeek : undefined}
        />
      </View>
    </View>
  );

  const renderBufferingOverlay = () => (
    <PlayerStateOverlay variant="buffering" />
  );

  const renderErrorOverlay = () => (
    <View style={[StyleSheet.absoluteFill, styles.overlayRoot]}>
      <View style={styles.posterScrim} />
      {onBack && (
        <PlayerTopBar
          onBack={onBack}
          animeTitle={animeTitle}
          episodeTitle={episodeTitle}
          episodeNumber={episodeNumber}
          onFullscreen={onFullscreen}
        />
      )}
      <PlayerStateOverlay
        variant="error"
        errorMessage={streamError}
        onRetry={() => {
          setStreamError(null);
          if (useWebHLS && webHlsRef.current) {
            webHlsRef.current.play();
          } else {
            player?.play();
          }
        }}
      />
    </View>
  );

  const renderNativeVideo = () =>
    player ? (
      <VideoView
        ref={videoViewRef}
        player={player}
        style={{ aspectRatio }}
        contentFit="contain"
        nativeControls={false}
        onFirstFrameRender={onFirstFrameRender}
        fullscreenOptions={{ enable: true }}
      />
    ) : null;

  const renderPlayerContent = () => (
    <>
      {useWebHLS ? (
        <WebHLSPlayer
          ref={webHlsRef}
          src={firstSource?.url ?? ''}
          headers={headers}
          onError={onWebHlsError}
          style={{ aspectRatio }}
          className="w-full bg-black"
          contentFit="contain"
          onVideoSize={(w, h) => setVideoAspectRatio(w / h)}
          onBufferingChange={setBuffering}
          initialSeekToSeconds={SEEK_ENABLED ? initialSeekToSeconds : undefined}
          onProgress={(t) => {
            setCurrentTime(t);
            onProgress?.(t);
          }}
          onPlayingChange={setIsPlaying}
          onDuration={setDuration}
          onBufferedChange={setBufferedEnd}
        />
      ) : (
        renderNativeVideo()
      )}
      {showPoster && renderPosterOverlay()}
      {shouldRenderOverlay && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: overlayOpacity, zIndex: 10 }]}
          pointerEvents={controlsVisible ? 'box-none' : 'none'}
        >
          {renderControlsOverlay()}
        </Animated.View>
      )}
      {!showPoster && !showError && isBuffering && renderBufferingOverlay()}
      {showError && renderErrorOverlay()}
    </>
  );

  return (
    <View
      style={{
        width: '100%',
        aspectRatio,
        backgroundColor: DARK_HEX.bg,
        borderRadius: 12,
      }}
    >
      <View style={styles.playerInner}>
        {renderPlayerContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  playerInner: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
  },
  posterScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayRoot: {
    flex: 1,
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  centerPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubleTapPane: {
    flex: 1,
    alignSelf: 'stretch',
  },
});

export default VideoPlayerControls;
