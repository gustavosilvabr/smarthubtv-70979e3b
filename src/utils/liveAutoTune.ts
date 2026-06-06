import type { QualityLevel } from "@/hooks/useStabilityMode";
import { LIVE_TIER_LABELS, type LiveChannelTier } from "@/utils/streamProfile";

export interface AutoTuneProbeInput {
  durationMs: number;
  network: { downlinkMbps?: number; serverReachMs?: number };
  tiers: Array<{
    tier: LiveChannelTier;
    avgBufferSec?: number;
    avgPlayMs?: number;
    failed: number;
    warnings: number;
  }>;
  channels: Array<{ tier: LiveChannelTier; stalls: number; avgBufferSec?: number }>;
}

export const LIVE_AUTO_TUNE_STORAGE_KEY = "iptv_live_auto_tune";
export const LIVE_AUTO_TUNE_EVENT = "iptv:live-auto-tune-applied";

const TIER_ORDER: LiveChannelTier[] = ["4k", "fhd", "hd", "sd"];

export interface TierAutoTune {
  tier: LiveChannelTier;
  minBufferSeconds: number;
  preferTsFallback: boolean;
  forceStability: boolean;
  maxHlsLevel: number;
  hlsBufferScale: number;
  disableLiveEdgeChase: boolean;
  qualityLevel: QualityLevel;
}

export interface LiveAutoTuneState {
  appliedAt: string;
  probeDurationMs: number;
  globalQuality: QualityLevel;
  stabilityEnabled: boolean;
  tiers: Record<LiveChannelTier, TierAutoTune>;
  changes: string[];
}

const TIER_BASE: Record<LiveChannelTier, Omit<TierAutoTune, "tier">> = {
  "4k": {
    minBufferSeconds: 16,
    preferTsFallback: true,
    forceStability: true,
    maxHlsLevel: 0,
    hlsBufferScale: 1.25,
    disableLiveEdgeChase: true,
    qualityLevel: "low",
  },
  fhd: {
    minBufferSeconds: 14,
    preferTsFallback: true,
    forceStability: true,
    maxHlsLevel: 0,
    hlsBufferScale: 1.2,
    disableLiveEdgeChase: true,
    qualityLevel: "low",
  },
  hd: {
    minBufferSeconds: 8,
    preferTsFallback: false,
    forceStability: true,
    maxHlsLevel: -1,
    hlsBufferScale: 1,
    disableLiveEdgeChase: false,
    qualityLevel: "medium",
  },
  sd: {
    minBufferSeconds: 6,
    preferTsFallback: false,
    forceStability: true,
    maxHlsLevel: -1,
    hlsBufferScale: 1,
    disableLiveEdgeChase: false,
    qualityLevel: "auto",
  },
};

