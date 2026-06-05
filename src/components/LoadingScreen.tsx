import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useGsapEntrance } from "@/hooks/useGsapEntrance";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

export type LoadingStage = "live" | "vod" | "series" | "epg" | "done";

interface Props {
  stage: LoadingStage;
  error?: string | null;
  onLogout?: () => void;
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

export function LoadingScreen({ stage, error, onLogout, onRetry }: Props) {
  // Animate through stages locally for visual rhythm — driven by parent stage prop.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 800);
    return () => clearInterval(i);
  }, []);

  const activeLabel =
    STEPS.find((s) => s.key === stage)?.label ?? "Finalizando";

  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(logoRef, { y: -20, scale: 0.95, duration: 0.7, ease: "back.out(1.5)" });
  useGsapEntrance(cardRef, { y: 30, duration: 0.6, delay: 0.2, ease: "power3.out" });

  useGSAP(
    () => {
      // Ambient floating bubbles
      gsap.to(".ambient-bubble", {
        y: "random(-20, 20)",
        x: "random(-20, 20)",
        scale: "random(0.9, 1.1)",
        duration: "random(3, 5)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.5,
      });

      // Animate steps as they change state
      gsap.fromTo(
        ".step-card",
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, stagger: 0.1, ease: "back.out(2)" }
      );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-bubble absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="ambient-bubble absolute bottom-[-180px] left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[160px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 py-10">
        <div ref={logoRef}>
          <Logo className="mb-10 h-56 w-auto drop-shadow-[0_0_40px_rgba(168,85,247,0.7)] md:h-72" />
        </div>

        <div ref={cardRef} className="w-full rounded-2xl border border-primary/20 bg-card/70 p-6 shadow-2xl backdrop-blur">
          <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Update Media Contents
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEPS.map((s) => {
              const st = statusOf(stage, s.key);
              return (
                <div
                  key={s.key}
                  className={`step-card rounded-xl border px-3 py-4 text-center transition-colors duration-500 ${
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
                <div className="mt-4 flex items-center justify-center">
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="rounded-md bg-primary px-6 py-2.5 text-sm font-bold tracking-wide text-primary-foreground shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)] transition hover:bg-primary/90 hover:scale-105"
                    >
                      Voltar ao login
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
