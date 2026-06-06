import type { M3UItem } from "@/types/iptv";
import { getBufferAhead } from "@/hooks/useStabilityMode";
import { probeLivePerformance } from "@/utils/livePerformanceProbe";
import {
  classifyLiveChannelTier,
  groupLiveChannelsByTier,
  LIVE_TIER_LABELS,
  type LiveChannelTier,
} from "@/utils/streamProfile";

const TIER_ORDER: LiveChannelTier[] = ["4k", "fhd", "hd", "sd"];
const SAMPLES_PER_TIER = 2;
const PLAYBACK_SAMPLE_MS = 10_000;
const CHANNEL_TIMEOUT_MS = 28_000;
/** Ignora amostras dos primeiros segundos após o play (fase de subida do buffer) */
const STEADY_BUFFER_WARMUP_MS = 4000;

interface BufferMetrics {
  avgBufferSec?: number;
  minBufferSec?: number;
  steadyMinBufferSec?: number;
}

function proxied(url: string) {
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  let secureUrl = url;
  if (secureUrl.startsWith("http://")) {
    secureUrl = "https://" + secureUrl.slice(7);
  }
  return `/api/stream?u=${encodeURIComponent(secureUrl)}`;
}

export interface NetworkProbeResult {
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;
  serverReachMs?: number;
  stabilityRecommended: boolean;
  stabilityReason: string;
}

export type ChannelProbeStatus = "ok" | "warning" | "error" | "skipped";

export interface ChannelProbeResult {
  channelId: string;
  channelName: string;
  tier: LiveChannelTier;
  url: string;
  status: ChannelProbeStatus;
  reachMs?: number;
  manifestLoadMs?: number;
  firstPlayMs?: number;
  avgBufferSec?: number;
  minBufferSec?: number;
  steadyMinBufferSec?: number;
  stalls: number;
  errors: string[];
  recommendation: string;
}

export interface TierSummary {
  tier: LiveChannelTier;
  label: string;
  available: number;
  tested: number;
  passed: number;
  warnings: number;
  failed: number;
  skipped: number;
  avgManifestMs?: number;
  avgPlayMs?: number;
  avgBufferSec?: number;
  recommendation: string;
}

export interface OlheiroProbeReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  network: NetworkProbeResult;
  tiers: TierSummary[];
  channels: ChannelProbeResult[];
  globalRecommendations: string[];
  logs: string[];
}

export interface OlheiroProbeCallbacks {
  onLog?: (message: string) => void;
  onProgress?: (current: number, total: number, label: string) => void;
  onChannelResult?: (result: ChannelProbeResult) => void;
}

