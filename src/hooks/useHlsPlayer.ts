import { useCallback, useEffect, useRef, useState } from "react";
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
import { getStreamPlaybackProfile } from "@/utils/streamProfile";

function proxied(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  let secureUrl = url;
  if (secureUrl.startsWith("http://")) {
    secureUrl = "https://" + secureUrl.slice(7);
  }
  return `/api/stream?u=${encodeURIComponent(secureUrl)}`;
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
}

export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  item: M3UItem | null,
): UseHlsPlayerResult {
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptedFormatsRef = useRef<Set<StreamFormat>>(new Set());
  const autoRetryCountRef = useRef(0);
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
  }, [stopWatcher, stopBufferMonitoring, clearRetryTimer]);

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
        retryTimerRef.current = setTimeout(() => {
          if (disposed) return;
          setAttempt((n) => n + 1);
        }, ERROR_RETRY_MS);
        return;
      }
      setLoading(false);
      setError(msg);
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
      const preferTs = profile.preferTsFallback && Boolean(fallbackUrl);
      const nextFormat: StreamFormat | null = preferTs
        ? tried.has("ts") && !tried.has("hls")
          ? "hls"
          : null
        : tried.has("hls") && !tried.has("ts") && fallbackUrl
          ? "ts"
          : null;

      if (nextFormat === "ts" && fallbackUrl) {
        playTs(fallbackUrl);
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
        console.error("mpegts load failed", e);
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
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            playNative(url);
          } else if (fallbackUrl) {
            playTs(fallbackUrl);
          } else {
            showError("Este navegador não suporta HLS.");
          }
          return;
        }

        const useStability = profile.forceStability || stabilityConfigRef.current.enabled;
        const hlsConfig = useStability
          ? buildStabilityModeHlsConfig(isLive, profile.heavy, profile.hlsBufferScale)
          : buildStandardHlsConfig(isLive);

        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;

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

    if (profile.preferTsFallback && fallbackUrl) {
      setBufferStatus("Carregando Full HD (stream direto)...");
      playTs(fallbackUrl);
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
      stopWatcher();
      stopBufferMonitoring();
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      setBufferStatus("");
    };
  }, [
    item,
    attempt,
    clearLoadTimeout,
    clearRetryTimer,
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
  };
}
