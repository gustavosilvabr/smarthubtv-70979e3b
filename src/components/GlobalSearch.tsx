import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Radio, Search, Tv, X } from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { matchesSearch } from "@/utils/string";
import { getDisplayImageUrl } from "@/utils/media";

interface Props {
  items: M3UItem[];
  onSelectLive: (item: M3UItem) => void;
  onSelectMovie: (item: M3UItem) => void;
  onSelectSeries: (item: M3UItem) => void;
  onClose: () => void;
}

const TYPE_ICON = {
  live: Radio,
  movie: Film,
  series: Tv,
} as const;

const TYPE_LABEL = {
  live: "TV Ao Vivo",
  movie: "Filmes",
  series: "Séries",
} as const;

const TYPE_COLOR = {
  live: "text-emerald-400",
  movie: "text-rose-400",
  series: "text-fuchsia-400",
} as const;

export function GlobalSearch({ items, onSelectLive, onSelectMovie, onSelectSeries, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setQueryDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => {
    if (queryDebounced.trim().length < 2) return [];
    return items
      .filter((i) => matchesSearch(i.name, queryDebounced))
      .slice(0, 60);
  }, [items, queryDebounced]);

  const grouped = useMemo(() => {
    const live = results.filter((i) => i.type === "live").slice(0, 15);
    const movie = results.filter((i) => i.type === "movie").slice(0, 20);
    const series = results.filter((i) => i.type === "series").slice(0, 20);
    return { live, movie, series };
  }, [results]);

  const handleSelect = (item: M3UItem) => {
    if (item.type === "live") onSelectLive(item);
    else if (item.type === "movie") onSelectMovie(item);
    else onSelectSeries(item);
    onClose();
  };

  const totalCount = results.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0e0820] shadow-2xl shadow-purple-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-white/50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar canal, filme ou série..."
            className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {queryDebounced.length < 2 ? (
            <div className="grid place-items-center py-12 text-sm text-white/40">
              Digite pelo menos 2 caracteres para buscar
            </div>
          ) : totalCount === 0 ? (
            <div className="grid place-items-center py-12 text-sm text-white/40">
              Nenhum resultado para &ldquo;{queryDebounced}&rdquo;
            </div>
          ) : (
            <div className="p-2">
              {(["live", "movie", "series"] as const).map((type) => {
                const group = grouped[type];
                if (!group.length) return null;
                const Icon = TYPE_ICON[type];
                return (
                  <div key={type} className="mb-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${TYPE_COLOR[type]}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {TYPE_LABEL[type]}
                      <span className="ml-auto font-normal text-white/30">{group.length}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {group.map((item) => {
                        const imageUrl = getDisplayImageUrl(item.logo);
                        return (
                        <li key={item.id}>
                          <button
                            onClick={() => handleSelect(item)}
                            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-white/10 hover:bg-white/5 focus:outline-none focus-visible:border-amber-400/50"
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-8 w-8 shrink-0 rounded object-contain bg-white/5"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded bg-white/5 ${TYPE_COLOR[type]}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-white/90">
                                {item.name}
                              </span>
                              <span className="block truncate text-xs text-white/40">{item.group}</span>
                            </span>
                          </button>
                        </li>
                      );})}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {totalCount > 0 && (
          <div className="border-t border-white/5 px-4 py-2 text-xs text-white/30">
            {totalCount >= 55 ? "Mostrando os primeiros resultados" : `${totalCount} resultado${totalCount !== 1 ? "s" : ""}`}
          </div>
        )}
      </div>
    </div>
  );
}
