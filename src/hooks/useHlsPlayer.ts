import { useCallback, useEffect, useRef, useState } from "react";
import type { M3UItem } from "@/types/iptv";

/**
 * Route a URL through the server-side CORS proxy.
 * Always proxy ALL external URLs — the proxy streams the body passthrough
 * so the browser never makes a cross-origin request directly.
 * HTTP URLs are upgraded to HTTPS before proxying to avoid mixed-content issues.
 */
function proxied(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  // Upgrade HTTP to HTTPS so the proxy request itself doesn't have mixed content
  let secureUrl = url;
  if (secureUrl.startsWith("http://")) {
    secureUrl = "https://" + secureUrl.slice(7);
  }
  return `/api/stream?u=${encodeURIComponent(secureUrl)}`;
}

// ─── Low-latency constants ────────────────────────────────────────────────────

/** Max seconds behind the live edge before we jump forward */
const LIVE_MAX_DRIFT_S = 25;
/** How close to stay to the live edge (seconds) */
const LIVE_EDGE_KEEP_S = 3;
/** How often (ms) to check and chase the live edge for native/mpegts players */
const LIVE_WATCH_INTERVAL_MS = 3_000;
/** How many seconds a stall is tolerated before forcing a seek to live edge */
const STALL_TOLERANCE_S = 7;
/** Load timeout for live streams */
const LOAD_TIMEOUT_LIVE_MS = 18_000;
/** Load timeout for VOD */
const LOAD_TIMEOUT_VOD_MS = 60_000;
/** Delay before auto-retrying after autoplay block (ms) */
const AUTOPLAY_RETRY_MS = 1_000;
/** Delay before auto-retrying after a stream error (ms) */
const ERROR_RETRY_MS = 2_500;
/** Maximum number of auto-retries before giving up */
const MAX_AUTO_RETRIES = 6;

// ─── Shared HLS.js config (tuned for live IPTV stability) ────────────────────
function buildHlsConfig(isLive: boolean, bandwidthMbps: number = 10) {
  // Adapt buffer size based on bandwidth
  let maxBuffer = 12;
  let maxMaxBuffer = 25;
  let backBuffer = 3;
  let syncDuration = 3;
  let maxLatency = 8;
  let playbackRate = 1.1;
  let retries = 4;
  let timeouts = 8000;

  if (bandwidthMbps > 20) {
    // Good connection: larger buffer for stability
    maxBuffer = 15;
    maxMaxBuffer = 30;
    backBuffer = 4;
    syncDuration = 4;
    maxLatency = 10;
    playbackRate = 1.05;
    retries = 4;
    timeouts = 10000;
  } else if (bandwidthMbps < 5) {
    // Slow connection: minimal buffer to avoid stalls
    maxBuffer = 6;
    maxMaxBuffer = 12;
    backBuffer = 2;
    syncDuration = 2;
    maxLatency = 5;
    playbackRate = 1.2;
    retries = 3;
    timeouts = 6000;
  }

  return {
    enableWorker: true,
    lowLatencyMode: false, // Disable LL-HLS, use standard HLS for stability

    maxBufferLength: isLive ? maxBuffer : 30,
    maxMaxBufferLength: isLive ? maxMaxBuffer : 600,
    backBufferLength: isLive ? backBuffer : 30,

    liveSyncDurationCount: isLive ? syncDuration : 3,
    liveMaxLatencyDurationCount: isLive ? maxLatency : 10,
    maxLiveSyncPlaybackRate: isLive ? playbackRate : 1,

    startPosition: isLive ? -1 : 0,

    // Timeouts: balanced for stability
    manifestLoadingTimeOut: timeouts,
    levelLoadingTimeOut: timeouts,
    fragLoadingTimeOut: isLive ? (timeouts - 2000) : 30_000,
    fragLoadingMaxRetry: retries,
    manifestLoadingMaxRetry: retries,
    levelLoadingMaxRetry: retries,

    // Don't skip fragments too aggressively
    nudgeOffset: 0.2,
    nudgeMaxRetry: 5,

    fragLoadingMaxRetryTimeout: isLive ? 5_000 : 64_000,

    // Bandwidth estimation
    abrBandwidthFactor: 0.85,
    abrBandwidthSafeFactor: 0.75,
    abrMaxWithRealBitrate: true,
    maxStarvationDelay: isLive ? 4 : 4,
    maxLoadingDelay: isLive ? 4 : 4,
  };
}

