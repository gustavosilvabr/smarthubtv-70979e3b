import { Heart, Play } from "lucide-react";
import { useState } from "react";
import type { SeriesShow } from "@/utils/parseEpisode";
import { MediaFallback } from "./MediaFallback";
import { getDisplayImageUrl } from "@/utils/media";

interface Props {
  show: SeriesShow;
  isFavorite: boolean;
  onOpen: (show: SeriesShow) => void;
  onToggleFavorite: (id: string) => void;
}

export function SeriesCard({ show, isFavorite, onOpen, onToggleFavorite }: Props) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getDisplayImageUrl(show.logo);
  return (
    <div className="group relative w-40 md:w-48 shrink-0">
      <div className="aspect-[2/3] relative w-full overflow-hidden rounded-md bg-card ring-1 ring-border transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={show.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <MediaFallback title={show.name} type="series" />
        )}
        <div className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">
          {show.seasons.size}T · {show.episodeCount}EP
        </div>
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition">
          <div className="p-2 flex gap-2">
            <button
              onClick={() => onOpen(show)}
              className="flex-1 flex items-center justify-center gap-1 rounded bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Episódios
            </button>
            <button
              onClick={() => onToggleFavorite(show.id)}
              aria-label="Favorito"
              className="rounded bg-secondary p-1.5 hover:bg-accent"
            >
              <Heart
                className={`h-3.5 w-3.5 ${isFavorite ? "fill-primary text-primary" : "text-foreground"}`}
              />
            </button>
          </div>
        </div>
        {isFavorite && (
          <div className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1">
            <Heart className="h-3 w-3 fill-primary text-primary" />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground">{show.name}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{show.group}</p>
    </div>
  );
}
