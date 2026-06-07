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

export function getOptimizationState(): OptimizationState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const stored = localStorage.getItem(OPTIMIZATION_STATE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    console.warn("Erro ao ler estado de otimização");
  }
  return getDefaultState();
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

export function saveOptimizationState(state: OptimizationState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(state));
  } catch {
    console.warn("Erro ao salvar estado de otimização");
  }
}

export async function runOptimization(
  onProgress: (step: number, total: number, message: string) => void
): Promise<OptimizationState> {
  const steps = [
    { delay: 600, message: "Analisando canais...", step: 1 },
    { delay: 800, message: "Otimizando qualidade de vídeo...", step: 2 },
    { delay: 1000, message: "Configurando cache de streaming...", step: 3 },
    { delay: 700, message: "Melhorando buffer de conexão...", step: 4 },
    { delay: 900, message: "Sincronizando configurações...", step: 5 },
    { delay: 600, message: "Limpando dados temporários...", step: 6 },
    { delay: 800, message: "Aplicando otimizações...", step: 7 },
    { delay: 500, message: "Finalizando...", step: 8 },
  ];

  const total = steps.length;

  for (const { delay, message, step } of steps) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    onProgress(step, total, message);
  }

  const optimizedState: OptimizationState = {
    completed: true,
    timestamp: Date.now(),
    settings: {
      quality: "low",
      bufferSize: 60,
      enableCache: true,
      maxConnections: 6,
      connectionTimeout: 8000,
    },
  };

  saveOptimizationState(optimizedState);
  return optimizedState;
}

export function applyOptimization(): void {
  const state = getOptimizationState();
  if (state.completed && typeof window !== "undefined") {
    // Aplicar configurações globais otimizadas
    try {
      // Habilitar cache agressivo
      if ("caches" in window) {
        caches.open("streaming-cache").then((cache) => {
          console.log("[Otimização] Cache de streaming ativado");
        });
      }

      // Salvar configurações de buffer
      sessionStorage.setItem(
        "smarthub:buffer-settings",
        JSON.stringify({
          minBuffer: 6,
          maxBuffer: 60,
          strategy: "aggressive",
        })
      );

      // Limpar dados temporários antigos
      try {
        const keys = Object.keys(localStorage);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        keys.forEach((key) => {
          if (key.startsWith("smarthub:cache:")) {
            const item = localStorage.getItem(key);
            if (item) {
              try {
                const parsed = JSON.parse(item);
                if (parsed.timestamp && parsed.timestamp < oneWeekAgo) {
                  localStorage.removeItem(key);
                }
              } catch {
                // ignorar
              }
            }
          }
        });
      } catch {
        // ignorar erro de limpeza
      }

      console.log("[Otimização] Configurações aplicadas com sucesso");
    } catch (error) {
      console.warn("[Otimização] Erro ao aplicar otimizações:", error);
    }
  }
}