// ─── Shared mpegts config (tuned for live IPTV) ──────────────────────────────
function buildMpegtsConfig(isLive: boolean, bandwidthMbps: number = 10) {
  const hasGoodBandwidth = bandwidthMbps > 20;

  return {
    enableWorker: true,
    enableStashBuffer: isLive,
    stashInitialSize: isLive ? (hasGoodBandwidth ? 384 : 256) : 128,
    isLive,
    liveBufferLatencyChasing: isLive,
    liveBufferLatencyMaxLatency: hasGoodBandwidth ? 4.0 : 2.0,
    liveBufferLatencyMinRemain: hasGoodBandwidth ? 1.5 : 0.8,
    lazyLoad: false,
    autoCleanupSourceBuffer: isLive,
    autoCleanupMaxBackwardDuration: isLive ? (hasGoodBandwidth ? 12 : 8) : 30,
    autoCleanupMinBackwardDuration: isLive ? (hasGoodBandwidth ? 8 : 5) : 20,
  };
}

// ─── Live-edge watcher ────────────────────────────────────────────────────────
/**
 * For native / mpegts players that don't have built-in catch-up:
 * Periodically measure how far behind the live edge the video is,
 * and if it exceeds LIVE_MAX_DRIFT_S, seek to the edge minus LIVE_EDGE_KEEP_S.
 * Also recovers from stalls.
 */
function startLiveEdgeWatcher(
  video: HTMLVideoElement,
  getDisposed: () => boolean,
): ReturnType<typeof setInterval> {
  let stalledSince: number | null = null;
  let lastTime = video.currentTime;
  let lastCheck = Date.now();

  return setInterval(() => {
    if (getDisposed() || video.paused || video.ended || video.readyState < 2) return;

    // --- stall detection: if time hasn't advanced, we're stuck ---
    const now = Date.now();
    const timeSinceCheck = (now - lastCheck) / 1000;
    const timeAdvanced = video.currentTime - lastTime;

    if (timeAdvanced < timeSinceCheck * 0.5) {
      if (stalledSince === null) stalledSince = now;
      if ((now - stalledSince) > STALL_TOLERANCE_S * 1000) {
        console.debug("[live-watcher] stall detected, seeking to live edge");
        stalledSince = null;
        jumpToLiveEdge(video);
      }
    } else {
      stalledSince = null;
    }
    lastTime = video.currentTime;
    lastCheck = now;

    // --- live edge drift detection ---
    if (!video.seekable || video.seekable.length === 0) return;
    const liveEdge = video.seekable.end(video.seekable.length - 1);
    const drift = liveEdge - video.currentTime;

    if (drift > LIVE_MAX_DRIFT_S) {
      console.debug(`[live-watcher] drift=${drift.toFixed(1)}s → jumping to live edge`);
      jumpToLiveEdge(video);
    }
  }, LIVE_WATCH_INTERVAL_MS);
}

