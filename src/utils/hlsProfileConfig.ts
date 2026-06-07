import type HLS from "hls.js";
import type { LiveChannelTier } from "./streamProfile";

export interface HlsProfile {
  lowLatencyMode: boolean;
  maxBufferLength: number;
  maxMaxBufferLength: number;
  liveSyncDurationCount: number;
  liveMaxLatencyDurationCount: number;
  maxBufferHole: number;
  fragLoadingTimeOut: number;
  fragLoadingMaxRetry: number;
  levelLoadingMaxRetry: number;
  abrBandWidthFactor: number;
  abrBandWidthUpFactor: number;
  highBufferWatchdogPeriod?: number;
  nudgeOffset?: number;
  nudgeMaxRetry?: number;
  capLevelToPlayerSize?: boolean;
}

const HLS_PROFILES: Record<"sd" | "hd" | "fhd", HlsProfile> = {
  sd: {
    lowLatencyMode: false,
    maxBufferLength: 15,
    maxMaxBufferLength: 30,
    liveSyncDurationCount: 2,
    liveMaxLatencyDurationCount: 5,
    maxBufferHole: 0.5,
    fragLoadingTimeOut: 15000,
    fragLoadingMaxRetry: 4,
    levelLoadingMaxRetry: 4,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.6,
  },
  hd: {
    lowLatencyMode: false,
    maxBufferLength: 25,
    maxMaxBufferLength: 45,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 7,
    maxBufferHole: 0.5,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
    levelLoadingMaxRetry: 4,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.6,
  },
  fhd: {
    lowLatencyMode: false,
    maxBufferLength: 40,
    maxMaxBufferLength: 60,
    liveSyncDurationCount: 4,
    liveMaxLatencyDurationCount: 10,
    maxBufferHole: 0.8,
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 5,
    fragLoadingTimeOut: 30000,
    fragLoadingMaxRetry: 8,
    levelLoadingMaxRetry: 6,
    abrBandWidthFactor: 0.75,
    abrBandWidthUpFactor: 0.5,
    capLevelToPlayerSize: true,
  },
};

export function selectProfileForTier(tier: LiveChannelTier): HlsProfile {
  if (tier === "4k" || tier === "fhd") return HLS_PROFILES.fhd;
  if (tier === "hd") return HLS_PROFILES.hd;
  return HLS_PROFILES.sd;
}

export function applyHlsProfile(hls: HLS.default | null | undefined, profile: HlsProfile): void {
  if (!hls || !hls.config) return;

  const config = hls.config;
  config.maxBufferLength = profile.maxBufferLength;
  config.maxMaxBufferLength = profile.maxMaxBufferLength;
  config.lowLatencyMode = profile.lowLatencyMode;
  config.liveSyncDurationCount = profile.liveSyncDurationCount;
  config.liveMaxLatencyDurationCount = profile.liveMaxLatencyDurationCount;
  config.maxBufferHole = profile.maxBufferHole;
  config.fragLoadingTimeOut = profile.fragLoadingTimeOut;
  config.fragLoadingMaxRetry = profile.fragLoadingMaxRetry;
  config.levelLoadingMaxRetry = profile.levelLoadingMaxRetry;
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
}