function avg(nums: number[]) {
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildBufferMetrics(allSamples: number[], steadySamples: number[]): BufferMetrics {
  return {
    avgBufferSec: avg(allSamples),
    minBufferSec: allSamples.length ? Math.min(...allSamples) : undefined,
    steadyMinBufferSec: steadySamples.length ? Math.min(...steadySamples) : undefined,
  };
}

function tierAvgBufferThreshold(tier: LiveChannelTier): number {
  if (tier === "4k") return 8;
  if (tier === "fhd") return 6;
  if (tier === "hd") return 4;
  return 2;
}

function tierSteadyMinThreshold(tier: LiveChannelTier): number {
  if (tier === "4k") return 5;
  if (tier === "fhd") return 3;
  if (tier === "hd") return 2;
  return 1.5;
}

function pickSamples(items: M3UItem[], count: number): M3UItem[] {
  if (items.length <= count) return items;
  const step = Math.max(1, Math.floor(items.length / count));
  const picked: M3UItem[] = [];
  for (let i = 0; i < items.length && picked.length < count; i += step) {
    picked.push(items[i]);
  }
  if (picked.length < count) {
    for (const item of items) {
      if (!picked.includes(item)) picked.push(item);
      if (picked.length >= count) break;
    }
  }
  return picked;
}

async function measureServerThroughput(
  serverUrl: string,
  signal?: AbortSignal,
): Promise<{ reachMs?: number; downlinkMbps?: number }> {
  const timeout = signal ?? AbortSignal.timeout(10_000);
  const start = performance.now();
  try {
    const res = await fetch(proxied(serverUrl), {
      method: "GET",
      headers: { Range: "bytes=0-65535" },
      signal: timeout,
    });
    const reachMs = Math.round(performance.now() - start);
    if (!res.ok && res.status !== 206 && res.status !== 404 && res.status !== 405) {
      return { reachMs };
    }
    const blob = await res.blob();
    const elapsedMs = performance.now() - start;
    const downlinkMbps =
      blob.size > 512 && elapsedMs > 50
        ? (blob.size * 8) / (elapsedMs / 1000) / 1_000_000
        : undefined;
    return { reachMs, downlinkMbps };
  } catch {
    try {
      const headStart = performance.now();
      const res = await fetch(proxied(serverUrl), { method: "HEAD", signal: timeout });
      if (res.ok || res.status === 404 || res.status === 405 || res.status === 502) {
        return { reachMs: Math.round(performance.now() - headStart) };
      }
    } catch {
      // servidor inacessível
    }
    return {};
  }
}

async function probeNetwork(serverUrl: string, signal?: AbortSignal): Promise<NetworkProbeResult> {
  const perf = probeLivePerformance();
  const conn = (
    navigator as Navigator & {
      connection?: { rtt?: number; effectiveType?: string; downlink?: number; saveData?: boolean };
    }
  ).connection;

  const server = await measureServerThroughput(serverUrl, signal);
  const apiDownlink = perf.downlinkMbps ?? conn?.downlink;
  const downlinkMbps =
    server.downlinkMbps !== undefined
      ? Math.min(server.downlinkMbps, apiDownlink ?? server.downlinkMbps)
      : apiDownlink;

  return {
    effectiveType: perf.effectiveType ?? conn?.effectiveType,
    downlinkMbps,
    rttMs: conn?.rtt,
    saveData: perf.saveData ?? conn?.saveData,
    serverReachMs: server.reachMs,
    stabilityRecommended: perf.stabilityRecommended,
    stabilityReason: perf.reason,
  };
}

async function measureReach(
  url: string,
  signal?: AbortSignal,
): Promise<{ ms: number; ok: boolean; error?: string }> {
  const timeout = signal ?? AbortSignal.timeout(12_000);

  const start = performance.now();
  try {
    const res = await fetch(url, { method: "HEAD", signal: timeout });
    const ms = Math.round(performance.now() - start);
    if (res.ok || res.status === 404 || res.status === 405) return { ms, ok: true };
    if (res.status === 403 || res.status === 501) {
      return measureReachGet(url, timeout, start);
    }
    return { ms, ok: false, error: `HTTP ${res.status}` };
  } catch {
    return measureReachGet(url, timeout, start);
  }
}

async function measureReachGet(
  url: string,
  signal: AbortSignal,
  startedAt: number,
): Promise<{ ms: number; ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal,
    });
    const ms = Math.round(performance.now() - startedAt);
    if (res.ok || res.status === 206 || res.status === 404 || res.status === 405) {
      return { ms, ok: true };
    }
    return { ms, ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ms: Math.round(performance.now() - startedAt), ok: false, error: (e as Error).message };
  }
}

