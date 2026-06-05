import { useCallback, useEffect, useRef, useState } from "react";
import type { M3UItem } from "@/types/iptv";

/**
 * PRODUÇÃO-READY: Anti-Freezing HLS Player Hook
 *
 * Baseado em best practices reais de HLS:
 * - Segment duration: 6-10 segundos (Apple HLS spec)
 * - Buffer adequado: 30-60 segundos (não causa latência, evita travamento)
 * - Network resilience: Múltiplos retry strategies
 * - Heartbeat monitoring: Detecção de stall em tempo real
 * - Fallback URLs: Redundância automática
 */

// ─── Constants Tuned for Zero Freezing ──────────────────────────────────────

/** Target buffer time (30-45s é ideal para zero travamento) */
const TARGET_BUFFER_S = 40;

/** Buffer máximo antes de pausar download (evita memória) */
const MAX_BUFFER_S = 60;

/** Buffer mínimo antes de começar reprodução */
const MIN_BUFFER_S = 8;

/** Timeout para cada segmento */
const SEGMENT_TIMEOUT_MS = 12000;

/** Timeout para playlist */
const PLAYLIST_TIMEOUT_MS = 8000;

/** Intervalo de heartbeat (detecta travamento) */
const HEARTBEAT_INTERVAL_MS = 2000;

/** Tempo máximo de stall tolerado */
const MAX_STALL_TIME_MS = 8000;

/** Tentativas de reconexão */
const RECONNECT_MAX_ATTEMPTS = 10;

/** Delay base para exponential backoff */
const RECONNECT_BASE_DELAY_MS = 1000;

interface HlsConfig {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  backBufferLength: number;
  fragLoadingTimeOut: number;
  manifestLoadingTimeOut: number;
  levelLoadingTimeOut: number;
  fragLoadingMaxRetry: number;
  manifestLoadingMaxRetry: number;
  levelLoadingMaxRetry: number;
  fragLoadingMaxRetryTimeout: number;
  enableWorker: boolean;
  lowLatencyMode: boolean;
  liveSyncDurationCount: number;
  liveMaxLatencyDurationCount: number;
}

function buildOptimalHlsConfig(): HlsConfig {
  return {
    // Buffer Strategy: Manter 30-45s (ideal para live sem travamento)
    maxBufferLength: 45,
    maxMaxBufferLength: 60,
    backBufferLength: 30,

    // Timeouts: Agressivos mas com retry
    fragLoadingTimeOut: SEGMENT_TIMEOUT_MS,
    manifestLoadingTimeOut: PLAYLIST_TIMEOUT_MS,
    levelLoadingTimeOut: PLAYLIST_TIMEOUT_MS,

    // Retry Strategy: Múltiplas tentativas
    fragLoadingMaxRetry: 6,
    manifestLoadingMaxRetry: 6,
    levelLoadingMaxRetry: 6,

    // Fast abort on stall
    fragLoadingMaxRetryTimeout: 8000,

    // Processamento
    enableWorker: true,
    lowLatencyMode: false, // Disabled para estabilidade

    // Live Edge: Não muito agressivo
    liveSyncDurationCount: 4,
    liveMaxLatencyDurationCount: 12,
  };
}

export interface UseHlsPlayerResult {
  loading: boolean;
  error: string;
  isStalled: boolean;
  bufferHealth: number; // 0-1
  retry: () => void;
  switchToFallback: () => void;
}