function tierBufferGoal(tier: LiveChannelTier): number {
  if (tier === "4k") return 8;
  if (tier === "fhd") return 6;
  if (tier === "hd") return 4;
  return 2;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function deriveTierTune(
  tier: LiveChannelTier,
  report: AutoTuneProbeInput,
  changes: string[],
): TierAutoTune {
  const base = { tier, ...TIER_BASE[tier] };
  const summary = report.tiers.find((t) => t.tier === tier);
  const samples = report.channels.filter((c) => c.tier === tier);
  const avgBuffer = summary?.avgBufferSec;
  const maxStalls = samples.reduce((m, c) => Math.max(m, c.stalls), 0);
  const failed = summary?.failed ?? 0;
  const warnings = summary?.warnings ?? 0;
  const avgPlay = summary?.avgPlayMs;
  const goal = tierBufferGoal(tier);

  let minBuffer = base.minBufferSeconds;
  let hlsBufferScale = base.hlsBufferScale;
  let preferTs = base.preferTsFallback;
  let qualityLevel = base.qualityLevel;
  let maxHlsLevel = base.maxHlsLevel;

  const downlink = report.network.downlinkMbps;
  if (downlink !== undefined) {
    if (downlink < 8) {
      minBuffer += 4;
      hlsBufferScale += 0.25;
      qualityLevel = "low";
      if (tier === "fhd" || tier === "4k") preferTs = true;
    } else if (downlink < 15) {
      if (tier === "fhd" || tier === "4k") {
        minBuffer += 2;
        hlsBufferScale += 0.1;
        qualityLevel = "low";
      } else if (tier === "hd") {
        qualityLevel = "medium";
      }
    }
  }

  const serverMs = report.network.serverReachMs;
  if (serverMs !== undefined && serverMs > 350) {
    minBuffer += clamp(Math.floor(serverMs / 250), 1, 4);
  }

  if (avgBuffer !== undefined) {
    if (avgBuffer < goal) {
      minBuffer += 3;
      hlsBufferScale += 0.15;
      preferTs = tier === "fhd" || tier === "4k" || preferTs;
      changes.push(
        `${LIVE_TIER_LABELS[tier]}: buffer médio baixo (${avgBuffer.toFixed(1)}s) — buffer aumentado`,
      );
    } else if (avgBuffer >= goal * 2.5 && failed === 0 && maxStalls === 0) {
      changes.push(
        `${LIVE_TIER_LABELS[tier]}: buffer excelente (${avgBuffer.toFixed(1)}s) — perfil otimizado`,
      );
    }
  }

  if (maxStalls > 0) {
    minBuffer += maxStalls * 2;
    hlsBufferScale += 0.12 * maxStalls;
    preferTs = true;
    qualityLevel = "low";
    changes.push(
      `${LIVE_TIER_LABELS[tier]}: ${maxStalls} travamento(s) — anti-travamento reforçado`,
    );
  }

  if (failed > 0) {
    minBuffer += 3;
    hlsBufferScale = Math.max(hlsBufferScale, 1.35);
    qualityLevel = "low";
    maxHlsLevel = 0;
    preferTs = true;
    changes.push(`${LIVE_TIER_LABELS[tier]}: falhas no teste — modo conservador ativo`);
  } else if (warnings > 0) {
    minBuffer += 1;
    if (tier === "fhd" || tier === "4k") qualityLevel = "low";
    changes.push(`${LIVE_TIER_LABELS[tier]}: alertas no teste — ajuste preventivo aplicado`);
  }

  if (avgPlay !== undefined && avgPlay > 5000) {
    minBuffer += 2;
    changes.push(
      `${LIVE_TIER_LABELS[tier]}: início lento (${Math.round(avgPlay)}ms) — mais buffer pré-play`,
    );
  }

  if ((tier === "fhd" || tier === "4k") && preferTs) {
    changes.push(`${LIVE_TIER_LABELS[tier]}: stream .ts direto ativado`);
  }

  return {
    tier,
    minBufferSeconds: clamp(minBuffer, 6, 22),
    preferTsFallback: preferTs,
    forceStability: true,
    maxHlsLevel,
    hlsBufferScale: clamp(hlsBufferScale, 1, 1.6),
    disableLiveEdgeChase: tier === "fhd" || tier === "4k",
    qualityLevel,
  };
}

function deriveGlobalQuality(tiers: Record<LiveChannelTier, TierAutoTune>): QualityLevel {
  if (tiers["4k"].qualityLevel === "low" || tiers.fhd.qualityLevel === "low") return "low";
  if (tiers.hd.qualityLevel === "medium") return "medium";
  return "low";
}

export function deriveAutoTuneFromProbe(report: AutoTuneProbeInput): LiveAutoTuneState {
  const changes: string[] = [];
  const tiers = {} as Record<LiveChannelTier, TierAutoTune>;

  for (const tier of TIER_ORDER) {
    tiers[tier] = deriveTierTune(tier, report, changes);
  }

  const globalQuality = deriveGlobalQuality(tiers);
  changes.unshift(`Modo estabilidade ativado · qualidade global: ${globalQuality}`);

  const serverMs = report.network.serverReachMs;
  if (serverMs !== undefined && serverMs > 350) {
    const extra = clamp(Math.floor(serverMs / 250), 1, 4);
    changes.push(`Servidor ${serverMs}ms: +${extra}s de buffer em todos os tiers`);
  }

  return {
    appliedAt: new Date().toISOString(),
    probeDurationMs: report.durationMs,
    globalQuality,
    stabilityEnabled: true,
    tiers,
    changes: [...new Set(changes)],
  };
}

export function loadLiveAutoTune(): LiveAutoTuneState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIVE_AUTO_TUNE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LiveAutoTuneState;
  } catch {
    return null;
  }
}

export function saveLiveAutoTune(state: LiveAutoTuneState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIVE_AUTO_TUNE_STORAGE_KEY, JSON.stringify(state));
}

export function applyAutoTuneFromProbe(report: AutoTuneProbeInput): LiveAutoTuneState {
  const state = deriveAutoTuneFromProbe(report);
  saveLiveAutoTune(state);

  if (typeof window !== "undefined") {
    const stability = { enabled: state.stabilityEnabled, qualityLevel: state.globalQuality };
    localStorage.setItem("iptv_stability_mode", JSON.stringify(stability));
    window.dispatchEvent(new CustomEvent(LIVE_AUTO_TUNE_EVENT, { detail: state }));
  }

  return state;
}

export function getTierAutoTune(tier: LiveChannelTier): TierAutoTune | null {
  return loadLiveAutoTune()?.tiers[tier] ?? null;
}
