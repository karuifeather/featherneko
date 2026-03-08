import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Platform } from 'react-native';
import Hls from 'hls.js';

function useVideoSize(ref: React.RefObject<HTMLVideoElement | null>, onSize: (width: number, height: number) => void) {
  const onSizeRef = useRef(onSize);
  onSizeRef.current = onSize;
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const handler = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) onSizeRef.current(w, h);
    };
    video.addEventListener('loadedmetadata', handler);
    if (video.videoWidth > 0 && video.videoHeight > 0) handler();
    return () => video.removeEventListener('loadedmetadata', handler);
  }, [ref]);
}

/** Headers to send with every HLS request (manifest + segments). */
export interface HLSHeaders {
  Referer?: string;
  'User-Agent'?: string;
  Origin?: string;
  [key: string]: string | undefined;
}

export interface WebHLSPlayerRef {
  play: () => void;
  pause: () => void;
  /** Seek by relative seconds (e.g. -10 or +10). */
  seekBy: (seconds: number) => void;
  /** Seek to absolute position in seconds */
  seekTo: (seconds: number) => void;
  /** Enter fullscreen (web only) */
  enterFullscreen?: () => Promise<void>;
  /** Exit fullscreen (web only) */
  exitFullscreen?: () => Promise<void>;
  /** Is video currently playing */
  paused: boolean;
}

interface WebHLSPlayerProps {
  src: string;
  headers: HLSHeaders | null;
  onError?: (message: string) => void;
  style?: { aspectRatio?: number };
  className?: string;
  /** 'contain' = preserve aspect ratio, no stretching (e.g. square video stays square) */
  contentFit?: 'contain' | 'cover';
  /** Called when video dimensions are known (for container aspect ratio) */
  onVideoSize?: (width: number, height: number) => void;
  /** Called when buffering state changes (e.g. show loading spinner) */
  onBufferingChange?: (buffering: boolean) => void;
  /** Seek to this position (seconds) when playback is ready (resume from last watched). */
  initialSeekToSeconds?: number;
  /** Called periodically with current time (seconds) so parent can persist progress. */
  onProgress?: (currentTimeSeconds: number) => void;
  /** Called when play/pause state changes */
  onPlayingChange?: (playing: boolean) => void;
  /** Called when duration is known */
  onDuration?: (duration: number) => void;
  /** Called when buffered range changes (end of buffered region in seconds) */
  onBufferedChange?: (bufferedEndSeconds: number) => void;
}

/**
 * Web-only HLS player using hls.js so we can send custom headers (Referer, Origin, etc.)
 * on every request. The native <video> element and expo-av on web do not send headers
 * for HLS segment requests, which causes 403 from CDNs that require them.
 */
