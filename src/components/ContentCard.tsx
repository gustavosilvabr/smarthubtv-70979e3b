import { Heart, Play, Tv } from "lucide-react";
import { useState } from "react";
import type { M3UItem } from "@/types/iptv";

interface Props {
  item: M3UItem;
  isFavorite: boolean;
  onPlay: (item: M3UItem) => void;
  onToggleFavorite: (id: string) => void;
}

export function ContentCard({ item, isFavorite, onPlay, onToggleFavorite }: Props) {
  const [imgError, setImgError] = useState(false);
  const aspect = item.type === "live" ? "aspect-video" : "aspect-[2/3]";

  return (
    <div className="group relative w-40 md:w-48 shrink-0">
      <div
        className={`${aspect} relative w-full overflow-hidden rounded-md bg-card ring-1 ring-border transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary`}
      >
        {item.logo && !imgError ? (
          <img
            src={item.logo}
            alt={item.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-secondary">
            <Tv className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition">
          <div className="p-2 flex gap-2">
            <button
              onClick={() => onPlay(item)}
              className="flex-1 flex items-center justify-center gap-1 rounded bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Assistir
            </button>
            <button
              onClick={() => onToggleFavorite(item.id)}
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
      <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground">{item.name}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{item.group}</p>
    </div>
  );
}
