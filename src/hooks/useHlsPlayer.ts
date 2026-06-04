import { useCallback, useEffect, useRef, useState } from "react";
import type { M3UItem } from "@/types/iptv";

function proxied(url: string) {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("http:")
  ) {
    return `/api/stream?u=${encodeURIComponent(url)}`;
  }
  return url;
}

const LOAD_TIMEOUT_MS = 20_000;

export interface UseHlsPlayerResult {
  loading: boolean;
  error: string;
  retry: () => void;
}

/**
 * Attach an HLS / mpegts player to a <video> element for the given item.
 * Mirrors VideoPlayer's loading logic but as a reusable hook for inline players.
 */
export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  item: M3UItem | null,
): UseHlsPlayerResult {
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const destroyPlayers = useCallback(() => {
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try { mpegtsRef.current.destroy(); } catch {}
      mpegtsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!item || !videoRef.current) return;
    if (typeof window === "undefined") return;

    const video = videoRef.current;
    const streamUrl = proxied(item.url);
    const fallbackUrl = item.fallbackUrl ? proxied(item.fallbackUrl) : undefined;
    const isLive = item.type === "live";
    let disposed = false;

    const startTimeout = (onTimeout: () => void) => {
      clearLoadTimeout();
      timeoutRef.current = setTimeout(() => {
        if (disposed) return;
        onTimeout();
      }, LOAD_TIMEOUT_MS);
    };

    const resetVideo = () => {
      destroyPlayers();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const markPlaying = () => {
      clearLoadTimeout();
      setLoading(false);
      setError("");
    };

    const showClickToPlay = () => {
      clearLoadTimeout();
      setLoading(false);
      setError("Clique no play para iniciar o canal.");
    };

    const showError = (msg: string) => {
      clearLoadTimeout();
      setLoading(false);
      setError(msg);
    };

    const playNative = (url: string) => {
      resetVideo();
      startTimeout(() => showError("Não foi possível reproduzir este canal."));
      video.src = url;
      video.load();
      video.play().catch(showClickToPlay);
    };

    const playTs = async (url: string) => {
      fallbackAttemptedRef.current = true;
      resetVideo();
      try {
        const mod = await import("mpegts.js");
        if (disposed) return;
        const mpegts = mod.default;
        startTimeout(() =>
          showError("Não foi possível reproduzir este canal. Pode estar bloqueado por CORS."),
        );
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url, cors: true } as any,
            {
              enableWorker: false,
              enableStashBuffer: !isLive,
              stashInitialSize: 128,
              isLive,
              liveBufferLatencyChasing: isLive,
              lazyLoad: false,
              autoCleanupSourceBuffer: isLive,
            },
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, (type: any, detail: any, info: any) => {
            console.error("[mpegts] error", type, detail, info);
            showError("Erro ao carregar o canal. Pode estar bloqueado por CORS.");
          });
          player.attachMediaElement(video);
          player.load();
          Promise.resolve(player.play()).catch(showClickToPlay);
        } else {
          playNative(url);
        }
      } catch (e) {
        console.error("mpegts load failed", e);
        playNative(url);
      }
    };

    const tryFallback = () => {
      if (fallbackUrl && !fallbackAttemptedRef.current) {
        playTs(fallbackUrl);
      } else {
        showError("Erro ao carregar o canal. Pode estar bloqueado por CORS no navegador.");
      }
    };

    const playWithHls = async (url: string) => {
      resetVideo();
      try {
        const mod = await import("hls.js");
        if (disposed) return;
        const Hls = mod.default;
        startTimeout(tryFallback);
        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            playNative(url);
          } else if (fallbackUrl) {
            playTs(fallbackUrl);
          } else {
            showError("Este navegador não suporta HLS.");
          }
          return;
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          liveSyncDurationCount: 3,
          manifestLoadingTimeOut: 15000,
          levelLoadingTimeOut: 15000,
          fragLoadingTimeOut: 20000,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(showClickToPlay);
        });
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          console.error("HLS ERROR:", data);
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          tryFallback();
        });
      } catch (e) {
        console.error("hls.js load failed", e);
        tryFallback();
      }
    };

    setLoading(true);
    setError("");
    fallbackAttemptedRef.current = false;
    video.onplaying = markPlaying;
    video.onerror = tryFallback;

    if (/\.m3u8(\?|$)/i.test(streamUrl) || streamUrl.includes("m3u8")) {
      playWithHls(streamUrl);
    } else if (/\.ts(\?|$)/i.test(streamUrl) || isLive) {
      playTs(streamUrl);
    } else {
      playNative(streamUrl);
    }

    return () => {
      disposed = true;
      clearLoadTimeout();
      destroyPlayers();
      video.onplaying = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [item, attempt, clearLoadTimeout, destroyPlayers, videoRef]);

  return {
    loading,
    error,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