function jumpToLiveEdge(video: HTMLVideoElement) {
  try {
    if (video.seekable && video.seekable.length > 0) {
      const target = video.seekable.end(video.seekable.length - 1) - LIVE_EDGE_KEEP_S;
      if (target > video.currentTime) {
        video.currentTime = target;
      }
    }
    if (video.paused) video.play().catch(() => {});
  } catch (e) {
    console.debug("[live-watcher] seek error", e);
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UseHlsPlayerResult {
  loading: boolean;
  error: string;
  retry: () => void;
}

let cachedBandwidth = 10; // Default 10 Mbps

/**
 * Quick bandwidth test (non-blocking)
 */
async function testBandwidthQuick() {
  try {
    const start = performance.now();
    const res = await fetch("/api/stream?u=" + encodeURIComponent("https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png"), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.body) return;
    let bytes = 0;
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.length || 0;
    }
    const duration = (performance.now() - start) / 1000;
    const bandwidthMbps = (bytes * 8) / duration / 1_000_000;
    cachedBandwidth = Math.max(1, Math.min(100, bandwidthMbps));
  } catch {}
}

/**
 * Attach an HLS / mpegts player to a <video> element for the given item.
 * Optimised for minimum latency on live streams.
 */
export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  item: M3UItem | null,
): UseHlsPlayerResult {
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const stopWatcher = useCallback(() => {
    if (watcherRef.current) { clearInterval(watcherRef.current); watcherRef.current = null; }
  }, []);

  const destroyPlayers = useCallback(() => {
    stopWatcher();
    clearRetryTimer();
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
  }, [stopWatcher, clearRetryTimer]);

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

    // Test bandwidth in background (non-blocking)
    testBandwidthQuick().catch(() => {});

    const video = videoRef.current;
    const streamUrl = proxied(item.url);
    const fallbackUrl = item.fallbackUrl ? proxied(item.fallbackUrl) : undefined;
    const isLive = item.type === "live";
    let disposed = false;
    const getDisposed = () => disposed;

    const startTimeout = (onTimeout: () => void) => {
      clearLoadTimeout();
      timeoutRef.current = setTimeout(() => {
        if (disposed) return;
        onTimeout();
      }, isLive ? LOAD_TIMEOUT_LIVE_MS : LOAD_TIMEOUT_VOD_MS);
    };

    const resetVideo = () => {
      destroyPlayers();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const markPlaying = () => {
      clearLoadTimeout();
      setLoading(false);
      setError("");
      // Start watcher for native/mpegts live streams
      if (isLive && !hlsRef.current && !watcherRef.current) {
        watcherRef.current = startLiveEdgeWatcher(video, getDisposed);
      }
    };

    // Auto-retry on autoplay block: browsers require user gesture for first play,
    // so we silently retry with a short delay instead of asking the user to click.
    const autoRetryPlay = (video: HTMLVideoElement, fallback?: () => void) => {
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
        video.play().catch(() => autoRetryPlay(video, fallback));
      }, AUTOPLAY_RETRY_MS);
    };

    const showError = (msg: string, autoRetry = false) => {
      clearLoadTimeout();
      stopWatcher();
      if (autoRetry && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
        // Silently retry instead of showing error to user
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
            buildMpegtsConfig(isLive, cachedBandwidth),
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, (type: any, detail: any, info: any) => {
            console.error("[mpegts] error", type, detail, info);
            showError("Erro ao carregar o canal.", true);
          });
          player.attachMediaElement(video);
          player.load();
          Promise.resolve(player.play()).catch(() => autoRetryPlay(video));
          // mpegts has its own latency chasing; also add our watcher as safety net
          if (isLive) {
            watcherRef.current = startLiveEdgeWatcher(video, getDisposed);
          }
        } else {
          playNative(url);
        }
      } catch (e) {
        console.error("mpegts load failed", e);
        playNative(url);
      }
    };

    const tryFallback = () => {
      if (fallbackUrl && !fallbackAttemptedRef.current) {
        playTs(fallbackUrl);
      } else {
        showError("Canal temporariamente indisponível.", true);
      }
    };

    const playWithHls = async (url: string) => {
      resetVideo();
      try {
        const mod = await import("hls.js");
        if (disposed) return;
        const Hls = mod.default;
        startTimeout(tryFallback);

        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            playNative(url);
          } else if (fallbackUrl) {
            playTs(fallbackUrl);
          } else {
            showError("Este navegador não suporta HLS.");
          }
          return;
        }

        const hls = new Hls(buildHlsConfig(isLive, cachedBandwidth));
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => autoRetryPlay(video, tryFallback));
        });

        // Monitor latency on each fragment and log (debug only)
        if (isLive) {
          hls.on(Hls.Events.FRAG_BUFFERED, (_: any, data: any) => {
            try {
              const latency = hls.latency;
              if (latency !== undefined && latency > LIVE_MAX_DRIFT_S * 1.2) {
                console.debug(`[hls] high latency=${latency.toFixed(1)}s → seeking to edge`);
                jumpToLiveEdge(video);
              }
            } catch {}
          });
        }

        let mediaErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (!data.fatal) {
            console.debug("[hls] non-fatal error", data.type, data.details);
            return;
          }
          console.error("[hls] fatal error", data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => { if (!disposed) hls.startLoad(); }, 500);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorCount++;
            if (mediaErrorCount <= 2) {
              hls.recoverMediaError();
              return;
            }
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

    if (/\.m3u8(\?|$)/i.test(streamUrl) || streamUrl.includes("m3u8")) {
      playWithHls(streamUrl);
    } else if (/\.ts(\?|$)/i.test(streamUrl) || isLive) {
      // Try HLS first for live (most IPTV servers serve HLS even without .m3u8 extension)
      playWithHls(streamUrl);
    } else {
      playNative(streamUrl);
    }

    return () => {
      disposed = true;
      clearLoadTimeout();
      clearRetryTimer();
      stopWatcher();
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [item, attempt, clearLoadTimeout, clearRetryTimer, destroyPlayers, stopWatcher, videoRef]);

  return {
    loading,
    error,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
