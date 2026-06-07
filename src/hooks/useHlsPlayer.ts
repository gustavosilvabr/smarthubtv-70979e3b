import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { M3UItem } from "@/types/iptv";
import {
  useStabilityMode,
  applyStabilityModeToHls,
  buildStabilityModeHlsConfig,
  buildHeavyMpegtsConfig,
  downgradeHlsLevel,
  getBufferAhead,
  waitForBufferAndPlay,
  type StabilityModeConfig,
  type QualityLevel,
} from "@/hooks/useStabilityMode";
import { LIVE_AUTO_TUNE_EVENT } from "@/utils/liveAutoTune";
import { getStreamPlaybackProfile, classifyLiveChannelTier } from "@/utils/streamProfile";
import { selectProfileForTier, applyHlsProfile } from "@/utils/hlsProfileConfig";

function proxied(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `/api/stream?u=${encodeURIComponent(url)}`;
}

function proxiedForWorker(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  const proxyPath = `/api/stream?u=${encodeURIComponent(url)}`;
  if (proxyPath.startsWith("/")) {
    return `${window.location.origin}${proxyPath}`;
  }
  return proxyPath;
}

const LIVE_MAX_DRIFT_S = 25;
const LIVE_EDGE_KEEP_S = 3;
const LIVE_WATCH_INTERVAL_MS = 3000;
const STALL_TOLERANCE_S = 8;
const LOAD_TIMEOUT_LIVE_MS = 22_000;
const LOAD_TIMEOUT_VOD_MS = 60_000;
const AUTOPLAY_RETRY_MS = 1000;
const ERROR_RETRY_MS = 2500;
const MAX_AUTO_RETRIES = 6;
const LOW_BUFFER_THRESHOLD_S = 2.5;
const CRITICAL_BUFFER_THRESHOLD_S = 1.2;
const HEAVY_LOW_BUFFER_THRESHOLD_S = 5;
const HEAVY_CRITICAL_BUFFER_THRESHOLD_S = 2.5;

type StreamFormat = "hls" | "ts";

interface UseHlsPlayerOptions {
  lowQuality?: boolean;
}

export interface PlayerLevel {
  index: number;
  height?: number;
  width?: number;
  bitrate: number;
  name?: string;
}

export interface PlayerDiagnostics {
  engine: "hls.js" | "mpegts.js" | "native" | "none";
  status: string;
  bufferAhead: number;
  currentTime: number;
  currentLevel: number;
  currentBitrateKbps: number;
  estimatedBandwidthKbps: number;
  droppedFrames: number;
  resolution: string;
  levels: PlayerLevel[];
  recentEvents: string[];
  fatalError?: string;
}

const EMPTY_DIAG: PlayerDiagnostics = {
  engine: "none",
  status: "idle",
  bufferAhead: 0,
  currentTime: 0,
  currentLevel: -1,
  currentBitrateKbps: 0,
  estimatedBandwidthKbps: 0,
  droppedFrames: 0,
  resolution: "—",
  levels: [],
  recentEvents: [],
};

const BUFFER_UI_UPDATE_MS = 5000;
const RECOVERY_COOLDOWN_MS = 4000;
const STALL_DOWNGRADE_COOLDOWN_MS = 6000;

function buildStandardHlsConfig(isLive: boolean) {
  return {
    enableWorker: true,
    lowLatencyMode: false,
    startLevel: 0,
    capLevelToPlayerSize: true,
    maxBufferLength: isLive ? 20 : 30,
    maxMaxBufferLength: isLive ? 40 : 600,
    backBufferLength: isLive ? 12 : 30,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 8,
    maxLiveSyncPlaybackRate: isLive ? 1.08 : 1,
    startPosition: isLive ? -1 : 0,
    manifestLoadingTimeOut: 10000,
    levelLoadingTimeOut: 10000,
    fragLoadingTimeOut: isLive ? 10000 : 30_000,
    fragLoadingMaxRetry: 5,
    manifestLoadingMaxRetry: 4,
    levelLoadingMaxRetry: 4,
    nudgeOffset: 0.2,
    nudgeMaxRetry: 5,
    fragLoadingMaxRetryTimeout: isLive ? 6000 : 64_000,
    abrBandwidthFactor: 0.75,
    abrBandwidthSafeFactor: 0.65,
    abrMaxWithRealBitrate: true,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
  };
}

