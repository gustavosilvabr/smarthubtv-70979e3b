import { useState } from "react";
import { Play, X, Tv } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import type { SeriesShow } from "@/utils/parseEpisode";
import { parseEpisode } from "@/utils/parseEpisode";

interface Props {
  show: SeriesShow | null;
  onClose: () => void;
  onPlay: (item: M3UItem) => void;
}

export function SeriesModal({ show, onClose, onPlay }: Props) {
  const seasons = show ? [...show.seasons.keys()].sort((a, b) => a - b) : [];
  const [selected, setSelected] = useState<number | null>(null);
  const currentSeason = selected ?? seasons[0] ?? null;

  if (!show) return null;
  const episodes = currentSeason != null ? (show.seasons.get(currentSeason) ?? []) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-2xl flex flex-col">
        <div className="flex items-start gap-4 p-5 border-b border-border">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-secondary">
            {show.logo ? (
              <img src={show.logo} alt={show.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Tv className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold line-clamp-2">{show.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{show.group}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {seasons.length} temporada{seasons.length > 1 ? "s" : ""} · {show.episodeCount} episódios
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-secondary p-2 hover:bg-accent"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto p-3 border-b border-border">
          {seasons.map((s) => {
            const active = s === currentSeason;
            return (
              <button
                key={s}
                onClick={() => setSelected(s)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-accent"
                }`}
              >
                Temporada {s}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {episodes.map((ep) => {
            const info = parseEpisode(ep.name);
            return (
              <button
                key={ep.id}
                onClick={() => onPlay(ep)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-primary hover:bg-accent transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {info.episode}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{ep.name}</p>
                  <p className="text-xs text-muted-foreground">
                    T{info.season} · E{info.episode}
                  </p>
                </div>
                <Play className="h-5 w-5 text-primary fill-current shrink-0" />
              </button>
            );
          })}
          {episodes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum episódio nesta temporada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
