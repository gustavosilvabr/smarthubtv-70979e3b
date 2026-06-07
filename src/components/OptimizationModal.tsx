import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { applyOptimization, runOptimization } from "@/utils/optimizationEngine";

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = ["Qualidade automatica", "Buffer estavel", "Reconexao continua", "Preferencia salva"];

export function OptimizationModal({ isOpen, onClose }: OptimizationModalProps) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Preparando otimizacao...");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    setProgress(0);
    setMessage("Preparando otimizacao...");
    setIsComplete(false);

    runOptimization((step, total, nextMessage) => {
      if (cancelled) return;
      setMessage(nextMessage);
      setProgress(Math.floor((step / total) * 100));
    })
      .then(() => {
        if (cancelled) return;
        applyOptimization();
        setProgress(100);
        setIsComplete(true);
        setMessage("Modo estabilidade ativado. Os canais serao carregados com menos travamentos.");
        closeTimer = setTimeout(onClose, 2200);
      })
      .catch((error) => {
        console.error("Erro durante otimizacao:", error);
        if (!cancelled) setMessage("Nao foi possivel ativar o modo estabilidade.");
      });

    return () => {
      cancelled = true;
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 p-6 shadow-2xl sm:p-8"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          {isComplete ? (
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
          ) : (
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-amber-300" />
          )}
          <h2 className="mt-4 text-2xl font-bold text-white">
            {isComplete ? "Estabilidade ativada" : "Otimizando canais"}
          </h2>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-4 min-h-12 text-center text-sm font-medium text-white/85">{message}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {STEPS.map((step, index) => {
            const completed = progress >= ((index + 1) / STEPS.length) * 100;
            return (
              <div
                key={step}
                className={[
                  "rounded-lg border px-3 py-2 text-xs",
                  completed
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/45",
                ].join(" ")}
              >
                {completed ? "Ativo: " : ""}
                {step}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
