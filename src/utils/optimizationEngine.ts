import { setStabilityConfig } from "@/utils/stabilityMode";

const OPTIMIZATION_STATE_KEY = "smarthub:optimization-state";

export interface OptimizationState {
  completed: boolean;
  timestamp: number;
  settings: {
    quality: "low" | "medium" | "high";
    bufferSize: number;
    enableCache: boolean;
    maxConnections: number;
    connectionTimeout: number;
  };
}

function getDefaultState(): OptimizationState {
  return {
    completed: false,
    timestamp: 0,
    settings: {
      quality: "high",
      bufferSize: 30,
      enableCache: false,
      maxConnections: 3,
      connectionTimeout: 10000,
    },
  };
}

export function getOptimizationState(): OptimizationState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const stored = localStorage.getItem(OPTIMIZATION_STATE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    console.warn("Erro ao ler estado de otimizacao");
  }
  return getDefaultState();
}

export function saveOptimizationState(state: OptimizationState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(state));
  } catch {
    console.warn("Erro ao salvar estado de otimizacao");
  }
}

export async function runOptimization(
  onProgress: (step: number, total: number, message: string) => void,
): Promise<OptimizationState> {
  const steps = [
    { delay: 200, message: "Ativando qualidade automatica...", step: 1 },
    { delay: 250, message: "Configurando buffer estavel...", step: 2 },
    { delay: 250, message: "Ativando reconexao automatica...", step: 3 },
    { delay: 200, message: "Finalizando...", step: 4 },
  ];

  for (const { delay, message, step } of steps) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    onProgress(step, steps.length, message);
  }

  const optimizedState: OptimizationState = {
    completed: true,
    timestamp: Date.now(),
    settings: {
      quality: "low",
      bufferSize: 60,
      enableCache: false,
      maxConnections: 6,
      connectionTimeout: 25000,
    },
  };

  saveOptimizationState(optimizedState);
  return optimizedState;
}

export function applyOptimization(): void {
  const state = getOptimizationState();
  if (!state.completed || typeof window === "undefined") return;

  try {
    setStabilityConfig({ enabled: true, qualityLevel: "auto" });
    sessionStorage.setItem(
      "smarthub:buffer-settings",
      JSON.stringify({
        minBuffer: 6,
        maxBuffer: 60,
        strategy: "stable",
      }),
    );
  } catch (error) {
    console.warn("[Otimizacao] Erro ao aplicar configuracoes:", error);
  }
}
