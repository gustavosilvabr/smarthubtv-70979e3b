import type Hls from "hls.js";
import type { HlsConfig } from "hls.js";
import type { LiveChannelTier } from "./streamProfile";

export type HlsProfileKey = "sd" | "hd" | "fhd";

export interface HlsProfile {
  lowLatencyMode: boolean;

  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
  liveBackBufferLength: number;

  liveSyncDurationCount: number;
  liveMaxLatencyDurationCount: number;

  maxBufferHole: number;
  highBufferWatchdogPeriod?: number;
  nudgeOffset?: number;
  nudgeMaxRetry?: number;

  fragLoadingTimeOut: number;
  fragLoadingMaxRetry: number;

  levelLoadingTimeOut: number;
  levelLoadingMaxRetry: number;

  manifestLoadingTimeOut: number;
  manifestLoadingMaxRetry: number;

  abrBandWidthFactor: number;
  abrBandWidthUpFactor: number;

  capLevelToPlayerSize?: boolean;
  enableWorker?: boolean;
  startLevel?: number;
}

const HLS_PROFILES: Record<HlsProfileKey, HlsProfile> = {
  sd: {
    lowLatencyMode: false,

    maxBufferLength: 12,
    maxMaxBufferLength: 24,
    maxBufferSize: 25 * 1000 * 1000,
    liveBackBufferLength: 8,

    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 6,

    maxBufferHole: 0.5,
    highBufferWatchdogPeriod: 2,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 3,

    fragLoadingTimeOut: 15000,
    fragLoadingMaxRetry: 4,

    levelLoadingTimeOut: 15000,
    levelLoadingMaxRetry: 4,

    manifestLoadingTimeOut: 15000,
    manifestLoadingMaxRetry: 4,

    abrBandWidthFactor: 0.85,
    abrBandWidthUpFactor: 0.7,

    capLevelToPlayerSize: true,
    enableWorker: true,
    startLevel: -1,
  },

  hd: {
    lowLatencyMode: false,

    maxBufferLength: 20,
    maxMaxBufferLength: 35,
    maxBufferSize: 40 * 1000 * 1000,
    liveBackBufferLength: 12,

    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 7,

    maxBufferHole: 0.5,
    highBufferWatchdogPeriod: 2,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 3,

    fragLoadingTimeOut: 18000,
    fragLoadingMaxRetry: 5,

    levelLoadingTimeOut: 18000,
    levelLoadingMaxRetry: 5,

    manifestLoadingTimeOut: 18000,
    manifestLoadingMaxRetry: 5,

    abrBandWidthFactor: 0.82,
    abrBandWidthUpFactor: 0.65,

    capLevelToPlayerSize: true,
    enableWorker: true,
    startLevel: -1,
  },

  fhd: {
    lowLatencyMode: false,

    maxBufferLength: 28,
    maxMaxBufferLength: 45,
    maxBufferSize: 55 * 1000 * 1000,
    liveBackBufferLength: 15,

    liveSyncDurationCount: 4,
    liveMaxLatencyDurationCount: 8,

    maxBufferHole: 0.6,
    highBufferWatchdogPeriod: 2,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 4,

    fragLoadingTimeOut: 22000,
    fragLoadingMaxRetry: 5,

    levelLoadingTimeOut: 22000,
    levelLoadingMaxRetry: 5,

    manifestLoadingTimeOut: 22000,
    manifestLoadingMaxRetry: 5,

    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.6,

    capLevelToPlayerSize: true,
    enableWorker: true,
    startLevel: -1,
  },
};

export function getProfileKeyForTier(tier: LiveChannelTier): HlsProfileKey {
  if (tier === "4k" || tier === "fhd") return "fhd";
  if (tier === "hd") return "hd";
  return "sd";
}

export function selectProfileForTier(tier: LiveChannelTier): HlsProfile {
  const key = getProfileKeyForTier(tier);
  return { ...HLS_PROFILES[key] };
}

export function createStabilityProfile(profile: HlsProfile): HlsProfile {
  return {
    ...profile,

    lowLatencyMode: false,

    maxBufferLength: Math.max(profile.maxBufferLength, 30),
    maxMaxBufferLength: Math.max(profile.maxMaxBufferLength, 50),
    maxBufferSize: Math.max(profile.maxBufferSize, 60 * 1000 * 1000),
    liveBackBufferLength: Math.max(profile.liveBackBufferLength, 15),

    liveSyncDurationCount: Math.max(profile.liveSyncDurationCount, 4),
    liveMaxLatencyDurationCount: Math.max(profile.liveMaxLatencyDurationCount, 9),

    maxBufferHole: Math.max(profile.maxBufferHole, 0.6),
    highBufferWatchdogPeriod: 2,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 4,

    fragLoadingTimeOut: Math.max(profile.fragLoadingTimeOut, 24000),
    fragLoadingMaxRetry: Math.max(profile.fragLoadingMaxRetry, 6),

    levelLoadingTimeOut: Math.max(profile.levelLoadingTimeOut, 24000),
    levelLoadingMaxRetry: Math.max(profile.levelLoadingMaxRetry, 6),

    manifestLoadingTimeOut: Math.max(profile.manifestLoadingTimeOut, 24000),
    manifestLoadingMaxRetry: Math.max(profile.manifestLoadingMaxRetry, 6),

    abrBandWidthFactor: Math.min(profile.abrBandWidthFactor, 0.78),
    abrBandWidthUpFactor: Math.min(profile.abrBandWidthUpFactor, 0.58),

    capLevelToPlayerSize: true,
    enableWorker: true,
    startLevel: -1,
  };
}

