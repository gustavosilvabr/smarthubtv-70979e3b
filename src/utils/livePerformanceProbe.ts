export interface LivePerformanceProfile {
  stabilityRecommended: boolean;
  reason: string;
  effectiveType?: string;
  downlinkMbps?: number;
  saveData?: boolean;
}

/**
 * Live IPTV streams benefit from stability mode on most connections.
 * Full HD channels especially need larger buffers and quality capping.
 */
export function probeLivePerformance(): LivePerformanceProfile {
  if (typeof navigator === "undefined") {
    return { stabilityRecommended: true, reason: "SSR — modo estabilidade ativo" };
  }

  const conn = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      saveData?: boolean;
    };
  }).connection;

  const effectiveType = conn?.effectiveType;
  const downlinkMbps = conn?.downlink;
  const saveData = conn?.saveData;

  if (saveData) {
    return {
      stabilityRecommended: true,
      reason: "Economia de dados ativa",
      effectiveType,
      downlinkMbps,
      saveData,
    };
  }

  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return {
      stabilityRecommended: true,
      reason: "Rede 2G detectada",
      effectiveType,
      downlinkMbps,
    };
  }

  // Sempre recomendar estabilidade para live — evita travamentos em Full HD
  return {
    stabilityRecommended: true,
    reason:
      effectiveType === "3g" || (downlinkMbps !== undefined && downlinkMbps < 5)
        ? "Banda limitada"
        : "Recomendado para canais ao vivo em alta resolução",
    effectiveType,
    downlinkMbps,
  };
}
