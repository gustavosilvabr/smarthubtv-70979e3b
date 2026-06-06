import { useCallback, useEffect, useRef, useState } from "react";
import type { M3UItem } from "@/types/iptv";

/**
 * Route a URL through the server-side CORS proxy.
 */
function proxied(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  let secureUrl = url;
  if (secureUrl.startsWith("http://")) secureUrl = "https://" + secureUrl.slice(7);
  return `/api/stream?u=${encodeURIComponent(secureUrl)}`;
}

// ─── Tuning constants ─────────────────────────────────────────────────────────
// Goal: SMOOTH playback, not low latency. Big buffers, no chasing.
const LOAD_TIMEOUT_LIVE_MS = 25_000;
const LOAD_TIMEOUT_VOD_MS = 60_000;
const AUTOPLAY_RETRY_MS = 800;
const ERROR_RETRY_MS = 3_000;
const MAX_AUTO_RETRIES = 4;

// ─── HLS.js config — tuned for stability ─────────────────────────────────────
function buildHlsConfig(isLive: boolean) {
  return {
    enableWorker: true,
    lowLatencyMode: false,

    // BIG buffers = no stalls. We accept higher latency for smooth playback.
    maxBufferLength: isLive ? 30 : 30,
    maxMaxBufferLength: isLive ? 90 : 600,
    backBufferLength: isLive ? 20 : 30,
    maxBufferSize: 60 * 1000 * 1000, // 60MB
    maxBufferHole: 0.5,

    // Live tuning: keep us well back from the edge, never chase / speed up.
    liveSyncDurationCount: isLive ? 6 : 3,
    liveMaxLatencyDurationCount: isLive ? 20 : 10,
    maxLiveSyncPlaybackRate: 1, // NO playback-rate chasing (causes audible stutter)

    startPosition: -1,

    // Quality: start LOW so first frames come quick, ABR can climb later.
    startLevel: 0,
    capLevelToPlayerSize: true,
    abrEwmaDefaultEstimate: 1_000_000, // assume 1 Mbps initially → low bitrate
    abrBandwidthFactor: 0.7,
    abrBandwidthSafeFactor: 0.6,
    abrMaxWithRealBitrate: true,

    // Timeouts: generous to ride out brief network hiccups.
    manifestLoadingTimeOut: 15_000,
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 1_000,
    levelLoadingTimeOut: 15_000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 1_000,
    fragLoadingTimeOut: 30_000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1_000,
    fragLoadingMaxRetryTimeout: 64_000,

    // Recover from buffer holes without aggressive seeking.
    nudgeOffset: 0.2,
    nudgeMaxRetry: 5,
    maxStarvationDelay: 10,
    maxLoadingDelay: 10,
  };
}

