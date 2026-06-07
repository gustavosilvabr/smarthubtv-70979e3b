import type { M3UItem } from "@/types/iptv";
import { getTierAutoTune } from "@/utils/liveAutoTune";

export type LiveChannelTier = "4k" | "fhd" | "hd" | "sd";

export const LIVE_TIER_LABELS: Record<LiveChannelTier, string> = {
  "4k": "4K / UHD",
  fhd: "Full HD",
  hd: "HD",
  sd: "SD",
};

const TIER_4K_PATTERNS = [/\b4[Kk]\b/i, /\bUHD\b/i, /\bULTRA\s*HD\b/i, /\b2160[Pp]?\b/i];
const TIER_FHD_PATTERNS = [
  /\bFULL\s*HD\b/i,
  /\bFHD\b/i,
  /\b1080[Pp]?\b/i,
  /\bHD\s*\+\b/i,
  /\bHQ\b/i,
];
const TIER_HD_PATTERNS = [/\b720[Pp]?\b/i, /\bH[Dd]\b(?!\+)/i];
const TIER_SD_PATTERNS = [/\bSD\b/i, /\b480[Pp]?\b/i, /\b576[Pp]?\b/i, /\b360[Pp]?\b/i];

/** Padrões comuns em listas IPTV para canais de alta resolução / alto bitrate */
const HEAVY_STREAM_PATTERNS = [...TIER_4K_PATTERNS, ...TIER_FHD_PATTERNS];

export function classifyLiveChannelTier(item: M3UItem | null | undefined): LiveChannelTier {
  if (!item) return "sd";
  const text = `${item.name} ${item.group}`;
  if (TIER_4K_PATTERNS.some((p) => p.test(text))) return "4k";
  if (TIER_FHD_PATTERNS.some((p) => p.test(text))) return "fhd";
  if (TIER_HD_PATTERNS.some((p) => p.test(text))) return "hd";
  if (TIER_SD_PATTERNS.some((p) => p.test(text))) return "sd";
  return "sd";
}

export function groupLiveChannelsByTier(items: M3UItem[]): Record<LiveChannelTier, M3UItem[]> {
  const groups: Record<LiveChannelTier, M3UItem[]> = { "4k": [], fhd: [], hd: [], sd: [] };
  for (const item of items) {
    if (item.type !== "live") continue;
    groups[classifyLiveChannelTier(item)].push(item);
  }
  return groups;
}

export function isHeavyStream(item: M3UItem | null | undefined): boolean {
  if (!item) return false;
  const text = `${item.name} ${item.group}`;
  return HEAVY_STREAM_PATTERNS.some((p) => p.test(text));
}

export interface StreamPlaybackProfile {
  /** Canal provavelmente 1080p / alto bitrate */
  heavy: boolean;
  /** Força modo estabilidade independente da preferência do usuário */
  forceStability: boolean;
  /** Segundos mínimos de buffer antes de iniciar reprodução */
  minBufferSeconds: number;
  /** Índice máximo de qualidade HLS (-1 = sem limite manual) */
  maxHlsLevel: number;
  /** Desativa saltos agressivos para a borda ao vivo */
  disableLiveEdgeChase: boolean;
  /** Stream .ts direto costuma ser mais estável que HLS em canais FHD/4K */
  preferTsFallback: boolean;
  /** Multiplicador de buffer HLS (1 = padrão) */
  hlsBufferScale: number;
  /** Perfil ajustado automaticamente pelo Olheiro */
  autoTuned: boolean;
}

function getBaseStreamPlaybackProfile(item: M3UItem | null | undefined): StreamPlaybackProfile {
  const isLive = item?.type === "live";

  if (isLive) {
    const tier = classifyLiveChannelTier(item);
    return {
      heavy: false,
      forceStability: true,
      minBufferSeconds: 6,
      maxHlsLevel: 0,
      disableLiveEdgeChase: false,
      preferTsFallback: true,
      hlsBufferScale: 1.2,
      autoTuned: false,
    };
  }

  return {
    heavy: false,
    forceStability: false,
    minBufferSeconds: 4,
    maxHlsLevel: -1,
    disableLiveEdgeChase: false,
    preferTsFallback: false,
    hlsBufferScale: 1,
    autoTuned: false,
  };
}

export function getStreamPlaybackProfile(item: M3UItem | null | undefined): StreamPlaybackProfile {
  const base = getBaseStreamPlaybackProfile(item);
  if (!item || item.type !== "live") return base;

  const tune = getTierAutoTune(classifyLiveChannelTier(item));
  if (!tune) return base;

  return {
    ...base,
    heavy: base.heavy || tune.tier === "4k" || tune.tier === "fhd",
    forceStability: tune.forceStability,
    minBufferSeconds: tune.minBufferSeconds,
    maxHlsLevel: tune.maxHlsLevel >= 0 ? tune.maxHlsLevel : base.maxHlsLevel,
    disableLiveEdgeChase: tune.disableLiveEdgeChase,
    preferTsFallback: tune.preferTsFallback,
    hlsBufferScale: tune.hlsBufferScale,
    autoTuned: true,
  };
}

/** Escolhe o menor nível HLS com base no bitrate declarado no manifest */
export function pickLowestLevelIndex(levels: Array<{ bitrate?: number; height?: number }>): number {
  if (!levels.length) return 0;
  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const score = level.bitrate ?? level.height ?? i;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
