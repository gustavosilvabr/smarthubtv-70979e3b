import { useCallback, useEffect, useRef, useState } from "react";
import type { M3UItem } from "@/types/iptv";

function proxied(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  let secureUrl = url;
  if (secureUrl.startsWith("http://")) secureUrl = "https://" + secureUrl.slice(7);
  return `/api/stream?u=${encodeURIComponent(secureUrl)}`;
}

const LOAD_TIMEOUT_LIVE_MS = 25_000;
const LOAD_TIMEOUT_VOD_MS = 60_000;
const AUTOPLAY_RETRY_MS = 800;
const ERROR_RETRY_MS = 3_000;
const MAX_AUTO_RETRIES = 4;

function buildHlsConfig(isLive: boolean, lowQuality: boolean) {
  return {
    enableWorker: true,
    lowLatencyMode: false,

    maxBufferLength: isLive ? 30 : 30,
    maxMaxBufferLength: isLive ? 90 : 600,
    backBufferLength: isLive ? 20 : 30,
    maxBufferSize: 60 * 1000 * 1000,
    maxBufferHole: 0.5,

    liveSyncDurationCount: isLive ? 6 : 3,
    liveMaxLatencyDurationCount: isLive ? 20 : 10,
    maxLiveSyncPlaybackRate: 1,

    startPosition: -1,

    startLevel: 0,
    capLevelToPlayerSize: !lowQuality,
    abrEwmaDefaultEstimate: lowQuality ? 500_000 : 1_000_000,
    abrBandwidthFactor: 0.7,
    abrBandwidthSafeFactor: 0.6,
    abrMaxWithRealBitrate: true,
    testBandwidth: !lowQuality,

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

    nudgeOffset: 0.2,
    nudgeMaxRetry: 5,
    maxStarvationDelay: 10,
    maxLoadingDelay: 10,
  };
}

function buildMpegtsConfig(isLive: boolean) {
  return {
    enableWorker: true,
    enableStashBuffer: true,
    stashInitialSize: isLive ? 512 : 256,
    isLive,
    liveBufferLatencyChasing: false,
    lazyLoad: false,
    autoCleanupSourceBuffer: true,
    autoCleanupMaxBackwardDuration: isLive ? 30 : 60,
    autoCleanupMinBackwardDuration: isLive ? 15 : 30,
    fixAudioTimestampGap: true,
  };
}

export interface PlayerLevel {
  index: number;
  height?: number;
  width?: number;
  bitrate: number;
  name?: string;
}

export interface PlayerDiagnostics {
  engine: "hls.js" | "mpegts.js" | "native" | "idle";
  status: string;
  bufferAhead: number; // seconds of buffered video ahead of currentTime
  currentTime: number;
  currentLevel: number;
  currentBitrateKbps: number;
  levels: PlayerLevel[];
  estimatedBandwidthKbps: number;
  droppedFrames: number;
  resolution: string;
  recentEvents: string[]; // ring buffer of recent log lines
  fatalError: string | null;
}

const EMPTY_DIAG: PlayerDiagnostics = {
  engine: "idle",
  status: "idle",
  bufferAhead: 0,
  currentTime: 0,
  currentLevel: -1,
  currentBitrateKbps: 0,
  levels: [],
  estimatedBandwidthKbps: 0,
  droppedFrames: 0,
  resolution: "—",
  recentEvents: [],
  fatalError: null,
};

export interface UseHlsPlayerOptions {
  /** Force the lowest available quality level (no ABR upscaling). */
  lowQuality?: boolean;
}

export interface UseHlsPlayerResult {
  loading: boolean;
  error: string;
  retry: () => void;
  diagnostics: PlayerDiagnostics;
}