// ─── mpegts.js config — tuned for stability ──────────────────────────────────
function buildMpegtsConfig(isLive: boolean) {
  return {
    enableWorker: true,
    enableStashBuffer: true,
    stashInitialSize: isLive ? 512 : 256, // bigger stash = fewer stalls
    isLive,
    liveBufferLatencyChasing: false, // DO NOT chase live edge
    lazyLoad: false,
    autoCleanupSourceBuffer: true,
    autoCleanupMaxBackwardDuration: isLive ? 30 : 60,
    autoCleanupMinBackwardDuration: isLive ? 15 : 30,
    fixAudioTimestampGap: true,
  };
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UseHlsPlayerResult {
  loading: boolean;
  error: string;
  retry: () => void;
}

export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  item: M3UItem | null,
): UseHlsPlayerResult {
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const autoRetryCountRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
  }, []);

  const destroyPlayers = useCallback(() => {
    clearRetryTimer();
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
  }, [clearRetryTimer]);

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

    const video = videoRef.current;
    const streamUrl = proxied(item.url);
    const fallbackUrl = item.fallbackUrl ? proxied(item.fallbackUrl) : undefined;
    const isLive = item.type === "live";
    let disposed = false;

    const startTimeout = (onTimeout: () => void) => {
      clearLoadTimeout();
      timeoutRef.current = setTimeout(() => {
        if (disposed) return;
        onTimeout();
      }, isLive ? LOAD_TIMEOUT_LIVE_MS : LOAD_TIMEOUT_VOD_MS);
    };

    const resetVideo = () => {
      destroyPlayers();
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      try { video.load(); } catch {}
    };

    const markPlaying = () => {
      clearLoadTimeout();
      setLoading(false);
      setError("");
    };

    const autoRetryPlay = (v: HTMLVideoElement, fallback?: () => void) => {
      clearRetryTimer();
      if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
        if (fallback) { fallback(); return; }
        setLoading(false);
        setError("Canal indisponível no momento. Tente outro canal.");
        return;
      }
      autoRetryCountRef.current++;
      retryTimerRef.current = setTimeout(() => {
        if (disposed) return;
        v.play().catch(() => autoRetryPlay(v, fallback));
      }, AUTOPLAY_RETRY_MS);
    };

    const showError = (msg: string, autoRetry = false) => {
      clearLoadTimeout();
      if (autoRetry && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
        clearRetryTimer();
        retryTimerRef.current = setTimeout(() => {
          if (disposed) return;
          setAttempt((n) => n + 1);
        }, ERROR_RETRY_MS);
        return;
      }
      setLoading(false);
      setError(msg);
    };

    const playNative = (url: string) => {
      resetVideo();
      startTimeout(() => showError("Não foi possível reproduzir este canal.", true));
      video.src = url;
      video.load();
      video.play().catch(() => autoRetryPlay(video));
    };

    const playTs = async (url: string) => {
      fallbackAttemptedRef.current = true;
      resetVideo();
      try {
        const mod = await import("mpegts.js");
        if (disposed) return;
        const mpegts = mod.default;
        startTimeout(() => showError("Canal temporariamente indisponível.", true));
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url, cors: true } as any,
            buildMpegtsConfig(isLive),
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, (type: any, detail: any, info: any) => {
            console.error("[mpegts] error", type, detail, info);
            showError("Erro ao carregar o canal.", true);
          });
          player.attachMediaElement(video);
          player.load();
          Promise.resolve(player.play()).catch(() => autoRetryPlay(video));
        } else {
          playNative(url);
        }
      } catch (e) {
        console.error("mpegts load failed", e);
        playNative(url);
      }
    };

    const tryFallback = () => {
      if (fallbackUrl && !fallbackAttemptedRef.current) playTs(fallbackUrl);
      else showError("Canal temporariamente indisponível.", true);
    };

    const playWithHls = async (url: string) => {
      resetVideo();
      try {
        const mod = await import("hls.js");
        if (disposed) return;
        const Hls = mod.default;
        startTimeout(tryFallback);

        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) playNative(url);
          else if (fallbackUrl) playTs(fallbackUrl);
          else showError("Este navegador não suporta HLS.");
          return;
        }

        const hls = new Hls(buildHlsConfig(isLive));
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => autoRetryPlay(video, tryFallback));
        });

        let mediaErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (!data.fatal) return;
          console.error("[hls] fatal", data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => { if (!disposed) { try { hls.startLoad(); } catch {} } }, 700);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorCount++;
            if (mediaErrorCount <= 2) { try { hls.recoverMediaError(); } catch {} return; }
          }
          tryFallback();
        });
      } catch (e) {
        console.error("hls.js load failed", e);
        tryFallback();
      }
    };

    setLoading(true);
    setError("");
    fallbackAttemptedRef.current = false;
    autoRetryCountRef.current = 0;
    video.onplaying = markPlaying;
    video.onerror = tryFallback;

    if (/\.m3u8(\?|$)/i.test(streamUrl) || streamUrl.includes("m3u8") || isLive) {
      playWithHls(streamUrl);
    } else {
      playNative(streamUrl);
    }

    return () => {
      disposed = true;
      clearLoadTimeout();
      clearRetryTimer();
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      try { video.load(); } catch {}
    };
  }, [item, attempt, clearLoadTimeout, clearRetryTimer, destroyPlayers, videoRef]);

  return {
    loading,
    error,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
