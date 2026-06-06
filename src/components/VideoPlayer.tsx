import { useRef } from "react";
import { Loader2, PictureInPicture2, RotateCcw, X } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { StabilityControls } from "@/components/StabilityControls";

interface Props {
  item: M3UItem | null;
  onClose: () => void;
}

export function VideoPlayer({ item, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold text-foreground line-clamp-1">
            {item.name}
          </h2>
          <div className="flex gap-1 sm:gap-2 shrink-0">
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
              className="rounded-full bg-secondary p-1.5 sm:p-2 hover:bg-accent transition"
              aria-label="Picture in Picture"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-secondary p-1.5 sm:p-2 hover:bg-accent transition"
              aria-label="Fechar"
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
            playsInline
            controlsList="nodownload"
            className="h-full w-full"
          />
          {statusMessage && !error && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-20 flex items-center justify-center bg-background/80 text-foreground">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary" />
                {statusMessage}
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-0 bottom-4 top-12 z-30 flex items-center justify-center bg-background/90 p-3 sm:p-6 text-center text-foreground">
              <div className="max-w-lg">
                <p className="text-xs sm:text-sm md:text-base">{error}</p>
                <button
                  onClick={retry}
                  className="mt-3 sm:mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
        <p className="mt-1.5 sm:mt-2 text-xs text-muted-foreground line-clamp-1">{item.group}</p>
      </div>
    </div>
  );
}
