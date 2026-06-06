import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Radio,
  Sparkles,
  StopCircle,
  Wifi,
  XCircle,
} from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import {
  applyAutoTuneFromProbe,
  loadLiveAutoTune,
  type LiveAutoTuneState,
} from "@/utils/liveAutoTune";
import {
  runOlheiroProbe,
  type ChannelProbeResult,
  type OlheiroProbeReport,
  type TierSummary,
} from "@/utils/liveChannelProbe";
import { LIVE_TIER_LABELS, type LiveChannelTier } from "@/utils/streamProfile";

interface Props {
  liveItems: M3UItem[];
  serverUrl: string;
}

const TIER_COLORS: Record<LiveChannelTier, string> = {
  "4k": "border-purple-500/40 bg-purple-500/10",
  fhd: "border-amber-500/40 bg-amber-500/10",
  hd: "border-blue-500/40 bg-blue-500/10",
  sd: "border-emerald-500/40 bg-emerald-500/10",
};

type StatusKind = "ok" | "warning" | "error" | "idle" | "skipped";

function StatusIcon({ status }: { status: StatusKind }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-400" />;
  return <Radio className="h-4 w-4 text-muted-foreground" />;
}

function tierOverallStatus(tier: TierSummary): "ok" | "warning" | "error" | "idle" {
  if (tier.available === 0) return "idle";
  if (tier.failed > 0) return "error";
  if (tier.warnings > 0) return "warning";
  if (tier.passed > 0) return "ok";
  return "idle";
}

function ChannelRow({ channel }: { channel: ChannelProbeResult }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{channel.channelName}</p>
          <p className="text-muted-foreground">{LIVE_TIER_LABELS[channel.tier]}</p>
        </div>
        <StatusIcon status={channel.status} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
        {channel.reachMs !== undefined && <span>Reach: {channel.reachMs}ms</span>}
        {channel.manifestLoadMs !== undefined && <span>Manifest: {channel.manifestLoadMs}ms</span>}
        {channel.firstPlayMs !== undefined && <span>Play: {channel.firstPlayMs}ms</span>}
        {channel.avgBufferSec !== undefined && (
          <span>Média: {channel.avgBufferSec.toFixed(1)}s</span>
        )}
        {channel.steadyMinBufferSec !== undefined && (
          <span>Estável: {channel.steadyMinBufferSec.toFixed(1)}s</span>
        )}
        {channel.stalls > 0 && <span className="text-amber-400">Travou: {channel.stalls}x</span>}
      </div>
      {channel.recommendation && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/80">
          {channel.recommendation}
        </p>
      )}
    </div>
  );
}

export function OlheiroAtivoDashboard({ liveItems, serverUrl }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [logs, setLogs] = useState<string[]>([]);
  const [report, setReport] = useState<OlheiroProbeReport | null>(null);
  const [autoTune, setAutoTune] = useState<LiveAutoTuneState | null>(null);
  const [channels, setChannels] = useState<ChannelProbeResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = loadLiveAutoTune();
    if (stored) setAutoTune(stored);
  }, []);

  const startProbe = useCallback(async () => {
    if (running) return;
    if (!liveItems.length) return;

    abortRef.current = new AbortController();
    setRunning(true);
    setReport(null);
    setAutoTune(null);
    setChannels([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, label: "Preparando..." });

    try {
      const result = await runOlheiroProbe(
        liveItems,
        serverUrl,
        {
          onLog: (line) => setLogs((prev) => [...prev, line]),
          onProgress: (current, total, label) => setProgress({ current, total, label }),
          onChannelResult: (r) => setChannels((prev) => [...prev, r]),
        },
        abortRef.current.signal,
      );
      setReport(result);
      if (!abortRef.current?.signal.aborted && result.channels.length > 0) {
        const tuned = applyAutoTuneFromProbe(result);
        setAutoTune(tuned);
        setLogs([
          ...result.logs,
          `[${new Date().toLocaleTimeString("pt-BR")}] Otimizações automáticas aplicadas:`,
          ...tuned.changes.map((c) => `  ✓ ${c}`),
        ]);
      } else {
        setLogs(result.logs);
      }
    } catch (e) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString("pt-BR")}] Erro: ${(e as Error).message}`,
      ]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [liveItems, serverUrl, running]);

  const stopProbe = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const liveCount = liveItems.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xl md:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/30">
            <Eye className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Olheiro Ativo</h2>
            <p className="text-sm text-muted-foreground">
              Verifica desempenho da internet e delay nos canais ao vivo (4K, Full HD, HD, SD).
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {running ? (
            <button
              type="button"
              onClick={stopProbe}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20"
            >
              <StopCircle className="h-4 w-4" /> Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={startProbe}
              disabled={!liveCount}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Activity className="h-4 w-4" /> Iniciar verificação
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {liveCount} canais ao vivo na lista · testa até 2 canais por resolução · ao concluir, aplica
        otimizações automaticamente em todos os canais
      </p>

      {running && (
        <div className="mb-5 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            Verificando canais ao vivo...
          </div>
          {progress.total > 0 && (
            <div className="mb-2">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span className="truncate pr-2">{progress.label}</span>
                <span>
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Wifi className="h-4 w-4 text-primary" /> Internet
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{report.network.effectiveType ?? "—"}</dd>
              <dt className="text-muted-foreground">Download</dt>
              <dd>{report.network.downlinkMbps?.toFixed(1) ?? "—"} Mbps</dd>
              <dt className="text-muted-foreground">RTT</dt>
              <dd>{report.network.rttMs ?? "—"} ms</dd>
              <dt className="text-muted-foreground">Servidor</dt>
              <dd>{report.network.serverReachMs ?? "—"} ms</dd>
            </dl>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 text-sm font-semibold">Resumo</div>
            <p className="text-xs text-muted-foreground">
              Duração: {(report.durationMs / 1000).toFixed(1)}s · {report.channels.length} canais
              testados
            </p>
            <ul className="mt-2 space-y-1">
              {report.globalRecommendations.map((rec, i) => (
                <li key={i} className="text-xs leading-relaxed text-foreground/90">
                  → {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {autoTune && (
        <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Sparkles className="h-4 w-4" />
            Otimizações automáticas aplicadas
          </div>
          <ul className="space-y-1">
            {autoTune.changes.map((change, i) => (
              <li key={i} className="text-xs leading-relaxed text-foreground/90">
                ✓ {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(report || channels.length > 0) && (
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(report?.tiers ?? []).map((tier) => {
            const status = tierOverallStatus(tier);
            return (
              <div key={tier.tier} className={`rounded-lg border p-3 ${TIER_COLORS[tier.tier]}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{tier.label}</span>
                  <StatusIcon status={status} />
                </div>
                <p className="text-[11px] text-muted-foreground">{tier.available} na lista</p>
                {tier.tested > 0 && (
                  <p className="mt-1 text-[11px]">
                    {tier.passed} ok · {tier.warnings} alerta · {tier.failed} falha
                  </p>
                )}
                {tier.avgBufferSec !== undefined && (
                  <p className="text-[11px] text-muted-foreground">
                    Buffer médio: {tier.avgBufferSec.toFixed(1)}s
                  </p>
                )}
                <p className="mt-1.5 text-[11px] leading-snug">{tier.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}

      {channels.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">Canais testados</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {channels.map((ch) => (
              <ChannelRow key={ch.channelId} channel={ch} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Logs da verificação</h3>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {logs.length === 0 ? (
            <p>
              Pressione &quot;Iniciar verificação&quot; para o Olheiro testar os canais ao vivo.
            </p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
