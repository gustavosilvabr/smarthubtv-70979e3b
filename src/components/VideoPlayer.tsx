import { useRef, useState } from "react";
import { Loader2, PictureInPicture2, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { StabilityControls } from "@/components/StabilityControls";

interface Props {
  item: M3UItem | null;
  onClose: () => void;
}

export function VideoPlayer({ item, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const {
    loading,
    error,
    bufferStatus,
    bufferTime,
    stabilityConfig,
    toggleStabilityMode,
    setQualityLevel,
    retry,
  } = useHlsPlayer(videoRef, item);

  if (!item) return null;

  const statusMessage = bufferStatus || (loading ? "Carregando canal..." : "");

  async function handlePictureInPicture() {
    const video = videoRef.current;
    if (!video) return;

    try {
      const doc = document as Document & {
        pictureInPictureElement?: Element | null;
      };

      if (doc.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      if (typeof video.requestPictureInPicture === "function") {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error("[PictureInPicture]", err);
    }
  }

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
          <h2 className="line-clamp-1 text-sm font-semibold text-foreground sm:text-base md:text-lg">
            {item.name}
          </h2>

          <div className="flex shrink-0 gap-1 sm:gap-2">
            <button
              onClick={handlePictureInPicture}
              className="rounded-full bg-secondary p-1.5 transition hover:bg-accent sm:p-2"
              aria-label="Picture in Picture"
              title="Picture in Picture"
              type="button"
            >
              <PictureInPicture2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <button
              onClick={onClose}
              className="rounded-full bg-secondary p-1.5 transition hover:bg-accent sm:p-2"
              aria-label="Fechar"
              title="Fechar"
              type="button"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-border">
          <video
            ref={videoRef}
            controls
            autoPlay
            muted={muted}
            playsInline
            controlsList="nodownload"
            className="h-full w-full"
          />

          <button
            type="button"
            onClick={toggleSound}
            className="absolute left-2 top-2 z-40 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-black/90"
            aria-label={muted ? "Ativar som" : "Desativar som"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{muted ? "Ativar som" : "Som ativo"}</span>
          </button>

          {statusMessage && !error && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-20 flex items-center justify-center bg-background/80 text-foreground">
              <div className="flex items-center gap-2 text-xs font-medium sm:text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary sm:h-5 sm:w-5" />
                {statusMessage}
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-30 flex items-center justify-center bg-background/90 p-3 text-center text-foreground sm:p-6">
              <div className="max-w-lg">
                <p className="text-xs sm:text-sm md:text-base">{error}</p>

                <button
                  onClick={retry}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:mt-4 sm:px-4 sm:py-2 sm:text-sm"
                  type="button"
                >
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>

        <StabilityControls
          enabled={stabilityConfig.enabled}
          qualityLevel={stabilityConfig.qualityLevel}
          bufferTime={bufferTime}
          onToggle={toggleStabilityMode}
          onQualityChange={setQualityLevel}
        />

        <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground sm:mt-2">{item.group}</p>
      </div>
    </div>
  );
}
