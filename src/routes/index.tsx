import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { SeriesModal } from "@/components/SeriesModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { parseM3U } from "@/utils/parseM3U";
import { type SeriesShow } from "@/utils/parseEpisode";
import type { M3UItem } from "@/types/iptv";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "FlixTV — IPTV Player Premium" },
      { name: "description", content: "Assista canais ao vivo, filmes e séries em alta qualidade." },
    ],
  }),
});

const FAV_KEY = "flixtv:favorites";

function Dashboard() {
  const [items, setItems] = useState<M3UItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<M3UItem | null>(null);
  const [openShow, setOpenShow] = useState<SeriesShow | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/m3u")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Erro ${r.status} ao carregar lista`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseM3U(text);
        if (!parsed.length) throw new Error("Lista vazia ou inválida");
        setItems(parsed);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Falha ao carregar a lista M3U");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "favorites") {
      list = list.filter((i) => favorites.has(i.id));
    } else {
      list = list.filter((i) => i.type === tab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, tab, favorites, search]);

  const groups = useMemo(() => {
    const map = new Map<string, M3UItem[]>();
    for (const it of filtered) {
      if (!map.has(it.group)) map.set(it.group, []);
      map.get(it.group)!.push(it);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([group, items]) => ({ group, items }));
  }, [filtered]);

  const seriesGroups = useMemo(() => {
    if (tab !== "series") return [];
    return groups.map((g) => ({ group: g.group, shows: groupSeries(g.items) }));
  }, [groups, tab]);

  const counts: Record<Tab, number> = useMemo(
    () => ({
      live: items.filter((i) => i.type === "live").length,
      movie: items.filter((i) => i.type === "movie").length,
      series: items.filter((i) => i.type === "series").length,
      favorites: favorites.size,
    }),
    [items, favorites]
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        active={tab}
        onChange={setTab}
        counts={counts}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          search={search}
          onSearch={setSearch}
          onToggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-sm">Carregando lista IPTV...</p>
            </div>
          )}

          {error && !loading && (
            <div className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h2 className="mt-3 font-semibold">Erro ao carregar</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {tab === "live" && "Canais ao vivo"}
                  {tab === "movie" && "Filmes"}
                  {tab === "series" && "Séries"}
                  {tab === "favorites" && "Meus favoritos"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {filtered.length} resultados {search && `para "${search}"`}
                </p>
              </div>

              {groups.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">
                  Nenhum conteúdo encontrado.
                </div>
              ) : tab === "series" ? (
                seriesGroups.map((g) => (
                  <SeriesSection
                    key={g.group}
                    title={g.group}
                    shows={g.shows}
                    favorites={favorites}
                    onOpen={setOpenShow}
                    onToggleFavorite={toggleFav}
                  />
                ))
              ) : (
                groups.map((g) => (
                  <CategorySection
                    key={g.group}
                    title={g.group}
                    items={g.items}
                    favorites={favorites}
                    onPlay={setPlaying}
                    onToggleFavorite={toggleFav}
                  />
                ))
              )}
            </>
          )}
        </main>
      </div>

      <SeriesModal
        show={openShow}
        onClose={() => setOpenShow(null)}
        onPlay={(it) => {
          setOpenShow(null);
          setPlaying(it);
        }}
      />
      <VideoPlayer item={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
