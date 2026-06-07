import { useCallback, useEffect, useState } from "react";
import { LIVE_AUTO_TUNE_EVENT } from "@/utils/liveAutoTune";
import { probeLivePerformance } from "@/utils/livePerformanceProbe";
import { pickLowestLevelIndex } from "@/utils/streamProfile";
import {
  getStabilityConfig,
  setStabilityConfig,
  STABILITY_MODE_CHANGE_EVENT,
} from "@/utils/stabilityMode";

export type QualityLevel = "low" | "medium" | "high" | "auto";

export interface StabilityModeConfig {
  enabled: boolean;
  qualityLevel: QualityLevel;
}

interface HlsQualityController {
  levels?: Array<{ bitrate?: number; height?: number }>;
  autoLevelCapping: number;
  currentLevel: number;
  loadLevel: number;
  nextLevel: number;
  nextAutoLevel: number;
}

export const QUALITY_LABELS: Record<QualityLevel, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  auto: "Automatica",
};

export function useStabilityMode() {
  const [config, setConfig] = useState<StabilityModeConfig>(() => {
    if (typeof window === "undefined") {
      return { enabled: true, qualityLevel: "auto" };
    }

    const probe = probeLivePerformance();
    return getStabilityConfig({
      enabled: probe.stabilityRecommended,
      qualityLevel: "auto",
    });
  });

  const saveConfig = useCallback((newConfig: StabilityModeConfig) => {
    setConfig(newConfig);
    setStabilityConfig(newConfig);
  }, []);

  const toggleStabilityMode = useCallback((enabled: boolean) => {
    setConfig((previous) => {
      const next = { ...previous, enabled };
      setStabilityConfig(next);
      return next;
    });
  }, []);

  const setQualityLevel = useCallback((qualityLevel: QualityLevel) => {
    setConfig((previous) => {
      const next = { ...previous, qualityLevel };
      setStabilityConfig(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const syncConfig = () => setConfig(getStabilityConfig());
    window.addEventListener(LIVE_AUTO_TUNE_EVENT, syncConfig);
    window.addEventListener(STABILITY_MODE_CHANGE_EVENT, syncConfig);
    return () => {
      window.removeEventListener(LIVE_AUTO_TUNE_EVENT, syncConfig);
      window.removeEventListener(STABILITY_MODE_CHANGE_EVENT, syncConfig);
    };
  }, []);

  return { config, toggleStabilityMode, setQualityLevel, saveConfig };
}

export function resolveQualityIndex(
  qualityLevel: QualityLevel,
  levels: Array<{ bitrate?: number; height?: number }> | undefined,
): number {
  if (!levels || levels.length === 0) return 0;
  if (qualityLevel === "low") return pickLowestLevelIndex(levels);
  if (qualityLevel === "medium") return Math.floor(levels.length / 2);
  if (qualityLevel === "high") return levels.length - 1;
  return -1;
}

export function applyQualityCapToHls(
  hls: HlsQualityController,
  maxLevel: number,
  levels?: Array<{ bitrate?: number; height?: number }>,
) {
  const available = levels ?? hls?.levels;
  if (!available || available.length === 0) return;

  const capped = Math.max(0, Math.min(maxLevel, available.length - 1));
  hls.autoLevelCapping = capped;
  hls.currentLevel = capped;
  hls.loadLevel = capped;
  hls.nextLevel = capped;
}

function enableAutomaticQuality(hls: HlsQualityController, maxLevel = -1) {
  hls.autoLevelCapping = maxLevel;
  hls.currentLevel = -1;
  hls.loadLevel = -1;
  hls.nextLevel = -1;
}

export function applyStabilityModeToHls(
  hls: HlsQualityController,
  config: StabilityModeConfig,
  options?: { maxLevel?: number; forceLowest?: boolean },
) {
  const levels = hls?.levels;
  if (!levels || levels.length === 0) return;

  if (options?.forceLowest || options?.maxLevel === 0) {
    applyQualityCapToHls(hls, pickLowestLevelIndex(levels), levels);
    return;
  }

  if (config.qualityLevel === "auto") {
    enableAutomaticQuality(
      hls,
      options?.maxLevel !== undefined && options.maxLevel >= 0 ? options.maxLevel : -1,
    );
    return;
  }

  if (options?.maxLevel !== undefined && options.maxLevel >= 0) {
    applyQualityCapToHls(hls, options.maxLevel, levels);
    return;
  }

  const targetLevel = resolveQualityIndex(config.qualityLevel, levels);
  if (targetLevel >= 0) {
    applyQualityCapToHls(hls, targetLevel, levels);
  }
}

export function downgradeHlsLevel(hls: HlsQualityController): boolean {
  const levels = hls?.levels;
  if (!levels || levels.length <= 1) return false;

  const current =
    hls.currentLevel >= 0
      ? hls.currentLevel
      : hls.autoLevelCapping >= 0
        ? hls.autoLevelCapping
        : levels.length - 1;
  const next = current > 0 ? current - 1 : pickLowestLevelIndex(levels);
  if (next === current) return false;

  hls.autoLevelCapping = next;
  hls.currentLevel = -1;
  hls.loadLevel = -1;
  hls.nextLevel = -1;
  hls.nextAutoLevel = next;
  return true;
}

export function getBufferAhead(video: HTMLVideoElement): number {
  if (!video.buffered || video.buffered.length === 0) return 0;
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= video.currentTime && video.currentTime < video.buffered.end(i)) {
      return video.buffered.end(i) - video.currentTime;
    }
  }
  return 0;
}

export async function waitForBufferAndPlay(
  video: HTMLVideoElement,
  minBuffer: number = 5,
  maxWaitMs: number = 30000,
  onStatusChange?: (status: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    onStatusChange?.("Carregando buffer para evitar travamentos...");

    const abort = () => {
      clearInterval(timer);
      reject(new DOMException("Playback cancelled", "AbortError"));
    };

    const timer = setInterval(() => {
      const buffered = getBufferAhead(video);
      const elapsed = Date.now() - startTime;
      if (buffered >= minBuffer || elapsed > maxWaitMs) {
        clearInterval(timer);
        signal?.removeEventListener("abort", abort);
        onStatusChange?.("");
        video.play().then(resolve).catch(reject);
      }
    }, 250);

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function scaleHlsBuffers<T extends Record<string, unknown>>(config: T, scale: number): T {
  if (scale === 1) return config;
  const scaled = { ...config };
  for (const key of ["maxBufferLength", "maxMaxBufferLength", "backBufferLength"] as const) {
    if (typeof scaled[key] === "number") {
      (scaled as Record<string, number>)[key] = Math.round((scaled[key] as number) * scale);
    }
  }
  return scaled;
}

export function buildStabilityModeHlsConfig(isLive: boolean, heavy = false, bufferScale = 1) {
  if (heavy) {
    return scaleHlsBuffers(
      {
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        backBufferLength: 60,
        maxBufferHole: 0.8,
        liveSyncDurationCount: 5,
        liveMaxLatencyDurationCount: 16,
        maxLiveSyncPlaybackRate: 1,
        startPosition: isLive ? -1 : 0,
        manifestLoadingTimeOut: 30000,
        levelLoadingTimeOut: 30000,
        fragLoadingTimeOut: 35000,
        fragLoadingMaxRetry: 9,
        manifestLoadingMaxRetry: 7,
        levelLoadingMaxRetry: 7,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 6,
        fragLoadingMaxRetryTimeout: isLive ? 15000 : 64000,
        abrBandWidthFactor: 0.7,
        abrBandWidthUpFactor: 0.4,
        abrMaxWithRealBitrate: true,
        maxStarvationDelay: 6,
        maxLoadingDelay: 6,
      },
      bufferScale,
    );
  }

  return scaleHlsBuffers(
    {
      enableWorker: true,
      lowLatencyMode: false,
      startLevel: -1,
      capLevelToPlayerSize: true,
      maxBufferLength: 35,
      maxMaxBufferLength: 60,
      backBufferLength: 20,
      maxBufferHole: 0.6,
      liveSyncDurationCount: 4,
      liveMaxLatencyDurationCount: 9,
      maxLiveSyncPlaybackRate: 1.03,
      startPosition: isLive ? -1 : 0,
      manifestLoadingTimeOut: 25000,
      levelLoadingTimeOut: 25000,
      fragLoadingTimeOut: 25000,
      fragLoadingMaxRetry: 7,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      fragLoadingMaxRetryTimeout: isLive ? 12000 : 64000,
      abrBandWidthFactor: 0.75,
      abrBandWidthUpFactor: 0.45,
      abrMaxWithRealBitrate: true,
      maxStarvationDelay: 5,
      maxLoadingDelay: 5,
    },
    bufferScale,
  );
}

export function buildHeavyMpegtsConfig(isLive: boolean) {
  return {
    enableWorker: true,
    enableStashBuffer: true,
    stashInitialSize: 1024,
    isLive,
    liveBufferLatencyChasing: false,
    liveBufferLatencyMaxLatency: 10,
    liveBufferLatencyMinRemain: 4,
    lazyLoad: false,
    autoCleanupSourceBuffer: isLive,
    autoCleanupMaxBackwardDuration: isLive ? 30 : 30,
    autoCleanupMinBackwardDuration: isLive ? 18 : 20,
  };
}
