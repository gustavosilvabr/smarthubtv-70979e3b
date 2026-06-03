import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export type LoadingStage = "live" | "vod" | "series" | "epg" | "done";

interface Props {
  stage: LoadingStage;
  error?: string | null;
  onRetry?: () => void;
}

const STEPS: { key: Exclude<LoadingStage, "done">; label: string }[] = [
  { key: "live", label: "LIVE TV" },
  { key: "vod", label: "VOD" },
  { key: "series", label: "SERIES" },
  { key: "epg", label: "TV GUIDE" },
];

const ORDER: LoadingStage[] = ["live", "vod", "series", "epg", "done"];

function statusOf(current: LoadingStage, step: LoadingStage) {
  const ci = ORDER.indexOf(current);
  const si = ORDER.indexOf(step);
  if (ci > si) return "done";
  if (ci === si) return "active";
  return "wait";
}

export function LoadingScreen({ stage, error, onRetry }: Props) {
  // Animate through stages locally for visual rhythm — driven by parent stage prop.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 800);
    return () => clearInterval(i);
  }, []);

  const activeLabel =
    STEPS.find((s) => s.key === stage)?.label ?? "Finalizando";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute bottom-[-180px] left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[160px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 py-10">
        <Logo className="mb-10 h-28 w-auto drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]" />

        <div className="w-full rounded-2xl border border-primary/20 bg-card/70 p-6 shadow-2xl backdrop-blur">
          <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Update Media Contents
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEPS.map((s) => {
              const st = statusOf(stage, s.key);
              return (
                <div
                  key={s.key}
                  className={`rounded-xl border px-3 py-4 text-center transition ${
                    st === "done"
                      ? "border-primary/50 bg-primary/10"
                      : st === "active"
                      ? "border-primary bg-primary/15 shadow-[0_0_20px_-4px_rgba(168,85,247,0.6)]"
                      : "border-border bg-background/40"
                  }`}
                >
                  <div className="text-xs font-bold tracking-wider text-foreground">
                    {s.label}
                  </div>
                  <div className="mt-2 flex items-center justify-center text-[11px] text-muted-foreground">
                    {st === "done" && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Check className="h-3.5 w-3.5" /> Completed!
                      </span>
                    )}
                    {st === "active" && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                      </span>
                    )}
                    {st === "wait" && <span>Waiting...</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            {!error && (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Now Updating <span className="text-foreground">{activeLabel}</span>
                  <span className="inline-block w-6 text-left">
                    {".".repeat((tick % 3) + 1)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground/70">Please wait...</p>
              </>
            )}
            {error && (
              <>
                <p className="text-sm font-semibold text-destructive">Falha ao carregar</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Tentar novamente
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
