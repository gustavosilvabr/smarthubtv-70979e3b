import { useCallback, useEffect, useState } from "react";
import { LIVE_AUTO_TUNE_EVENT } from "@/utils/liveAutoTune";
import { probeLivePerformance } from "@/utils/livePerformanceProbe";
import { pickLowestLevelIndex } from "@/utils/streamProfile";

export type QualityLevel = "low" | "medium" | "high" | "auto";

export interface StabilityModeConfig {
  enabled: boolean;
  qualityLevel: QualityLevel;
}

const STABILITY_MODE_STORAGE_KEY = "iptv_stability_mode";

export const QUALITY_LABELS: Record<QualityLevel, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  auto: "Automática",
};

export function useStabilityMode() {
  const [config, setConfig] = useState<StabilityModeConfig>(() => {
    if (typeof window === "undefined") {
      return { enabled: true, qualityLevel: "low" };
    }
    try {
      const stored = localStorage.getItem(STABILITY_MODE_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      const probe = probeLivePerformance();
      return { enabled: probe.stabilityRecommended, qualityLevel: "low" };
    } catch {
      return { enabled: true, qualityLevel: "low" };
    }
  });

  const saveConfig = useCallback((newConfig: StabilityModeConfig) => {
    setConfig(newConfig);
    if (typeof window !== "undefined") {
      localStorage.setItem(STABILITY_MODE_STORAGE_KEY, JSON.stringify(newConfig));
    }
  }, []);

  const toggleStabilityMode = useCallback((enabled: boolean) => {
    setConfig((prev) => {
      const next = { ...prev, enabled };
      if (typeof window !== "undefined") {
        localStorage.setItem(STABILITY_MODE_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const setQualityLevel = useCallback((level: QualityLevel) => {
    setConfig((prev) => {
      const next = { ...prev, qualityLevel: level };
      if (typeof window !== "undefined") {
        localStorage.setItem(STABILITY_MODE_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const syncFromAutoTune = () => {
      try {
        const stored = localStorage.getItem(STABILITY_MODE_STORAGE_KEY);
        if (stored) setConfig(JSON.parse(stored));
      } catch {
        // ignora JSON inválido
      }
    };
    window.addEventListener(LIVE_AUTO_TUNE_EVENT, syncFromAutoTune);
    return () => window.removeEventListener(LIVE_AUTO_TUNE_EVENT, syncFromAutoTune);
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
  hls: any,
  maxLevel: number,
  levels?: Array<{ bitrate?: number; height?: number }>,
) {
  const available = levels ?? hls?.levels;
  if (!available || available.length === 0) return;

  const capped = Math.max(0, Math.min(maxLevel, available.length - 1));
  hls.currentLevel = capped;
  hls.loadLevel = capped;
  hls.nextLevel = capped;
  hls.abrController?.setAutoLevelCapping(capped);
}

export function applyStabilityModeToHls(
  hls: any,
  config: StabilityModeConfig,
  options?: { maxLevel?: number; forceLowest?: boolean },
) {
  const levels = hls?.levels;
  if (!levels || levels.length === 0) return;

  if (options?.forceLowest || options?.maxLevel === 0) {
    applyQualityCapToHls(hls, pickLowestLevelIndex(levels), levels);
    return;
  }

  if (options?.maxLevel !== undefined && options.maxLevel >= 0) {
    applyQualityCapToHls(hls, options.maxLevel, levels);
    return;
  }

  if (config.enabled) {
    const effectiveQuality: QualityLevel =
      config.qualityLevel === "auto" ? "low" : config.qualityLevel;
    const targetLevel = resolveQualityIndex(effectiveQuality, levels);
    if (targetLevel >= 0) {
      applyQualityCapToHls(hls, targetLevel, levels);
    }
    return;
  }

  if (config.qualityLevel === "auto") {
    hls.currentLevel = -1;
    hls.loadLevel = -1;
    hls.nextLevel = -1;
    hls.abrController?.setAutoLevelCapping(-1);
    return;
  }

  const targetLevel = resolveQualityIndex(config.qualityLevel, levels);
  if (targetLevel >= 0) {
    applyQualityCapToHls(hls, targetLevel, levels);
  }
}

export function downgradeHlsLevel(hls: any): boolean {
  const levels = hls?.levels;
  if (!levels || levels.length <= 1) return false;

  const current = hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel;
  const next = current > 0 ? current - 1 : pickLowestLevelIndex(levels);
  if (next === current) return false;

  applyQualityCapToHls(hls, next, levels);
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
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    onStatusChange?.("Carregando buffer para evitar travamentos...");

    const timer = setInterval(() => {
      const buffered = getBufferAhead(video);
      const elapsed = Date.now() - startTime;
      if (buffered >= minBuffer || elapsed > maxWaitMs) {
        clearInterval(timer);
        onStatusChange?.("");
        video.play().then(resolve).catch(reject);
      }
    }, 250);
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
        startLevel: 0,
        capLevelToPlayerSize: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        backBufferLength: 60,
        maxBufferHole: 0.5,
        liveSyncDurationCount: 5,
        liveMaxLatencyDurationCount: 16,
        maxLiveSyncPlaybackRate: 1,
        startPosition: isLive ? -1 : 0,
        manifestLoadingTimeOut: 12000,
        levelLoadingTimeOut: 12000,
        fragLoadingTimeOut: 12000,
        fragLoadingMaxRetry: 8,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 6,
        fragLoadingMaxRetryTimeout: isLive ? 8000 : 64000,
        abrBandwidthFactor: 0.7,
        abrBandwidthSafeFactor: 0.6,
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
      startLevel: 0,
      capLevelToPlayerSize: true,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      backBufferLength: 30,
      maxBufferHole: 0.5,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      maxLiveSyncPlaybackRate: 1.05,
      startPosition: isLive ? -1 : 0,
      manifestLoadingTimeOut: 8000,
      levelLoadingTimeOut: 8000,
      fragLoadingTimeOut: 8000,
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      fragLoadingMaxRetryTimeout: isLive ? 5000 : 64000,
      abrBandwidthFactor: 0.8,
      abrBandwidthSafeFactor: 0.7,
      abrMaxWithRealBitrate: true,
      maxStarvationDelay: 4,
      maxLoadingDelay: 4,
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
