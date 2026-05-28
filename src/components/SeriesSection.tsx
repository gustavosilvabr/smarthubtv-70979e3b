import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SeriesShow } from "@/utils/parseEpisode";
import { SeriesCard } from "./SeriesCard";

interface Props {
  title: string;
  shows: SeriesShow[];
  favorites: Set<string>;
  onOpen: (show: SeriesShow) => void;
  onToggleFavorite: (id: string) => void;
}

export function SeriesSection({ title, shows, favorites, onOpen, onToggleFavorite }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  if (!shows.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-lg md:text-xl font-bold text-foreground">
          {title}{" "}
          <span className="text-sm font-normal text-muted-foreground">({shows.length})</span>
        </h3>
        <div className="hidden md:flex gap-1">
          <button
            onClick={() => scroll(-1)}
            className="rounded-full bg-secondary p-1.5 hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="rounded-full bg-secondary p-1.5 hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {shows.slice(0, 60).map((s) => (
          <SeriesCard
            key={s.id}
            show={s}
            isFavorite={favorites.has(s.id)}
            onOpen={onOpen}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