export const WebHLSPlayer = forwardRef<WebHLSPlayerRef, WebHLSPlayerProps>(function WebHLSPlayer({
  src,
  headers,
  onError,
  style,
  className,
  contentFit = 'contain',
  onVideoSize,
  onBufferingChange,
  initialSeekToSeconds,
  onProgress,
  onPlayingChange,
  onDuration,
  onBufferedChange,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hasAppliedInitialSeekRef = useRef(false);

  useVideoSize(videoRef, (w, h) => onVideoSize?.(w, h));

  // Defer initial seek until playing; seeking at canplay can leave HLS stuck loading.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlaying = () => {
      if (
        initialSeekToSeconds != null &&
        initialSeekToSeconds > 0 &&
        !hasAppliedInitialSeekRef.current
      ) {
        hasAppliedInitialSeekRef.current = true;
        const t = initialSeekToSeconds;
        setTimeout(() => {
          try {
            if (videoRef.current && !isNaN(t)) videoRef.current.currentTime = t;
          } catch (e) {
            if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[WebHLS] initial seek failed', e);
          }
        }, 100);
      }
    };
    video.addEventListener('playing', onPlaying);
    if (video.readyState >= 2 && !video.paused) onPlaying();
    return () => video.removeEventListener('playing', onPlaying);
  }, [initialSeekToSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadedMetadata = () => {
      if (video.duration > 0 && !isNaN(video.duration)) onDuration?.(video.duration);
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    if (video.duration > 0 && !isNaN(video.duration)) onDuration?.(video.duration);
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
  }, [onDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;
    const interval = setInterval(() => {
      if (!video.paused && video.duration > 0) onProgress(video.currentTime);
    }, 5000);
    return () => {
      clearInterval(interval);
      if (video.duration > 0) onProgress(video.currentTime);
    };
  }, [onProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onPlayingChange) return;
    const onPlay = () => onPlayingChange(true);
    const onPause = () => onPlayingChange(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlay);
    video.addEventListener('pause', onPause);
    onPlayingChange(!video.paused);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onBufferingChange) return;
    const onWaiting = () => onBufferingChange(true);
    const onCanPlay = () => onBufferingChange(false);
    const onPlaying = () => onBufferingChange(false);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    return () => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
    };
  }, [onBufferingChange]);

  // Poll buffered range for scrubber (end of loaded region in seconds)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onBufferedChange) return;
    const getBufferedEnd = (): number => {
      const b = video.buffered;
      const t = video.currentTime;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= t && t <= b.end(i)) return b.end(i);
      }
      return t;
    };
    const interval = setInterval(() => {
      if (video.duration > 0 && !isNaN(video.duration) && video.buffered.length > 0) {
        onBufferedChange(getBufferedEnd());
      }
    }, 500);
    if (video.buffered.length > 0) onBufferedChange(getBufferedEnd());
    return () => clearInterval(interval);
  }, [onBufferedChange]);

  useImperativeHandle(ref, () => ({
    play: () => {
      videoRef.current?.play();
    },
    pause: () => {
      videoRef.current?.pause();
    },
    seekBy: (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = video.currentTime + seconds;
      video.currentTime = Math.max(0, Math.min(next, video.duration || next));
    },
    seekTo: (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, seconds);
    },
    enterFullscreen: async () => {
      const video = videoRef.current;
      if (!video) return;
      const ex = video.requestFullscreen ?? (video as HTMLVideoElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen;
      if (ex) await ex.call(video);
    },
    exitFullscreen: async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    },
    get paused() {
      return videoRef.current?.paused ?? true;
    },
  }), []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    if (!Hls.isSupported()) {
      onError?.('HLS is not supported in this browser.');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const headerEntries =
      headers && typeof headers === 'object'
        ? Object.entries(headers).filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === 'string' && typeof entry[1] === 'string'
          )
        : [];

    const hls = new Hls({
      xhrSetup(xhr: XMLHttpRequest) {
        headerEntries.forEach(([key, value]) => {
          try {
            xhr.setRequestHeader(key, value);
          } catch (e) {
            if (__DEV__) console.warn('[WebHLS] setRequestHeader failed', key, e);
          }
        });
      },
    });

    hlsRef.current = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (__DEV__) console.log('[WebHLS] Manifest parsed');
    });

    hls.on(Hls.Events.ERROR, (_event, data: { fatal?: boolean; details?: string; error?: Error; response?: { code?: number } }) => {
      const fatal = data.fatal;
      const msg =
        data.error?.message ??
        (data as { reason?: string }).reason ??
        (data as { details?: string }).details ??
        'HLS error';
      const code = data.response?.code;
      if (__DEV__) console.error('[WebHLS] Error', { fatal, details: data.details, msg, code, data });
      if (fatal) {
        const out = `HLS error: ${msg}${code != null ? ` (${code})` : ''}`;
        onError?.(out);
      }
    });

    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [src, headers, onError]);

  if (Platform.OS !== 'web') return null;

  return (
    <video
      ref={videoRef}
      className={className}
      style={{
        width: '100%',
        maxHeight: 256,
        aspectRatio: style?.aspectRatio ?? 16 / 9,
        backgroundColor: '#000',
        borderRadius: 8,
        objectFit: contentFit,
      }}
      playsInline
      muted={false}
    />
  );
});