export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  item: M3UItem | null,
  options: UseHlsPlayerOptions = {},
): UseHlsPlayerResult {
  const { lowQuality = false } = options;

  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const autoRetryCountRef = useRef(0);
  const eventsRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [diagnostics, setDiagnostics] = useState<PlayerDiagnostics>(EMPTY_DIAG);

  const pushEvent = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    const entry = `${stamp}  ${line}`;
    const next = [...eventsRef.current, entry].slice(-40);
    eventsRef.current = next;
    setDiagnostics((d) => ({ ...d, recentEvents: next }));
  }, []);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
  }, []);
  const clearDiagTimer = useCallback(() => {
    if (diagTimerRef.current) { clearInterval(diagTimerRef.current); diagTimerRef.current = null; }
  }, []);

  const destroyPlayers = useCallback(() => {
    clearRetryTimer();
    clearDiagTimer();
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
  }, [clearRetryTimer, clearDiagTimer]);

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

    const video = videoRef.current;
    const streamUrl = proxied(item.url);
    const fallbackUrl = item.fallbackUrl ? proxied(item.fallbackUrl) : undefined;
    const isLive = item.type === "live";
    let disposed = false;

    eventsRef.current = [];
    setDiagnostics({ ...EMPTY_DIAG, status: "loading" });
    pushEvent(`▶ load "${item.name}" (${isLive ? "live" : "vod"}) lowQuality=${lowQuality}`);

    const setStatus = (status: string) =>
      setDiagnostics((d) => ({ ...d, status }));

    const startTimeout = (onTimeout: () => void) => {
      clearLoadTimeout();
      timeoutRef.current = setTimeout(() => {
        if (disposed) return;
        pushEvent("⏱ load timeout");
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
      setStatus("playing");
      pushEvent("✅ playing");
    };

    const autoRetryPlay = (v: HTMLVideoElement, fallback?: () => void) => {
      clearRetryTimer();
      if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
        if (fallback) { fallback(); return; }
        setLoading(false);
        setError("Canal indisponível no momento. Tente outro canal.");
        setStatus("error");
        return;
      }
      autoRetryCountRef.current++;
      pushEvent(`↻ autoplay retry ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES}`);
      retryTimerRef.current = setTimeout(() => {
        if (disposed) return;
        v.play().catch(() => autoRetryPlay(v, fallback));
      }, AUTOPLAY_RETRY_MS);
    };

    const showError = (msg: string, autoRetry = false) => {
      clearLoadTimeout();
      if (autoRetry && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
        clearRetryTimer();
        pushEvent(`↻ silent retry in ${ERROR_RETRY_MS}ms`);
        retryTimerRef.current = setTimeout(() => {
          if (disposed) return;
          setAttempt((n) => n + 1);
        }, ERROR_RETRY_MS);
        return;
      }
      setLoading(false);
      setError(msg);
      setStatus("error");
      setDiagnostics((d) => ({ ...d, fatalError: msg }));
    };

    // ─── Stats polling (engine-agnostic) ─────────────────────────────────────
    const startDiagPoll = () => {
      clearDiagTimer();
      diagTimerRef.current = setInterval(() => {
        if (disposed) return;
        const buffered = video.buffered;
        let bufferAhead = 0;
        if (buffered.length > 0) {
          for (let i = 0; i < buffered.length; i++) {
            if (video.currentTime >= buffered.start(i) && video.currentTime <= buffered.end(i)) {
              bufferAhead = buffered.end(i) - video.currentTime;
              break;
            }
          }
        }
        const hls = hlsRef.current;
        let currentLevel = -1;
        let currentBitrateKbps = 0;
        let bwKbps = 0;
        let levels: PlayerLevel[] = [];
        if (hls) {
          currentLevel = hls.currentLevel ?? -1;
          const ls = hls.levels || [];
          levels = ls.map((l: any, idx: number) => ({
            index: idx,
            height: l.height,
            width: l.width,
            bitrate: l.bitrate ?? 0,
            name: l.name,
          }));
          if (currentLevel >= 0 && ls[currentLevel]) {
            currentBitrateKbps = Math.round((ls[currentLevel].bitrate || 0) / 1000);
          }
          if (hls.bandwidthEstimate) {
            bwKbps = Math.round(hls.bandwidthEstimate / 1000);
          }
        }
        const q = (video as any).getVideoPlaybackQuality?.();
        const dropped = q?.droppedVideoFrames ?? 0;
        const resolution =
          video.videoWidth && video.videoHeight
            ? `${video.videoWidth}×${video.videoHeight}`
            : "—";
        setDiagnostics((d) => ({
          ...d,
          bufferAhead,
          currentTime: video.currentTime,
          currentLevel,
          currentBitrateKbps,
          levels,
          estimatedBandwidthKbps: bwKbps,
          droppedFrames: dropped,
          resolution,
        }));
      }, 1000);
    };

    const playNative = (url: string) => {
      resetVideo();
      setDiagnostics((d) => ({ ...d, engine: "native" }));
      pushEvent("engine: native");
      startTimeout(() => showError("Não foi possível reproduzir este canal.", true));
      video.src = url;
      video.load();
      video.play().catch(() => autoRetryPlay(video));
      startDiagPoll();
    };

    const playTs = async (url: string) => {
      fallbackAttemptedRef.current = true;
      resetVideo();
      try {
        const mod = await import("mpegts.js");
        if (disposed) return;
        const mpegts = mod.default;
        setDiagnostics((d) => ({ ...d, engine: "mpegts.js" }));
        pushEvent("engine: mpegts.js");
        startTimeout(() => showError("Canal temporariamente indisponível.", true));
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url, cors: true } as any,
            buildMpegtsConfig(isLive),
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, (type: any, detail: any) => {
            pushEvent(`✖ mpegts ${type} ${detail}`);
            showError("Erro ao carregar o canal.", true);
          });
          player.attachMediaElement(video);
          player.load();
          Promise.resolve(player.play()).catch(() => autoRetryPlay(video));
          startDiagPoll();
        } else {
          playNative(url);
        }
      } catch (e) {
        pushEvent(`✖ mpegts load failed: ${(e as Error).message}`);
        playNative(url);
      }
    };

    const tryFallback = () => {
      if (fallbackUrl && !fallbackAttemptedRef.current) {
        pushEvent("↪ switching to .ts fallback");
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
        setDiagnostics((d) => ({ ...d, engine: "hls.js" }));
        pushEvent("engine: hls.js");
        startTimeout(tryFallback);

        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) playNative(url);
          else if (fallbackUrl) playTs(fallbackUrl);
          else showError("Este navegador não suporta HLS.");
          return;
        }

        const hls = new Hls(buildHlsConfig(isLive, lowQuality));
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          const count = data?.levels?.length ?? 0;
          pushEvent(`manifest parsed: ${count} quality levels`);
          if (lowQuality && count > 0) {
            // Cap ABR to the lowest level and pin currentLevel there.
            hls.autoLevelCapping = 0;
            hls.currentLevel = 0;
            pushEvent("🔒 quality locked to level 0 (lowest)");
          }
          video.play().catch(() => autoRetryPlay(video, tryFallback));
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
          pushEvent(`level → ${data.level}`);
        });

        let mediaErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          const tag = `${data.type}/${data.details}`;
          if (!data.fatal) {
            // Silent except for CORS-ish hints
            if (/manifestLoadError|levelLoadError|fragLoadError/i.test(data.details || "")) {
              pushEvent(`⚠ ${tag} (non-fatal)`);
            }
            return;
          }
          pushEvent(`✖ FATAL ${tag}`);
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

        startDiagPoll();
      } catch (e) {
        pushEvent(`✖ hls.js load failed: ${(e as Error).message}`);
        tryFallback();
      }
    };

    // Video-element status events
    const onWaiting = () => { setStatus("buffering"); pushEvent("… buffering"); };
    const onStalled = () => { setStatus("stalled"); pushEvent("⚠ stalled"); };
    const onCanPlay = () => pushEvent("can play");
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("canplay", onCanPlay);

    setLoading(true);
    setError("");
    fallbackAttemptedRef.current = false;
    autoRetryCountRef.current = 0;
    video.onplaying = markPlaying;
    video.onerror = () => {
      pushEvent(`✖ video element error code=${video.error?.code ?? "?"}`);
      tryFallback();
    };

    if (/\.m3u8(\?|$)/i.test(streamUrl) || streamUrl.includes("m3u8") || isLive) {
      playWithHls(streamUrl);
    } else {
      playNative(streamUrl);
    }

    return () => {
      disposed = true;
      clearLoadTimeout();
      clearRetryTimer();
      clearDiagTimer();
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("canplay", onCanPlay);
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      try { video.load(); } catch {}
    };
  }, [item, attempt, lowQuality, clearLoadTimeout, clearRetryTimer, clearDiagTimer, destroyPlayers, videoRef, pushEvent]);

  return {
    loading,
    error,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
    diagnostics,
  };
}
