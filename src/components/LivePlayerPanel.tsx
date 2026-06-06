import { useRef } from "react";
import { Heart, Loader2, Maximize2, RotateCcw, Tv, Clock } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { StabilityControls } from "@/components/StabilityControls";
import { EpgPanel } from "@/components/EpgPanel";

interface Props {
  selected: M3UItem | null;
  channelIndex: number;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  settingsQuery: string;
  wrapRef?: React.RefObject<HTMLDivElement | null>;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
        active
          ? "border-amber-400/70 bg-amber-400/15 text-amber-300"
          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
      ].join(" ")}
    >
      <Icon className={`h-4 w-4 ${active ? "fill-amber-300" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function LivePlayerPanel({
  selected,
  channelIndex,
  favorites,
  onToggleFavorite,
  settingsQuery,
  wrapRef,
}: Props) {
  const localWrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const setWrapRef = (el: HTMLDivElement | null) => {
    (localWrapRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (wrapRef) (wrapRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const goFullscreen = async () => {
    const el = localWrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (e) {
      console.error("[fullscreen]", e);
    }
  };

  const {
    loading,
    error,
    bufferStatus,
    bufferTime,
    stabilityConfig,
    toggleStabilityMode,
    setQualityLevel,
    retry,
  } = useHlsPlayer(videoRef, selected);

  return (
    <section className="flex min-h-0 flex-col gap-2 sm:gap-3 overflow-hidden order-2 col-span-1 sm:col-span-auto row-start-1 sm:row-start-auto">
      <div
        ref={setWrapRef}
        onClick={goFullscreen}
        className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shrink-0"
        style={{ aspectRatio: "16/9", maxHeight: "42%" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          controlsList="nodownload"
          className="h-full w-full bg-black"
        />

        <div className="pointer-events-none absolute right-2 top-2 sm:right-3 sm:top-3 rounded-full bg-black/60 p-1.5 sm:p-2 opacity-0 ring-1 ring-white/10 transition group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
        </div>

        {selected && (loading || bufferStatus) && !error && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 grid place-items-center bg-black/70 text-white"
          >
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-center px-4">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-amber-300" />
              {bufferStatus || "Carregando canal..."}
            </div>
          </div>
        )}

        {selected && !loading && error && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-white"
          >
            <div className="max-w-md">
              <p className="text-sm">{error}</p>
              <button
                onClick={retry}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-amber-300"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!selected && (
          <div className="absolute inset-0 grid place-items-center text-white/40">
            <Tv className="h-16 w-16" strokeWidth={1.2} />
          </div>
        )}
      </div>

      {selected && (
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#140a24]/80 px-3 sm:px-4 py-2 sm:py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-amber-300">
                {channelIndex}. <span className="text-white">{selected.name}</span>
              </div>
              <div className="truncate text-xs text-white/50">{selected.group}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <ActionButton
                active={favorites.has(selected.id)}
                onClick={() => onToggleFavorite(selected.id)}
                icon={Heart}
                label="Favorite"
              />
              <ActionButton icon={Clock} label="Catch Up" />
              <ActionButton onClick={goFullscreen} icon={Maximize2} label="Tela cheia" />
            </div>
          </div>
          <StabilityControls
            enabled={stabilityConfig.enabled}
            qualityLevel={stabilityConfig.qualityLevel}
            bufferTime={bufferTime}
            onToggle={toggleStabilityMode}
            onQualityChange={setQualityLevel}
            compact
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto hidden sm:block">
        <EpgPanel streamId={selected?.streamId} settingsQuery={settingsQuery} />
      </div>
    </section>
  );
}
