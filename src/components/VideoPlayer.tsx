import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PictureInPicture2, RotateCcw, X } from "lucide-react";
import type { M3UItem } from "@/types/iptv";

interface Props {
  item: M3UItem | null;
  onClose: () => void;
}

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

const LOAD_TIMEOUT_MS = 18_000;
const LIVE_MAX_DRIFT_S = 25;
const LIVE_EDGE_KEEP_S = 3;
const LIVE_WATCH_INTERVAL_MS = 3_000;
const STALL_TOLERANCE_S = 7;
const AUTOPLAY_RETRY_MS = 1_000;
const ERROR_RETRY_MS = 2_500;
const MAX_AUTO_RETRIES = 6;

let cachedBandwidth = 10;

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

function buildHlsConfig(isLive: boolean, bandwidthMbps: number = 10) {
  let maxBuffer = 12;
  let maxMaxBuffer = 25;
  let backBuffer = 3;
  let syncDuration = 3;
  let maxLatency = 8;
  let playbackRate = 1.1;
  let retries = 4;
  let timeouts = 8000;

  if (bandwidthMbps > 20) {
    maxBuffer = 15;
    maxMaxBuffer = 30;
    backBuffer = 4;
    syncDuration = 4;
    maxLatency = 10;
    playbackRate = 1.05;
    retries = 4;
    timeouts = 10000;
  } else if (bandwidthMbps < 5) {
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
    lowLatencyMode: false,
    maxBufferLength: isLive ? maxBuffer : 30,
    maxMaxBufferLength: isLive ? maxMaxBuffer : 600,
    backBufferLength: isLive ? backBuffer : 30,
    liveSyncDurationCount: isLive ? syncDuration : 3,
    liveMaxLatencyDurationCount: isLive ? maxLatency : 10,
    maxLiveSyncPlaybackRate: isLive ? playbackRate : 1,
    startPosition: isLive ? -1 : 0,
    manifestLoadingTimeOut: timeouts,
    levelLoadingTimeOut: timeouts,
    fragLoadingTimeOut: isLive ? (timeouts - 2000) : 30_000,
    fragLoadingMaxRetry: retries,
    manifestLoadingMaxRetry: retries,
    levelLoadingMaxRetry: retries,
    nudgeOffset: 0.2,
    nudgeMaxRetry: 5,
    fragLoadingMaxRetryTimeout: isLive ? 5_000 : 64_000,
    abrBandwidthFactor: 0.85,
    abrBandwidthSafeFactor: 0.75,
    abrMaxWithRealBitrate: true,
    maxStarvationDelay: isLive ? 4 : 4,
    maxLoadingDelay: isLive ? 4 : 4,
  };
}

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

function startLiveEdgeWatcher(
  video: HTMLVideoElement,
  getDisposed: () => boolean,
): ReturnType<typeof setInterval> {
  let stalledSince: number | null = null;
  let lastTime = video.currentTime;
  let lastCheck = Date.now();

  return setInterval(() => {
    if (getDisposed() || video.paused || video.ended || video.readyState < 2) return;
    const now = Date.now();
    const timeSinceCheck = (now - lastCheck) / 1000;
    const timeAdvanced = video.currentTime - lastTime;

    if (timeAdvanced < timeSinceCheck * 0.5) {
      if (stalledSince === null) stalledSince = now;
      if ((now - stalledSince) > STALL_TOLERANCE_S * 1000) {
        stalledSince = null;
        jumpToLiveEdge(video);
      }
    } else {
      stalledSince = null;
    }
    lastTime = video.currentTime;
    lastCheck = now;

    if (!video.seekable || video.seekable.length === 0) return;
    const liveEdge = video.seekable.end(video.seekable.length - 1);
    if (liveEdge - video.currentTime > LIVE_MAX_DRIFT_S) jumpToLiveEdge(video);
  }, LIVE_WATCH_INTERVAL_MS);
}

function jumpToLiveEdge(video: HTMLVideoElement) {
  try {
    if (video.seekable && video.seekable.length > 0) {
      const target = video.seekable.end(video.seekable.length - 1) - LIVE_EDGE_KEEP_S;
      if (target > video.currentTime) video.currentTime = target;
    }
    if (video.paused) video.play().catch(() => {});
  } catch {}
}

export function VideoPlayer({ item, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const destroyPlayers = useCallback(() => {
    if (watcherRef.current) { clearInterval(watcherRef.current); watcherRef.current = null; }
    clearRetryTimer();
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
  }, [clearRetryTimer]);

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

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
      }, LOAD_TIMEOUT_MS);
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
      if (isLive && !hlsRef.current && !watcherRef.current) {
        watcherRef.current = startLiveEdgeWatcher(video, getDisposed);
      }
    };

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

    const showClickToPlay = () => {
      // Legacy: just trigger auto-retry instead of showing a button
      autoRetryPlay(video);
    };

    const showError = (msg: string, autoRetry = false) => {
      clearLoadTimeout();
      if (watcherRef.current) { clearInterval(watcherRef.current); watcherRef.current = null; }
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
      startTimeout(() =>
        showError("Não foi possível reproduzir este canal.", true),
      );
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
        startTimeout(() =>
          showError(
            "Canal temporariamente indisponível.", true
          ),
        );
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url, cors: true } as any,
            buildMpegtsConfig(isLive, cachedBandwidth),
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, (type: any, detail: any, info: any) => {
            console.error("[mpegts] error", type, detail, info);
            showError(
              "Erro ao carregar o canal.", true
            );
          });
          player.attachMediaElement(video);
          player.load();
          Promise.resolve(player.play()).catch(() => autoRetryPlay(video));
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
        showError(
          "Canal temporariamente indisponível.", true
        );
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
        let mediaErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => { if (!disposed) hls.startLoad(); }, 500);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorCount++;
            if (mediaErrorCount <= 2) { hls.recoverMediaError(); return; }
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
      playWithHls(streamUrl);
    } else {
      playNative(streamUrl);
    }

    return () => {
      disposed = true;
      clearLoadTimeout();
      clearRetryTimer();
      if (watcherRef.current) { clearInterval(watcherRef.current); watcherRef.current = null; }
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [item, attempt, clearLoadTimeout, clearRetryTimer, destroyPlayers]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold text-foreground line-clamp-1">
            {item.name}
          </h2>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <button
              onClick={async () => {
                const v = videoRef.current;
                if (!v) return;
                try {
                  const doc = document as Document & { pictureInPictureElement?: Element | null };
                  if (doc.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                  } else if (typeof v.requestPictureInPicture === "function") {
                    await v.requestPictureInPicture();
                  }
                } catch (e) {
                  console.error("[pip]", e);
                }
              }}
              className="rounded-full bg-secondary p-1.5 sm:p-2 hover:bg-accent transition"
              aria-label="Picture in Picture"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-secondary p-1.5 sm:p-2 hover:bg-accent transition"
              aria-label="Fechar"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-border">
          <video ref={videoRef} controls autoPlay playsInline controlsList="nodownload" className="h-full w-full" />
          {loading && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-20 flex items-center justify-center bg-background/80 text-foreground">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary" />
                Carregando canal...
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-30 flex items-center justify-center bg-background/90 p-3 sm:p-6 text-center text-foreground">
              <div className="max-w-lg">
                <p className="text-xs sm:text-sm md:text-base">{error}</p>
                <button
                  onClick={() => setAttempt((n) => n + 1)}
                  className="mt-3 sm:mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-1.5 sm:mt-2 text-xs text-muted-foreground line-clamp-1">{item.group}</p>
      </div>
    </div>
  );
}
