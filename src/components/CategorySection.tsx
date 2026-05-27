import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { ContentCard } from "./ContentCard";

interface Props {
  title: string;
  items: M3UItem[];
  favorites: Set<string>;
  onPlay: (item: M3UItem) => void;
  onToggleFavorite: (id: string) => void;
}

export function CategorySection({ title, items, favorites, onPlay, onToggleFavorite }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-lg md:text-xl font-bold text-foreground">
          {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        </h3>
        <div className="hidden md:flex gap-1">
          <button onClick={() => scroll(-1)} className="rounded-full bg-secondary p-1.5 hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} className="rounded-full bg-secondary p-1.5 hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {items.slice(0, 60).map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            isFavorite={favorites.has(item.id)}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