function evaluateChannel(
  tier: LiveChannelTier,
  reachMs: number | undefined,
  manifestLoadMs: number | undefined,
  firstPlayMs: number | undefined,
  avgBufferSec: number | undefined,
  steadyMinBufferSec: number | undefined,
  stalls: number,
  errors: string[],
): { status: ChannelProbeStatus; recommendation: string } {
  const fatalErrors = errors.filter(
    (e) => !e.includes("Autoplay bloqueado") && !e.includes("Não iniciou reprodução"),
  );

  if (fatalErrors.length > 0 && !manifestLoadMs) {
    return {
      status: "error",
      recommendation: "Canal inacessível — verifique servidor ou URL do stream.",
    };
  }

  const issues: string[] = [];
  const avgThreshold = tierAvgBufferThreshold(tier);
  const steadyThreshold = tierSteadyMinThreshold(tier);
  const playWarnMs = tier === "4k" || tier === "fhd" ? 6000 : tier === "hd" ? 5000 : 4500;

  if (reachMs !== undefined && reachMs > 2000) {
    issues.push(`latência no servidor (${reachMs}ms)`);
  }
  if (manifestLoadMs !== undefined && manifestLoadMs > 4000) {
    issues.push(`manifest lento (${manifestLoadMs}ms)`);
  }
  if (firstPlayMs !== undefined && firstPlayMs > playWarnMs) {
    issues.push(`demora para iniciar (${firstPlayMs}ms)`);
  }

  const bufferHealthy = avgBufferSec !== undefined && avgBufferSec >= avgThreshold;
  const steadyWeak =
    steadyMinBufferSec !== undefined && steadyMinBufferSec < steadyThreshold && !bufferHealthy;

  if (!bufferHealthy && avgBufferSec !== undefined) {
    issues.push(`buffer médio baixo (${avgBufferSec.toFixed(1)}s, ideal ≥${avgThreshold}s)`);
  } else if (steadyWeak) {
    issues.push(
      `buffer oscila após estabilizar (mín ${steadyMinBufferSec!.toFixed(1)}s, ideal ≥${steadyThreshold}s)`,
    );
  }

  if (stalls > 0) issues.push(`${stalls} travamento(s) durante o teste`);

  const playbackVerified =
    firstPlayMs !== undefined && (avgBufferSec === undefined || avgBufferSec > 0);

  if (!playbackVerified) {
    if (!firstPlayMs) issues.push("reprodução não iniciou no teste");
    for (const err of fatalErrors) {
      if (err.startsWith("HLS:") || err.includes("Timeout")) {
        issues.push(err.replace(/^HLS:\s*/, ""));
      }
    }
  }

  if (issues.length === 0) {
    const note =
      tier === "fhd" || tier === "4k"
        ? "Canal estável — mantenha modo estabilidade em Full HD por segurança."
        : "Canal estável neste teste.";
    return { status: "ok", recommendation: note };
  }

  const critical =
    fatalErrors.length > 0 ||
    stalls >= 2 ||
    (avgBufferSec !== undefined && avgBufferSec < avgThreshold * 0.45);

  if (critical) {
    return {
      status: "error",
      recommendation: buildTierRecommendation(tier, issues, bufferHealthy),
    };
  }
  return {
    status: "warning",
    recommendation: buildTierRecommendation(tier, issues, bufferHealthy),
  };
}

function buildTierRecommendation(
  tier: LiveChannelTier,
  issues: string[],
  bufferHealthy: boolean,
): string {
  const hints: string[] = [...issues];
  if (!bufferHealthy && (tier === "4k" || tier === "fhd")) {
    hints.push("Use modo estabilidade com qualidade baixa em Full HD");
  } else if (tier === "fhd" && bufferHealthy) {
    hints.push("Buffer bom — se travar ao vivo, reduza qualidade só nos picos");
  }
  if (tier === "hd" && !bufferHealthy) {
    hints.push("Considere qualidade média no modo estabilidade");
  }
  return hints.join(" · ");
}

type PlaybackProbeResult = {
  manifestLoadMs?: number;
  firstPlayMs?: number;
  stalls: number;
  errors: string[];
} & BufferMetrics;

function snapshotPlayback(
  bufferSamples: number[],
  steadySamples: number[],
  base: Omit<PlaybackProbeResult, keyof BufferMetrics>,
): PlaybackProbeResult {
  return { ...base, ...buildBufferMetrics(bufferSamples, steadySamples) };
}

