import { useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import type mpegtsType from "mpegts.js";
import { Loader2, PictureInPicture2, RotateCcw, X } from "lucide-react";
import type { M3UItem } from "@/types/iptv";

type Hls = HlsType;
type MpegtsPlayer = ReturnType<typeof mpegtsType.createPlayer>;

interface Props {
  item: M3UItem | null;
  onClose: () => void;
}

function proxied(url: string) {
  // If page is https and url is http, proxy it. Also helps with CORS for HLS.
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

export function VideoPlayer({ item, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
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
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!item || !videoRef.current) return;

    const video = videoRef.current;
    const streamUrl = proxied(item.url);
    const fallbackUrl = item.fallbackUrl ? proxied(item.fallbackUrl) : undefined;
    const isLive = item.type === "live";
    let disposed = false;

    const startTimeout = () => {
      clearLoadTimeout();
      timeoutRef.current = setTimeout(() => {
        if (disposed) return;
        if (fallbackUrl && !fallbackAttemptedRef.current) {
          console.warn("[live] timeout no HLS, tentando fallback TS", fallbackUrl);
          playTs(fallbackUrl);
          return;
        }
        setLoading(false);
        setError(
          "Não foi possível reproduzir este canal. Este canal pode estar bloqueado por CORS no navegador. Tente usar proxy backend ou servidor com headers liberados.",
        );
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

    const playNative = (url: string) => {
      resetVideo();
      startTimeout();
      console.info("[live] URL final do canal", url);
      video.src = url;
      video.load();
      video.play().catch(showClickToPlay);
    };

    function playTs(url: string) {
      fallbackAttemptedRef.current = true;
      resetVideo();
      startTimeout();
      console.info("[live] URL final do canal", url);

      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer(
          { type: "mpegts", isLive, url, cors: true },
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
        player.on(mpegts.Events.ERROR, (type, detail, info) => {
          console.error("[mpegts] error", type, detail, info);
          clearLoadTimeout();
          setLoading(false);
          setError(
            "Erro ao carregar o canal. Este canal pode estar bloqueado por CORS no navegador. Tente usar proxy backend ou servidor com headers liberados.",
          );
        });
        player.attachMediaElement(video);
        player.load();
        Promise.resolve(player.play()).catch(showClickToPlay);
      } else {
        playNative(url);
      }
    }

    const tryFallback = () => {
      if (fallbackUrl && !fallbackAttemptedRef.current) {
        console.warn("[live] HLS falhou, tentando fallback TS", fallbackUrl);
        playTs(fallbackUrl);
      } else {
        clearLoadTimeout();
        setLoading(false);
        setError(
          "Erro ao carregar o canal. Este canal pode estar bloqueado por CORS no navegador. Tente usar proxy backend ou servidor com headers liberados.",
        );
      }
    };

    const playWithHls = (url: string) => {
      resetVideo();
      startTimeout();
      console.info("[live] URL final do canal", url);

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
      hls.on(Hls.Events.ERROR, (_, data) => {
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
    };

    setLoading(true);
    setError("");
    fallbackAttemptedRef.current = false;
    video.onplaying = markPlaying;
    video.onerror = tryFallback;

    if (/\.m3u8(\?|$)/i.test(streamUrl) || streamUrl.includes("m3u8")) {
      if (Hls.isSupported()) playWithHls(streamUrl);
      else if (video.canPlayType("application/vnd.apple.mpegurl")) playNative(streamUrl);
      else if (fallbackUrl) playTs(fallbackUrl);
      else {
        setLoading(false);
        setError("Este navegador não suporta HLS.");
      }
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
  }, [item, attempt, clearLoadTimeout, destroyPlayers]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in">
      <div className="relative w-full max-w-6xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg md:text-xl font-semibold text-foreground line-clamp-1">
            {item.name}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const v = videoRef.current;
                if (!v) return;
                try {
                  const doc = document as Document & { pictureInPictureElement?: Element | null };
                  if (doc.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                  } else if (typeof v.requestPictureInPicture === "function") {
                    await v.requestPictureInPicture();
                  }
                } catch (e) {
                  console.error("[pip]", e);
                }
              }}
              className="rounded-full bg-secondary p-2 hover:bg-accent transition"
              aria-label="Picture in Picture"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-secondary p-2 hover:bg-accent transition"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-border">
          <video ref={videoRef} controls autoPlay playsInline className="h-full w-full" />
          {loading && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-20 flex items-center justify-center bg-background/80 text-foreground">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando canal...
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-30 flex items-center justify-center bg-background/90 p-6 text-center text-foreground">
              <div className="max-w-lg">
                <p className="text-sm md:text-base">{error}</p>
                <button
                  onClick={() => setAttempt((n) => n + 1)}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <RotateCcw className="h-4 w-4" />
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{item.group}</p>
      </div>
    </div>
  );
}
