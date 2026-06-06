import { ChevronDown, Wifi, WifiOff } from "lucide-react";
import type { QualityLevel } from "@/hooks/useStabilityMode";
import { QUALITY_LABELS } from "@/hooks/useStabilityMode";

interface Props {
  enabled: boolean;
  qualityLevel: QualityLevel;
  bufferTime?: number;
  onToggle: (enabled: boolean) => void;
  onQualityChange: (level: QualityLevel) => void;
  compact?: boolean;
}

const QUALITY_OPTIONS: QualityLevel[] = ["low", "medium", "high", "auto"];

export function StabilityControls({
  enabled,
  qualityLevel,
  bufferTime,
  onToggle,
  onQualityChange,
  compact = false,
}: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${compact ? "" : "mt-2"}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!enabled);
        }}
        className={[
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition",
          enabled
            ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
        ].join(" ")}
        title={enabled ? "Desativar modo estabilidade" : "Ativar modo estabilidade"}
      >
        {enabled ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
        <span>{enabled ? "Internet Fraca" : "Modo Estabilidade"}</span>
      </button>

      <div className="relative">
        <select
          value={qualityLevel}
          onChange={(e) => {
            e.stopPropagation();
            onQualityChange(e.target.value as QualityLevel);
          }}
          onClick={(e) => e.stopPropagation()}
          className="appearance-none rounded-full border border-white/10 bg-white/5 pl-3 pr-7 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/80 outline-none focus:border-amber-400/60 cursor-pointer"
          aria-label="Qualidade do vídeo"
        >
          {QUALITY_OPTIONS.map((level) => (
            <option key={level} value={level} className="bg-[#140a24] text-white">
              {QUALITY_LABELS[level]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/50" />
      </div>

      {enabled && bufferTime !== undefined && bufferTime > 0 && (
        <span className="text-[10px] text-white/40 tabular-nums">
          Buffer: {bufferTime.toFixed(1)}s
        </span>
      )}
    </div>
  );
}
