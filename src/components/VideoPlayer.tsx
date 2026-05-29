import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { Loader2, PictureInPicture2, RotateCcw, X } from "lucide-react";
import type { M3UItem } from "@/types/iptv";

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

  useEffect(() => {
    if (!item || !videoRef.current) return;
    const video = videoRef.current;
    const src = proxied(item.url);
    const isHls = /\.m3u8(\?|$)/i.test(item.url) || item.url.includes("m3u8");
    const isLive = item.type === "live";
    const isTs = /\.ts(\?|$)/i.test(item.url) || isLive;

    // teardown previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (isTs && mpegts.isSupported()) {
      const player = mpegts.createPlayer(
        { type: "mpegts", isLive, url: src, cors: true },
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
      });
      player.attachMediaElement(video);
      player.load();
      Promise.resolve(player.play()).catch((e: unknown) => console.error("[mpegts] play", e));
    } else {
      video.src = src;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [item]);

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
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-border">
          <video ref={videoRef} controls autoPlay playsInline className="h-full w-full" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{item.group}</p>
      </div>
    </div>
  );
}