async function probeChannelPlayback(
  item: M3UItem,
  signal?: AbortSignal,
): Promise<PlaybackProbeResult> {
  const url = proxied(item.url);
  const errors: string[] = [];
  let manifestLoadMs: number | undefined;
  let firstPlayMs: number | undefined;
  let stalls = 0;
  const bufferSamples: number[] = [];
  const steadySamples: number[] = [];
  let playStartedAt: number | null = null;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.style.cssText =
    "position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";

  document.body.appendChild(video);

  const cleanup = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  };

  try {
    if (signal?.aborted) throw new Error("Verificação cancelada");

    const mod = await import("hls.js");
    const Hls = mod.default;

    if (!Hls.isSupported()) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        try {
          return await probeNativePlayback(video, url, signal);
        } finally {
          cleanup();
        }
      }
      cleanup();
      errors.push("HLS não suportado neste navegador");
      return { errors, stalls: 0 };
    }

    return await new Promise((resolve) => {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 12000,
        fragLoadingTimeOut: 12000,
      });

      const startTime = performance.now();
      let manifestParsed = false;
      let playing = false;
      let lastTime = 0;
      let stalledSince: number | null = null;
      let finished = false;

      const finish = (result: PlaybackProbeResult) => {
        if (finished) return;
        finished = true;
        clearInterval(sampleTimer);
        clearTimeout(hardTimeout);
        signal?.removeEventListener("abort", onAbort);
        try {
          hls.destroy();
        } catch {
          // destroy pode falhar se já foi destruído
        }
        cleanup();
        resolve(result);
      };

      const onAbort = () => finish({ errors: ["Verificação cancelada"], stalls });

      const hardTimeout = setTimeout(() => {
        errors.push("Timeout no teste do canal");
        finish(
          snapshotPlayback(bufferSamples, steadySamples, {
            manifestLoadMs,
            firstPlayMs,
            stalls,
            errors,
          }),
        );
      }, CHANNEL_TIMEOUT_MS);

      const sampleTimer = setInterval(() => {
        if (signal?.aborted) {
          onAbort();
          return;
        }
        const buf = getBufferAhead(video);
        if (buf > 0) {
          bufferSamples.push(buf);
          if (
            playStartedAt !== null &&
            performance.now() - playStartedAt >= STEADY_BUFFER_WARMUP_MS
          ) {
            steadySamples.push(buf);
          }
        }

        if (!video.paused && video.readyState >= 2) {
          const now = Date.now();
          if (lastTime > 0 && video.currentTime - lastTime < 0.3) {
            if (stalledSince === null) stalledSince = now;
            else if (now - stalledSince > 2500) {
              stalls++;
              stalledSince = null;
            }
          } else {
            stalledSince = null;
          }
          lastTime = video.currentTime;
        }
      }, 500);

      signal?.addEventListener("abort", onAbort);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestParsed = true;
        manifestLoadMs = Math.round(performance.now() - startTime);
        video.play().catch(() => errors.push("Autoplay bloqueado"));
      });

      hls.on(
        Hls.Events.ERROR,
        (_: unknown, data: { fatal?: boolean; type?: string; details?: string }) => {
          if (!data.fatal) return;
          errors.push(`HLS: ${data.type ?? "erro"} ${data.details ?? ""}`.trim());
          finish(
            snapshotPlayback(bufferSamples, steadySamples, {
              manifestLoadMs,
              firstPlayMs,
              stalls,
              errors,
            }),
          );
        },
      );

      video.onplaying = () => {
        if (!playing) {
          playing = true;
          playStartedAt = performance.now();
          firstPlayMs = Math.round(performance.now() - startTime);
        }
      };

      setTimeout(() => {
        finish(
          snapshotPlayback(bufferSamples, steadySamples, {
            manifestLoadMs,
            firstPlayMs: playing ? firstPlayMs : manifestParsed ? firstPlayMs : undefined,
            stalls,
            errors: playing ? errors : [...errors, ...(playing ? [] : ["Não iniciou reprodução"])],
          }),
        );
      }, PLAYBACK_SAMPLE_MS);

      hls.loadSource(url);
      hls.attachMedia(video);
    });
  } catch (e) {
    cleanup();
    errors.push((e as Error).message);
    return { errors, stalls: 0 };
  }
}

async function probeNativePlayback(
  video: HTMLVideoElement,
  url: string,
  signal?: AbortSignal,
): Promise<PlaybackProbeResult> {
  const errors: string[] = [];
  const bufferSamples: number[] = [];
  const steadySamples: number[] = [];
  let firstPlayMs: number | undefined;
  let playStartedAt: number | null = null;
  const startTime = performance.now();

  return new Promise((resolve) => {
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimeout);
      clearInterval(sampleTimer);
      signal?.removeEventListener("abort", onAbort);
      resolve(
        snapshotPlayback(bufferSamples, steadySamples, {
          firstPlayMs,
          stalls: 0,
          errors,
        }),
      );
    };

    const onAbort = () => {
      errors.push("Verificação cancelada");
      finish();
    };

    const hardTimeout = setTimeout(finish, CHANNEL_TIMEOUT_MS);
    signal?.addEventListener("abort", onAbort);

    const sampleTimer = setInterval(() => {
      const buf = getBufferAhead(video);
      if (buf > 0) {
        bufferSamples.push(buf);
        if (
          playStartedAt !== null &&
          performance.now() - playStartedAt >= STEADY_BUFFER_WARMUP_MS
        ) {
          steadySamples.push(buf);
        }
      }
    }, 500);

    video.onplaying = () => {
      if (!firstPlayMs) {
        playStartedAt = performance.now();
        firstPlayMs = Math.round(performance.now() - startTime);
      }
    };
    video.onerror = () => errors.push("Erro no player nativo");

    setTimeout(finish, PLAYBACK_SAMPLE_MS);

    video.src = url;
    video.load();
    video.play().catch(() => errors.push("Autoplay bloqueado"));
  });
}