export function selectProfileForTierWithStability(
  tier: LiveChannelTier,
  stabilityMode = false
): HlsProfile {
  const profile = selectProfileForTier(tier);

  if (!stabilityMode) {
    return profile;
  }

  return createStabilityProfile(profile);
}

export function createHlsConfigFromProfile(
  profile: HlsProfile
): Partial<HlsConfig> {
  return {
    lowLatencyMode: profile.lowLatencyMode,

    maxBufferLength: profile.maxBufferLength,
    maxMaxBufferLength: profile.maxMaxBufferLength,
    maxBufferSize: profile.maxBufferSize,
    liveBackBufferLength: profile.liveBackBufferLength,

    liveSyncDurationCount: profile.liveSyncDurationCount,
    liveMaxLatencyDurationCount: profile.liveMaxLatencyDurationCount,

    maxBufferHole: profile.maxBufferHole,
    highBufferWatchdogPeriod: profile.highBufferWatchdogPeriod,
    nudgeOffset: profile.nudgeOffset,
    nudgeMaxRetry: profile.nudgeMaxRetry,

    fragLoadingTimeOut: profile.fragLoadingTimeOut,
    fragLoadingMaxRetry: profile.fragLoadingMaxRetry,

    levelLoadingTimeOut: profile.levelLoadingTimeOut,
    levelLoadingMaxRetry: profile.levelLoadingMaxRetry,

    manifestLoadingTimeOut: profile.manifestLoadingTimeOut,
    manifestLoadingMaxRetry: profile.manifestLoadingMaxRetry,

    abrBandWidthFactor: profile.abrBandWidthFactor,
    abrBandWidthUpFactor: profile.abrBandWidthUpFactor,

    capLevelToPlayerSize: profile.capLevelToPlayerSize,
    enableWorker: profile.enableWorker,

    startLevel: profile.startLevel,

    autoStartLoad: true,
  };
}

export function createHlsConfigForTier(
  tier: LiveChannelTier,
  stabilityMode = false
): Partial<HlsConfig> {
  const profile = selectProfileForTierWithStability(tier, stabilityMode);
  return createHlsConfigFromProfile(profile);
}

export function applyHlsProfile(
  hls: Hls | null | undefined,
  profile: HlsProfile
): void {
  if (!hls || !hls.config) return;

  const config = hls.config;

  config.lowLatencyMode = profile.lowLatencyMode;

  config.maxBufferLength = profile.maxBufferLength;
  config.maxMaxBufferLength = profile.maxMaxBufferLength;
  config.maxBufferSize = profile.maxBufferSize;
  config.liveBackBufferLength = profile.liveBackBufferLength;

  config.liveSyncDurationCount = profile.liveSyncDurationCount;
  config.liveMaxLatencyDurationCount = profile.liveMaxLatencyDurationCount;

  config.maxBufferHole = profile.maxBufferHole;

  config.fragLoadingTimeOut = profile.fragLoadingTimeOut;
  config.fragLoadingMaxRetry = profile.fragLoadingMaxRetry;

  config.levelLoadingTimeOut = profile.levelLoadingTimeOut;
  config.levelLoadingMaxRetry = profile.levelLoadingMaxRetry;

  config.manifestLoadingTimeOut = profile.manifestLoadingTimeOut;
  config.manifestLoadingMaxRetry = profile.manifestLoadingMaxRetry;

  config.abrBandWidthFactor = profile.abrBandWidthFactor;
  config.abrBandWidthUpFactor = profile.abrBandWidthUpFactor;

  if (profile.highBufferWatchdogPeriod !== undefined) {
    config.highBufferWatchdogPeriod = profile.highBufferWatchdogPeriod;
  }

  if (profile.nudgeOffset !== undefined) {
    config.nudgeOffset = profile.nudgeOffset;
  }

  if (profile.nudgeMaxRetry !== undefined) {
    config.nudgeMaxRetry = profile.nudgeMaxRetry;
  }

  if (profile.capLevelToPlayerSize !== undefined) {
    config.capLevelToPlayerSize = profile.capLevelToPlayerSize;
  }

  if (profile.enableWorker !== undefined) {
    config.enableWorker = profile.enableWorker;
  }

  if (profile.startLevel !== undefined) {
    config.startLevel = profile.startLevel;
  }
}