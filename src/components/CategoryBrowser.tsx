import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { ContentCard } from "./ContentCard";
import { SeriesCard } from "./SeriesCard";
import { groupSeries, type SeriesShow } from "@/utils/parseEpisode";

interface Props {
  items: M3UItem[];
  mode: "live" | "movie" | "series" | "favorites";
  favorites: Set<string>;
  onPlay: (item: M3UItem) => void;
  onOpenShow: (show: SeriesShow) => void;
  onToggleFavorite: (id: string) => void;
}

export function CategoryBrowser({
  items,
  mode,
  favorites,
  onPlay,
  onOpenShow,
  onToggleFavorite,
}: Props) {
  const [catSearch, setCatSearch] = useState("");
  const [selected, setSelected] = useState<string>("__all__");

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.group, (map.get(it.group) || 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  useEffect(() => {
    if (selected !== "__all__" && !categories.some((c) => c.name === selected)) {
      setSelected("__all__");
    }
  }, [categories, selected]);

  const visibleItems = useMemo(() => {
    if (selected === "__all__") return items;
    return items.filter((i) => i.group === selected);
  }, [items, selected]);

  const seriesShows = useMemo(() => {
    if (mode !== "series") return [];
    return groupSeries(visibleItems);
  }, [visibleItems, mode]);

  const totalCount = items.length;

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Categories sidebar */}
      <aside className="w-64 shrink-0 flex flex-col rounded-lg border border-border bg-card/40 overflow-hidden">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              placeholder="Buscar categorias"
              className="w-full rounded-md bg-secondary pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <CategoryRow
            label="ALL"
            count={totalCount}
            active={selected === "__all__"}
            onClick={() => setSelected("__all__")}
          />
          {filteredCats.map((c) => (
            <CategoryRow
              key={c.name}
              label={c.name}
              count={c.count}
              active={selected === c.name}
              onClick={() => setSelected(c.name)}
            />
          ))}
          {filteredCats.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Nenhuma categoria</div>
          )}
        </div>
      </aside>

      {/* Items grid */}
      <div className="flex-1 min-w-0 overflow-y-auto pr-1">
        {visibleItems.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            Nenhum conteúdo nesta categoria.
          </div>
        ) : mode === "series" ? (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {seriesShows.map((s) => (
              <div key={s.id} className="w-full">
                <SeriesCardFluid
                  show={s}
                  isFavorite={favorites.has(s.id)}
                  onOpen={onOpenShow}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {visibleItems.map((it) => (
              <div key={it.id} className="w-full">
                <ContentCardFluid
                  item={it}
                  isFavorite={favorites.has(it.id)}
                  onPlay={onPlay}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition border-l-2 ${
        active
          ? "bg-primary/15 border-primary text-foreground font-semibold"
          : "border-transparent hover:bg-accent/40 text-foreground/90"
      }`}
    >
      <span className="truncate uppercase tracking-wide text-xs">{label}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

// Fluid (full width) variants — wrap existing cards by removing fixed widths
function ContentCardFluid(props: React.ComponentProps<typeof ContentCard>) {
  return (
    <div className="[&>div]:!w-full">
      <ContentCard {...props} />
    </div>
  );
}
function SeriesCardFluid(props: React.ComponentProps<typeof SeriesCard>) {
  return (
    <div className="[&>div]:!w-full">
      <SeriesCard {...props} />
    </div>
  );
}
