import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { runOptimization, applyOptimization } from "@/utils/optimizationEngine";

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OptimizationModal({ isOpen, onClose }: OptimizationModalProps) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Preparando otimização...");
  const [isComplete, setIsComplete] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const startOptimization = async () => {
      setIsRunning(true);
      setProgress(0);
      setMessage("Preparando otimização...");
      setIsComplete(false);

      try {
        await runOptimization((step, total, msg) => {
          setMessage(msg);
          setProgress(Math.floor((step / total) * 100));
        });

        applyOptimization();
        setIsComplete(true);
        setProgress(100);
        setMessage("Otimização concluída!");

        setTimeout(() => {
          onClose();
          setIsRunning(false);
        }, 2000);
      } catch (error) {
        console.error("Erro durante otimização:", error);
        setMessage("Erro durante otimização. Tente novamente.");
        setIsRunning(false);
      }
    };

    startOptimization();
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-400/30 shadow-2xl p-8 space-y-6">
        {/* Disable interactions */}
        <div className="absolute inset-0 rounded-2xl cursor-not-allowed" />

        {/* Content */}
        <div className="relative z-10 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {isComplete ? (
                <CheckCircle2 className="h-16 w-16 text-emerald-400 animate-pulse" />
              ) : (
                <Loader2 className="h-16 w-16 text-amber-300 animate-spin" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">
              {isComplete ? "Pronto!" : "Otimizando Canais"}
            </h2>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden border border-amber-400/20">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-amber-300">{progress}%</span>
            </div>
          </div>

          {/* Message */}
          <div className="text-center">
            <p className="text-white/90 text-sm md:text-base font-medium h-6">
              {message}
            </p>
          </div>

          {/* Steps Info */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2 border border-slate-700/50">
            <p className="text-xs text-white/60 font-semibold uppercase tracking-wider">
              Etapas da Otimização:
            </p>
            <ul className="text-xs text-white/70 space-y-1">
              <li className={progress >= 12 ? "text-emerald-400" : ""}>
                ✓ Analisando canais
              </li>
              <li className={progress >= 25 ? "text-emerald-400" : ""}>
                ✓ Otimizando qualidade
              </li>
              <li className={progress >= 37 ? "text-emerald-400" : ""}>
                ✓ Configurando cache
              </li>
              <li className={progress >= 50 ? "text-emerald-400" : ""}>
                ✓ Melhorando buffer
              </li>
              <li className={progress >= 62 ? "text-emerald-400" : ""}>
                ✓ Sincronizando config
              </li>
              <li className={progress >= 75 ? "text-emerald-400" : ""}>
                ✓ Limpando dados
              </li>
              <li className={progress >= 87 ? "text-emerald-400" : ""}>
                ✓ Aplicando otimizações
              </li>
            </ul>
          </div>

          {/* Status */}
          {!isRunning && isComplete && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
              <p className="text-emerald-400 font-semibold text-sm">
                ✓ Canais otimizados com sucesso!
              </p>
              <p className="text-white/60 text-xs mt-1">
                Reprodução mais rápida e fluida
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