function buildMpegtsConfig(isLive: boolean, heavy: boolean) {
  if (heavy) return buildHeavyMpegtsConfig(isLive);
  return {
    enableWorker: true,
    enableStashBuffer: isLive,
    stashInitialSize: isLive ? 384 : 128,
    isLive,
    liveBufferLatencyChasing: false,
    liveBufferLatencyMaxLatency: 4,
    liveBufferLatencyMinRemain: 1.2,
    lazyLoad: false,
    autoCleanupSourceBuffer: isLive,
    autoCleanupMaxBackwardDuration: isLive ? 12 : 30,
    autoCleanupMinBackwardDuration: isLive ? 8 : 20,
  };
}

function startLiveEdgeWatcher(
  video: HTMLVideoElement,
  getDisposed: () => boolean,
  disabled: boolean,
): ReturnType<typeof setInterval> {
  let stalledSince: number | null = null;
  let lastTime = video.currentTime;
  let lastCheck = Date.now();

  return setInterval(() => {
    if (getDisposed() || video.paused || video.ended || video.readyState < 2) return;
    if (disabled) return;

    const now = Date.now();
    const timeSinceCheck = (now - lastCheck) / 1000;
    const timeAdvanced = video.currentTime - lastTime;

    if (timeAdvanced < timeSinceCheck * 0.5) {
      if (stalledSince === null) stalledSince = now;
      if (now - stalledSince > STALL_TOLERANCE_S * 1000) {
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

export interface UseHlsPlayerResult {
  loading: boolean;
  error: string;
  bufferStatus: string;
  bufferTime: number;
  stabilityConfig: StabilityModeConfig;
  toggleStabilityMode: (enabled: boolean) => void;
  setQualityLevel: (level: QualityLevel) => void;
  retry: () => void;
  diagnostics: PlayerDiagnostics;
}

export function useHlsPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  item: M3UItem | null,
  options: UseHlsPlayerOptions = {},
): UseHlsPlayerResult {
  const { lowQuality = false } = options;

  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watcherRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const attemptedFormatsRef = useRef<Set<StreamFormat>>(new Set());
  const autoRetryCountRef = useRef(0);
  const eventsRef = useRef<string[]>([]);
  const stabilityConfigRef = useRef<StabilityModeConfig>({ enabled: true, qualityLevel: "low" });
  const streamProfileRef = useRef(getStreamPlaybackProfile(item));
  const lastRecoveryRef = useRef(0);
  const lastDowngradeRef = useRef(0);
  const lastBufferUiUpdateRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bufferStatus, setBufferStatus] = useState("");
  const [bufferTime, setBufferTime] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [diagnostics, setDiagnostics] = useState<PlayerDiagnostics>(EMPTY_DIAG);

  const pushEvent = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    const entry = `${stamp}  ${line}`;
    const next = [...eventsRef.current, entry].slice(-40);
    eventsRef.current = next;
    setDiagnostics((d) => ({ ...d, recentEvents: next }));
  }, []);

  const { config: stabilityConfig, toggleStabilityMode, setQualityLevel } = useStabilityMode();

  const isStabilityActive = useCallback(() => {
    const profile = streamProfileRef.current;
    return profile.forceStability || stabilityConfigRef.current.enabled;
  }, []);

  const applyStreamQuality = useCallback((hls: any) => {
    const profile = streamProfileRef.current;
    const config = stabilityConfigRef.current;
    const useStability = profile.forceStability || config.enabled;

    if (!useStability) {
      applyStabilityModeToHls(hls, config);
      return;
    }

    if (profile.heavy || profile.maxHlsLevel === 0) {
      applyStabilityModeToHls(hls, config, { forceLowest: true });
      return;
    }

    applyStabilityModeToHls(hls, config, {
      maxLevel: profile.maxHlsLevel >= 0 ? profile.maxHlsLevel : undefined,
    });
  }, []);

  useEffect(() => {
    stabilityConfigRef.current = stabilityConfig;
    streamProfileRef.current = getStreamPlaybackProfile(item);
  }, [stabilityConfig, item]);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearDiagTimer = useCallback(() => {
    if (diagTimerRef.current) {
      clearInterval(diagTimerRef.current);
      diagTimerRef.current = null;
    }
  }, []);

  const stopBufferMonitoring = useCallback(() => {
    if (bufferCheckRef.current) {
      clearInterval(bufferCheckRef.current);
      bufferCheckRef.current = null;
    }
  }, []);

  const stopWatcher = useCallback(() => {
    if (watcherRef.current) {
      clearInterval(watcherRef.current);
      watcherRef.current = null;
    }
  }, []);

  const destroyPlayers = useCallback(() => {
    stopWatcher();
    stopBufferMonitoring();
    clearRetryTimer();
    clearDiagTimer();
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.destroy();
      } catch {}
      mpegtsRef.current = null;
    }
  }, [stopWatcher, stopBufferMonitoring, clearRetryTimer, clearDiagTimer]);

  const startBufferMonitoring = useCallback(
    (video: HTMLVideoElement, hls: any) => {
      stopBufferMonitoring();
      bufferCheckRef.current = setInterval(() => {
        const buffered = getBufferAhead(video);
        const now = Date.now();
        const profile = streamProfileRef.current;

        if (now - lastBufferUiUpdateRef.current >= BUFFER_UI_UPDATE_MS) {
          lastBufferUiUpdateRef.current = now;
          setBufferTime(buffered);
        }

        if (!isStabilityActive()) return;

        applyStreamQuality(hls);

        const criticalThreshold = profile.heavy
          ? HEAVY_CRITICAL_BUFFER_THRESHOLD_S
          : CRITICAL_BUFFER_THRESHOLD_S;
        const lowThreshold = profile.heavy ? HEAVY_LOW_BUFFER_THRESHOLD_S : LOW_BUFFER_THRESHOLD_S;

        if (buffered < criticalThreshold) {
          setBufferStatus("Reduzindo qualidade...");
          if (now - lastDowngradeRef.current >= STALL_DOWNGRADE_COOLDOWN_MS) {
            lastDowngradeRef.current = now;
            const downgraded = downgradeHlsLevel(hls);
            if (!downgraded && now - lastRecoveryRef.current >= RECOVERY_COOLDOWN_MS) {
              lastRecoveryRef.current = now;
              try {
                hls.startLoad();
              } catch {
                // startLoad pode falhar se o player já foi destruído
              }
            }
          }
        } else if (buffered < lowThreshold) {
          setBufferStatus("Reconectando...");
          if (!profile.heavy && now - lastRecoveryRef.current >= RECOVERY_COOLDOWN_MS) {
            lastRecoveryRef.current = now;
            try {
              hls.startLoad();
            } catch {
              // startLoad pode falhar se o player já foi destruído
            }
            if (video.paused && video.readyState >= 2) {
              video.play().catch(() => {});
            }
          }
        } else if (profile.heavy && buffered < profile.minBufferSeconds) {
          setBufferStatus("Carregando buffer...");
        } else {
          setBufferStatus((prev) =>
            prev === "Reconectando..." || prev === "Reduzindo qualidade..." || prev === "Carregando buffer..."
              ? ""
              : prev,
          );
        }
      }, 1500);
    },
    [stopBufferMonitoring, isStabilityActive, applyStreamQuality],
  );

  useEffect(() => {
    if (!item || item.type !== "live") return;
    const onAutoTune = () => setAttempt((n) => n + 1);
    window.addEventListener(LIVE_AUTO_TUNE_EVENT, onAutoTune);
    return () => window.removeEventListener(LIVE_AUTO_TUNE_EVENT, onAutoTune);
  }, [item]);

  useEffect(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!hls || !video) return;

    applyStreamQuality(hls);
    if (isStabilityActive()) {
      startBufferMonitoring(video, hls);
    } else {
      stopBufferMonitoring();
    }
  }, [
    stabilityConfig,
    item,
    startBufferMonitoring,
    stopBufferMonitoring,
    applyStreamQuality,
    isStabilityActive,
    videoRef,
  ]);

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

    const video = videoRef.current;
    const profile = getStreamPlaybackProfile(item);
    streamProfileRef.current = profile;

    const streamUrl = proxied(item.url);
    const fallbackUrl = item.fallbackUrl ? proxied(item.fallbackUrl) : undefined;
    const streamUrlForWorker = proxiedForWorker(item.url);
    const fallbackUrlForWorker = item.fallbackUrl ? proxiedForWorker(item.fallbackUrl) : undefined;
    const isLive = item.type === "live";
    let disposed = false;
    const getDisposed = () => disposed;

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
      if (isLive && !hlsRef.current && !mpegtsRef.current && !watcherRef.current) {
        watcherRef.current = startLiveEdgeWatcher(
          video,
          getDisposed,
          profile.disableLiveEdgeChase || isStabilityActive(),
        );
      }
    };

    const autoRetryPlay = (video: HTMLVideoElement, fallback?: () => void) => {
      clearRetryTimer();
      if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
        fallback?.();
        if (!fallback) {
          setLoading(false);
          setError("Canal indisponível no momento. Tente outro canal.");
        }
        return;
      }
      autoRetryCountRef.current++;
      pushEvent(`↻ autoplay retry ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES}`);
      retryTimerRef.current = setTimeout(() => {
        if (disposed) return;
        video.play().catch(() => autoRetryPlay(video, fallback));
      }, AUTOPLAY_RETRY_MS);
    };

    const showError = (msg: string, autoRetry = false) => {
      clearLoadTimeout();
      stopWatcher();
      stopBufferMonitoring();
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

    const beginPlayback = (onReady?: () => void) => {
      const minBuffer = profile.minBufferSeconds;
      const useStability = profile.forceStability || stabilityConfigRef.current.enabled;

      if (useStability && isLive) {
        waitForBufferAndPlay(video, minBuffer, 35000, setBufferStatus)
          .then(() => onReady?.())
          .catch(() => autoRetryPlay(video));
      } else {
        video
          .play()
          .then(() => onReady?.())
          .catch(() => autoRetryPlay(video));
      }
    };

    const playNative = (url: string) => {
      resetVideo();
      setDiagnostics((d) => ({ ...d, engine: "native" }));
      pushEvent("engine: native");
      startTimeout(() => showError("Não foi possível reproduzir este canal.", true));
      video.src = url;
      video.load();
      beginPlayback(() => {
        if (isLive) {
          watcherRef.current = startLiveEdgeWatcher(
            video,
            getDisposed,
            profile.disableLiveEdgeChase || isStabilityActive(),
          );
        }
      });
    };

    const tryAlternateStream = () => {
      const tried = attemptedFormatsRef.current;
      const preferTs = profile.preferTsFallback && Boolean(fallbackUrlForWorker);
      const nextFormat: StreamFormat | null = preferTs
        ? tried.has("ts") && !tried.has("hls")
          ? "hls"
          : null
        : tried.has("hls") && !tried.has("ts") && fallbackUrlForWorker
          ? "ts"
          : null;

      if (nextFormat === "ts" && fallbackUrlForWorker) {
        playTs(fallbackUrlForWorker);
      } else if (nextFormat === "hls") {
        playWithHls(streamUrl);
      } else {
        showError("Canal temporariamente indisponível.", true);
      }
    };

    const playTs = async (url: string) => {
      attemptedFormatsRef.current.add("ts");
      resetVideo();
      try {
        const mod = await import("mpegts.js");
        if (disposed) return;
        const mpegts = mod.default;
        startTimeout(() => tryAlternateStream());

        if (mpegts.isSupported()) {
          setDiagnostics((d) => ({ ...d, engine: "mpegts.js" }));
          pushEvent("engine: mpegts.js");
          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url, cors: true } as any,
            buildMpegtsConfig(isLive, profile.heavy),
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, () => {
            tryAlternateStream();
          });
          player.attachMediaElement(video);
          player.load();
          beginPlayback(() => {
            if (isLive) {
              watcherRef.current = startLiveEdgeWatcher(
                video,
                getDisposed,
                profile.disableLiveEdgeChase || isStabilityActive(),
              );
            }
          });
        } else {
          playNative(url);
        }
      } catch (e) {
        pushEvent(`✖ mpegts load failed: ${(e as Error).message}`);
        playNative(url);
      }
    };

    const startHlsPlayback = (hls: any) => {
      applyStreamQuality(hls);
      if (isStabilityActive()) {
        startBufferMonitoring(video, hls);
      }
      beginPlayback(() => {
        if (isLive) {
          watcherRef.current = startLiveEdgeWatcher(
            video,
            getDisposed,
            profile.disableLiveEdgeChase || isStabilityActive(),
          );
        }
      });
    };

    const playWithHls = async (url: string) => {
      attemptedFormatsRef.current.add("hls");
      resetVideo();
      try {
        const mod = await import("hls.js");
        if (disposed) return;
        const Hls = mod.default;
        startTimeout(tryAlternateStream);

        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) playNative(url);
          else if (fallbackUrlForWorker) playTs(fallbackUrlForWorker);
          else showError("Este navegador não suporta HLS.");
          return;
        }

        const useStability = profile.forceStability || stabilityConfigRef.current.enabled;
        const hlsConfig = useStability
          ? buildStabilityModeHlsConfig(isLive, profile.heavy, profile.hlsBufferScale)
          : buildStandardHlsConfig(isLive);

        setDiagnostics((d) => ({ ...d, engine: "hls.js" }));
        pushEvent("engine: hls.js");
        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;

        if (isLive && item) {
          const tier = classifyLiveChannelTier(item);
          const hlsProfile = selectProfileForTier(tier);
          applyHlsProfile(hls, hlsProfile);
        }

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          startHlsPlayback(hls);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          if (isStabilityActive()) {
            applyStreamQuality(hls);
          }
        });

        let mediaErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          pushEvent(`${data.fatal ? "fatal" : "warn"} ${data.type || ""} ${data.details || ""}`.trim());
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => {
              if (!disposed) {
                applyStreamQuality(hls);
                hls.startLoad();
              }
            }, 500);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorCount++;
            if (mediaErrorCount <= 2) {
              hls.recoverMediaError();
              return;
            }
            if (profile.heavy && downgradeHlsLevel(hls)) {
              mediaErrorCount = 0;
              return;
            }
          }
          tryAlternateStream();
        });

        hls.loadSource(url);
        hls.attachMedia(video);
      } catch (e) {
        console.error("hls.js load failed", e);
        tryAlternateStream();
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
    setBufferStatus("");
    setBufferTime(0);
    attemptedFormatsRef.current = new Set();
    autoRetryCountRef.current = 0;
    lastRecoveryRef.current = 0;
    lastDowngradeRef.current = 0;

    video.onplaying = markPlaying;
    video.onerror = tryAlternateStream;
    startDiagPoll();

    if (profile.preferTsFallback && fallbackUrlForWorker) {
      setBufferStatus("Carregando Full HD (stream direto)...");
      playTs(fallbackUrlForWorker);
    } else if (/\.m3u8(\?|$)/i.test(streamUrl) || streamUrl.includes("m3u8")) {
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
      clearDiagTimer();
      stopWatcher();
      stopBufferMonitoring();
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("canplay", onCanPlay);
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      video.load();
      setBufferStatus("");
    };
  }, [
    item,
    attempt,
    clearLoadTimeout,
    clearRetryTimer,
    clearDiagTimer,
    destroyPlayers,
    stopWatcher,
    stopBufferMonitoring,
    startBufferMonitoring,
    applyStreamQuality,
    isStabilityActive,
    videoRef,
  ]);

  return {
    loading,
    error,
    bufferStatus,
    bufferTime,
    stabilityConfig,
    toggleStabilityMode,
    setQualityLevel,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
    diagnostics,
  };
}
