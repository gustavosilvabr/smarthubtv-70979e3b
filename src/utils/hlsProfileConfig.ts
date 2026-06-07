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

    maxBufferLength: 20,
    maxMaxBufferLength: 35,
    maxBufferSize: 30 * 1000 * 1000,
    liveBackBufferLength: 10,

    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 6,

    maxBufferHole: 0.5,
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 3,

    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 5,

    levelLoadingTimeOut: 20000,
    levelLoadingMaxRetry: 5,

    manifestLoadingTimeOut: 20000,
    manifestLoadingMaxRetry: 5,

    abrBandWidthFactor: 0.75,
    abrBandWidthUpFactor: 0.5,

    capLevelToPlayerSize: true,
    enableWorker: true,
    startLevel: -1,
  },

  hd: {
    lowLatencyMode: false,

    maxBufferLength: 35,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1000 * 1000,
    liveBackBufferLength: 20,

    liveSyncDurationCount: 4,
    liveMaxLatencyDurationCount: 9,

    maxBufferHole: 0.6,
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 4,

    fragLoadingTimeOut: 25000,
    fragLoadingMaxRetry: 7,

    levelLoadingTimeOut: 25000,
    levelLoadingMaxRetry: 6,

    manifestLoadingTimeOut: 25000,
    manifestLoadingMaxRetry: 6,

    abrBandWidthFactor: 0.75,
    abrBandWidthUpFactor: 0.45,

    capLevelToPlayerSize: true,
    enableWorker: true,
    startLevel: -1,
  },

  fhd: {
    lowLatencyMode: false,

    maxBufferLength: 50,
    maxMaxBufferLength: 90,
    maxBufferSize: 100 * 1000 * 1000,
    liveBackBufferLength: 30,

    liveSyncDurationCount: 5,
    liveMaxLatencyDurationCount: 12,

    maxBufferHole: 0.8,
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 5,

    fragLoadingTimeOut: 35000,
    fragLoadingMaxRetry: 9,

    levelLoadingTimeOut: 30000,
    levelLoadingMaxRetry: 7,

    manifestLoadingTimeOut: 30000,
    manifestLoadingMaxRetry: 7,

    abrBandWidthFactor: 0.7,
    abrBandWidthUpFactor: 0.4,

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

  return {
    ...HLS_PROFILES[key],
  };
}

export function createStabilityProfile(profile: HlsProfile): HlsProfile {
  return {
    ...profile,

    lowLatencyMode: false,

    maxBufferLength: Math.max(profile.maxBufferLength, 50),
    maxMaxBufferLength: Math.max(profile.maxMaxBufferLength, 90),
    maxBufferSize: Math.max(profile.maxBufferSize, 100 * 1000 * 1000),
    liveBackBufferLength: Math.max(profile.liveBackBufferLength, 30),

    liveSyncDurationCount: Math.max(profile.liveSyncDurationCount, 5),
    liveMaxLatencyDurationCount: Math.max(
      profile.liveMaxLatencyDurationCount,
      12
    ),

    maxBufferHole: Math.max(profile.maxBufferHole, 0.8),
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 5,

    fragLoadingTimeOut: Math.max(profile.fragLoadingTimeOut, 35000),
    fragLoadingMaxRetry: Math.max(profile.fragLoadingMaxRetry, 9),

    levelLoadingTimeOut: Math.max(profile.levelLoadingTimeOut, 30000),
    levelLoadingMaxRetry: Math.max(profile.levelLoadingMaxRetry, 7),

    manifestLoadingTimeOut: Math.max(profile.manifestLoadingTimeOut, 30000),
    manifestLoadingMaxRetry: Math.max(profile.manifestLoadingMaxRetry, 7),

    abrBandWidthFactor: Math.min(profile.abrBandWidthFactor, 0.7),
    abrBandWidthUpFactor: Math.min(profile.abrBandWidthUpFactor, 0.4),

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