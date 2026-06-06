import { useMemo } from "react";
import { Activity, X } from "lucide-react";
import type { PlayerDiagnostics } from "@/hooks/useHlsPlayer";

interface Props {
  diagnostics: PlayerDiagnostics;
  lowQuality: boolean;
  onToggleLowQuality: () => void;
  onClose: () => void;
}

function fmt(n: number, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function statusColor(status: string) {
  if (status === "playing") return "text-emerald-400";
  if (status === "buffering" || status === "loading") return "text-amber-400";
  if (status === "stalled" || status === "error") return "text-red-400";
  return "text-muted-foreground";
}

export function PlayerDiagnosticsOverlay({
  diagnostics,
  lowQuality,
  onToggleLowQuality,
  onClose,
}: Props) {
  const bufferPct = useMemo(() => {
    const target = 30;
    return Math.min(100, Math.max(0, (diagnostics.bufferAhead / target) * 100));
  }, [diagnostics.bufferAhead]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/95 text-foreground backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Diagnóstico do player
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-accent"
          aria-label="Fechar diagnóstico"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2 text-[11px] sm:text-xs">
        <Stat label="Engine" value={diagnostics.engine} />
        <Stat
          label="Status"
          value={diagnostics.status}
          className={statusColor(diagnostics.status)}
        />
        <Stat label="Resolução" value={diagnostics.resolution} />
        <Stat label="Frames descartados" value={String(diagnostics.droppedFrames)} />
        <Stat
          label="Bitrate atual"
          value={
            diagnostics.currentBitrateKbps > 0
              ? `${diagnostics.currentBitrateKbps} kbps`
              : "—"
          }
        />
        <Stat
          label="Banda estimada"
          value={
            diagnostics.estimatedBandwidthKbps > 0
              ? `${diagnostics.estimatedBandwidthKbps} kbps`
              : "—"
          }
        />
        <Stat
          label="Buffer à frente"
          value={`${fmt(diagnostics.bufferAhead)} s`}
          className={
            diagnostics.bufferAhead < 2
              ? "text-red-400"
              : diagnostics.bufferAhead < 5
                ? "text-amber-400"
                : "text-emerald-400"
          }
        />
        <Stat
          label="Nível ABR"
          value={
            diagnostics.currentLevel >= 0
              ? `#${diagnostics.currentLevel} / ${diagnostics.levels.length}`
              : "auto"
          }
        />
      </div>

      <div className="px-3 pb-2">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Buffer health</span>
          <span>{fmt(bufferPct, 0)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${bufferPct}%` }}
          />
        </div>
      </div>

      {diagnostics.levels.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Qualidades disponíveis
          </div>
          <div className="flex flex-wrap gap-1">
            {diagnostics.levels.map((lv) => (
              <span
                key={lv.index}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] ${
                  lv.index === diagnostics.currentLevel
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {lv.height ? `${lv.height}p` : `#${lv.index}`} ·{" "}
                {Math.round((lv.bitrate || 0) / 1000)}k
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={lowQuality}
            onChange={onToggleLowQuality}
            className="h-3.5 w-3.5 accent-primary"
          />
          Travar na qualidade mais baixa
        </label>
      </div>

      <div className="flex-1 overflow-auto border-t border-border bg-black/40 px-3 py-2 font-mono text-[10px] leading-relaxed">
        {diagnostics.recentEvents.length === 0 ? (
          <p className="text-muted-foreground">Sem eventos ainda.</p>
        ) : (
          diagnostics.recentEvents
            .slice()
            .reverse()
            .map((line, i) => (
              <div
                key={i}
                className={
                  /FATAL|✖/.test(line)
                    ? "text-red-400"
                    : /⚠/.test(line)
                      ? "text-amber-400"
                      : /✅/.test(line)
                        ? "text-emerald-400"
                        : "text-muted-foreground"
                }
              >
                {line}
              </div>
            ))
        )}
        {diagnostics.fatalError && (
          <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-red-300">
            {diagnostics.fatalError}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-xs font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}