function buildTierSummary(
  tier: LiveChannelTier,
  results: ChannelProbeResult[],
  available: number,
): TierSummary {
  const tierResults = results.filter((r) => r.tier === tier);
  const tested = tierResults.length;
  const passed = tierResults.filter((r) => r.status === "ok").length;
  const warnings = tierResults.filter((r) => r.status === "warning").length;
  const failed = tierResults.filter((r) => r.status === "error").length;
  const skipped = tierResults.filter((r) => r.status === "skipped").length;

  let recommendation = "";
  if (available === 0) {
    recommendation = "Nenhum canal desta resolução na lista.";
  } else if (tested === 0) {
    recommendation = "Não testado nesta verificação.";
  } else if (failed > 0) {
    recommendation =
      tier === "4k" || tier === "fhd"
        ? "Travamentos prováveis — use modo estabilidade, qualidade baixa e buffer maior."
        : "Problemas detectados — verifique conexão ou servidor IPTV.";
  } else if (warnings > 0) {
    recommendation = "Leve instabilidade — monitore em horário de pico.";
  } else if (tier === "fhd" || tier === "4k") {
    recommendation = "Estável no teste — mantenha modo estabilidade em Full HD por segurança.";
  } else {
    recommendation = "Desempenho aceitável neste teste.";
  }

  return {
    tier,
    label: LIVE_TIER_LABELS[tier],
    available,
    tested,
    passed,
    warnings,
    failed,
    skipped,
    avgManifestMs: avg(
      tierResults.map((r) => r.manifestLoadMs).filter((n): n is number => n !== undefined),
    ),
    avgPlayMs: avg(
      tierResults.map((r) => r.firstPlayMs).filter((n): n is number => n !== undefined),
    ),
    avgBufferSec: avg(
      tierResults.map((r) => r.avgBufferSec).filter((n): n is number => n !== undefined),
    ),
    recommendation,
  };
}

function buildGlobalRecommendations(
  network: NetworkProbeResult,
  tiers: TierSummary[],
  channels: ChannelProbeResult[],
): string[] {
  const recs: string[] = [];

  if (network.saveData) recs.push("Economia de dados ativa — desative para melhor streaming.");
  if (network.downlinkMbps !== undefined && network.downlinkMbps < 8) {
    recs.push(
      `Banda baixa (${network.downlinkMbps.toFixed(1)} Mbps) — priorize SD/HD e modo estabilidade.`,
    );
  } else if (network.downlinkMbps !== undefined && network.downlinkMbps < 15) {
    recs.push(
      `Banda moderada (${network.downlinkMbps.toFixed(1)} Mbps) — HD estável; Full HD pode oscilar em picos.`,
    );
  }
  if (network.rttMs !== undefined && network.rttMs > 150) {
    recs.push(`RTT alto (${network.rttMs}ms) — espere mais delay em canais Full HD/4K.`);
  }
  if (network.serverReachMs !== undefined && network.serverReachMs > 2000) {
    recs.push(`Servidor IPTV lento (${network.serverReachMs}ms) — pode ser causa dos travamentos.`);
  } else if (network.serverReachMs !== undefined && network.serverReachMs > 350) {
    recs.push(
      `Servidor com latência moderada (${network.serverReachMs}ms) — início do canal em ~3s é normal.`,
    );
  }

  const fhd = tiers.find((t) => t.tier === "fhd");
  const uhd = tiers.find((t) => t.tier === "4k");
  if ((fhd?.failed ?? 0) > 0 || (uhd?.failed ?? 0) > 0) {
    recs.push("Full HD/4K com falhas — mantenha modo estabilidade ativo e qualidade baixa.");
  } else if ((fhd?.passed ?? 0) > 0 && (fhd?.failed ?? 0) === 0) {
    recs.push("Full HD passou no teste — se travar ao vivo, reduza qualidade só nos canais FHD.");
  }

  const totalStalls = channels.reduce((s, c) => s + c.stalls, 0);
  if (totalStalls >= 3) {
    recs.push(`${totalStalls} travamentos detectados — aumente buffer antes de reproduzir.`);
  }

  const lowAvgBuffer = channels.filter(
    (c) => (c.avgBufferSec ?? 99) < tierAvgBufferThreshold(c.tier),
  );
  if (lowAvgBuffer.length >= 2) {
    recs.push(
      "Buffer médio baixo em vários canais — conexão ou servidor não sustenta a qualidade.",
    );
  }

  if (network.stabilityRecommended) {
    recs.push(network.stabilityReason);
  }

  if (!recs.length) {
    recs.push(
      "Nenhum problema crítico detectado — se ainda travar, repita o teste em horário de pico.",
    );
  }

  return recs;
}