export function useProductionHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  item: M3UItem | null
): UseHlsPlayerResult {
  const hlsRef = useRef<any>(null);
  const reconnectCountRef = useRef(0);
  const lastPlaybackTimeRef = useRef(0);
  const stalledSinceRef = useRef<number | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const disposedRef = useRef(false);
  const usingFallbackRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isStalled, setIsStalled] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // ─── Heartbeat Monitor: Detecta travamento em tempo real ───────────────────

  const startHeartbeat = useCallback((video: HTMLVideoElement) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    heartbeatRef.current = setInterval(() => {
      if (disposedRef.current || video.paused || video.ended) return;

      const currentTime = video.currentTime;
      const now = Date.now();

      // Detectar se progrediu desde o last check
      if (currentTime === lastPlaybackTimeRef.current) {
        // Tempo parado
        if (stalledSinceRef.current === null) {
          stalledSinceRef.current = now;
          setIsStalled(true);
        } else {
          const stallDuration = now - stalledSinceRef.current;
          if (stallDuration > MAX_STALL_TIME_MS) {
            console.warn(`[HLS] Stall detected for ${stallDuration}ms, attempting recovery`);
            // Attempt recovery: seek to current + 0.5s
            try {
              video.currentTime = currentTime + 0.5;
            } catch (e) {
              console.error("[HLS] Seek failed:", e);
            }
            stalledSinceRef.current = now;
          }
        }
      } else {
        // Progredindo normalmente
        stalledSinceRef.current = null;
        setIsStalled(false);
      }

      lastPlaybackTimeRef.current = currentTime;

      // Monitor buffer health
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferAhead = bufferedEnd - currentTime;
        const health = Math.min(1, bufferAhead / TARGET_BUFFER_S);
        setBufferHealth(health);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);

  // ─── Network Error Handling with Exponential Backoff ──────────────────────

  const reconnect = useCallback(async (useFallback = false) => {
    if (reconnectCountRef.current >= RECONNECT_MAX_ATTEMPTS) {
      setError("Impossível reconectar. Tente outro canal.");
      return;
    }

    reconnectCountRef.current++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(1.5, reconnectCountRef.current);

    console.log(`[HLS] Reconectando em ${Math.round(delay)}ms (tentativa ${reconnectCountRef.current})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    if (!disposedRef.current) {
      if (useFallback && item?.fallbackUrl && !usingFallbackRef.current) {
        usingFallbackRef.current = true;
        console.log("[HLS] Usando URL de fallback");
      }
      setAttempt(a => a + 1);
    }
  }, [item?.fallbackUrl]);

  // ─── Main HLS Setup ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

    const video = videoRef.current;
    const streamUrl = usingFallbackRef.current ? item.fallbackUrl : item.url;
    if (!streamUrl) return;

    let active = true;
    disposedRef.current = false;

    const setupHls = async () => {
      try {
        setLoading(true);
        setError("");

        // Importar HLS.js
        const mod = await import("hls.js");
        const Hls = mod.default;

        if (!active) return;

        // Verificar suporte
        if (!Hls.isSupported()) {
          console.log("[HLS] HLS.js not supported, trying native playback");
          video.src = streamUrl;
          video.play().catch(e => {
            console.error("[HLS] Native playback failed:", e);
            reconnect(true);
          });
          return;
        }

        // Criar player HLS
        const config = buildOptimalHlsConfig();
        const hls = new Hls(config);
        hlsRef.current = hls;

        // Handlers
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (active) {
            console.log("[HLS] Manifest loaded, starting playback");
            video.play().catch(e => {
              console.warn("[HLS] Play failed:", e);
              reconnect();
            });
          }
        });

        hls.on(Hls.Events.ERROR, (event: string, data: any) => {
          if (!active) return;

          console.error("[HLS] Error:", data.type, data.details);

          if (!data.fatal) {
            console.warn("[HLS] Non-fatal error, continuing");
            return;
          }

          // Fatal error
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.error("[HLS] Network error, attempting reconnect");
            reconnect(false);
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.error("[HLS] Media error, trying to recover");
            try {
              hls.recoverMediaError();
            } catch (e) {
              reconnect(true);
            }
            return;
          }

          // Unknown fatal error
          setError(`Erro no stream: ${data.details}`);
          reconnect(true);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event: string, data: any) => {
          // Reset reconnect counter on successful load
          if (data.frag && data.frag.loaded > 0) {
            reconnectCountRef.current = 0;
          }
        });

        // Load stream
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        // Start heartbeat
        startHeartbeat(video);

        setLoading(false);
      } catch (e) {
        if (active) {
          console.error("[HLS] Setup failed:", e);
          setError(`Erro ao carregar: ${e instanceof Error ? e.message : "Desconhecido"}`);
          reconnect(true);
        }
      }
    };

    setupHls();

    return () => {
      active = false;
      disposedRef.current = true;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
      video.pause();
      video.src = "";
    };
  }, [item, attempt, startHeartbeat, reconnect]);

  const handleRetry = useCallback(() => {
    reconnectCountRef.current = 0;
    usingFallbackRef.current = false;
    setAttempt(a => a + 1);
  }, []);

  const handleSwitchFallback = useCallback(() => {
    if (!item?.fallbackUrl) {
      setError("Nenhuma URL alternativa disponível");
      return;
    }
    reconnect(true);
  }, [item?.fallbackUrl, reconnect]);

  return {
    loading,
    error,
    isStalled,
    bufferHealth,
    retry: handleRetry,
    switchToFallback: handleSwitchFallback,
  };
}