export async function runOlheiroProbe(
  liveItems: M3UItem[],
  serverUrl: string,
  callbacks?: OlheiroProbeCallbacks,
  signal?: AbortSignal,
): Promise<OlheiroProbeReport> {
  const startedAt = new Date().toISOString();
  const startMs = performance.now();
  const logs: string[] = [];
  const channels: ChannelProbeResult[] = [];

  const log = (message: string) => {
    const line = `[${new Date().toLocaleTimeString("pt-BR")}] ${message}`;
    logs.push(line);
    callbacks?.onLog?.(line);
  };

  log("Olheiro Ativo iniciado — verificando rede e canais ao vivo...");

  const network = await probeNetwork(serverUrl, signal);
  log(
    `Rede: ${network.effectiveType ?? "?"} · ${network.downlinkMbps?.toFixed(1) ?? "?"} Mbps (medido) · RTT ${network.rttMs ?? "?"}ms`,
  );
  if (network.serverReachMs !== undefined) {
    log(`Servidor IPTV respondeu em ${network.serverReachMs}ms`);
  } else {
    log("Não foi possível medir latência do servidor IPTV");
  }

  const grouped = groupLiveChannelsByTier(liveItems);
  const queue: { item: M3UItem; tier: LiveChannelTier }[] = [];

  for (const tier of TIER_ORDER) {
    const samples = pickSamples(grouped[tier], SAMPLES_PER_TIER);
    for (const item of samples) {
      queue.push({ item, tier: classifyLiveChannelTier(item) });
    }
    log(`${LIVE_TIER_LABELS[tier]}: ${grouped[tier].length} canais (${samples.length} para teste)`);
  }

  const total = queue.length;
  let current = 0;

  for (const { item, tier } of queue) {
    if (signal?.aborted) {
      log("Verificação cancelada pelo usuário.");
      break;
    }

    current++;
    callbacks?.onProgress?.(current, total, item.name);
    log(`Testando [${LIVE_TIER_LABELS[tier]}] ${item.name}...`);

    const streamUrl = proxied(item.url);
    const reach = await measureReach(streamUrl, signal);

    if (!reach.ok) {
      const result: ChannelProbeResult = {
        channelId: item.id,
        channelName: item.name,
        tier,
        url: item.url,
        status: "error",
        reachMs: reach.ms,
        stalls: 0,
        errors: [reach.error ?? "Inacessível"],
        recommendation: "Canal inacessível — verifique URL ou servidor.",
      };
      channels.push(result);
      callbacks?.onChannelResult?.(result);
      log(`  ✗ Inacessível (${reach.ms}ms): ${reach.error ?? "erro"}`);
      continue;
    }

    const playback = await probeChannelPlayback(item, signal);
    const evaluation = evaluateChannel(
      tier,
      reach.ms,
      playback.manifestLoadMs,
      playback.firstPlayMs,
      playback.avgBufferSec,
      playback.steadyMinBufferSec,
      playback.stalls,
      playback.errors,
    );

    const result: ChannelProbeResult = {
      channelId: item.id,
      channelName: item.name,
      tier,
      url: item.url,
      status: evaluation.status,
      reachMs: reach.ms,
      manifestLoadMs: playback.manifestLoadMs,
      firstPlayMs: playback.firstPlayMs,
      avgBufferSec: playback.avgBufferSec,
      minBufferSec: playback.minBufferSec,
      steadyMinBufferSec: playback.steadyMinBufferSec,
      stalls: playback.stalls,
      errors: playback.errors,
      recommendation: evaluation.recommendation,
    };

    channels.push(result);
    callbacks?.onChannelResult?.(result);

    const icon = evaluation.status === "ok" ? "✓" : evaluation.status === "warning" ? "⚠" : "✗";
    log(
      `  ${icon} reach ${reach.ms}ms · play ${playback.firstPlayMs ?? "?"}ms · buffer ${playback.avgBufferSec?.toFixed(1) ?? "?"}s · stalls ${playback.stalls}`,
    );
  }

  const tiers = TIER_ORDER.map((tier) => buildTierSummary(tier, channels, grouped[tier].length));
  const globalRecommendations = buildGlobalRecommendations(network, tiers, channels);

  log("Verificação concluída.");
  for (const rec of globalRecommendations) {
    log(`→ ${rec}`);
  }

  const finishedAt = new Date().toISOString();
  return {
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - startMs),
    network,
    tiers,
    channels,
    globalRecommendations,
    logs,
  };
}
