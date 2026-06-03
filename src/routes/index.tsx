import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { SeriesModal } from "@/components/SeriesModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { HomeTiles, type HomeTileTarget } from "@/components/HomeTiles";
import { SettingsPanel } from "@/components/SettingsPanel";
import { parseM3U } from "@/utils/parseM3U";
import { type SeriesShow } from "@/utils/parseEpisode";
import {
  DEFAULT_IPTV_SETTINGS,
  IPTV_SETTINGS_KEY,
  settingsToQuery,
  type IptvSettings,
} from "@/utils/iptvSettings";
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
type View = Tab | "settings" | null;

function Dashboard() {
  const [items, setItems] = useState<M3UItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(null);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<IptvSettings>(DEFAULT_IPTV_SETTINGS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<M3UItem | null>(null);
  const [openShow, setOpenShow] = useState<SeriesShow | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw)));
      const rawSettings = localStorage.getItem(IPTV_SETTINGS_KEY);
      if (rawSettings) setSettings(JSON.parse(rawSettings));
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/m3u?${settingsToQuery(settings)}`)
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
  }, [settings]);

  const goHome = () => {
    setView(null);
    setSearch("");
    setPlaying(null);
    setOpenShow(null);
  };

  const selectHomeTile = (target: HomeTileTarget) => {
    setSearch("");
    setView(target);
  };

  const saveSettings = (next: IptvSettings) => {
    try {
      localStorage.setItem(IPTV_SETTINGS_KEY, JSON.stringify(next));
    } catch {}
    setItems([]);
    setPlaying(null);
    setOpenShow(null);
    setSettings(next);
  };

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

  const counts: Record<Tab, number> = useMemo(
    () => ({
      live: items.filter((i) => i.type === "live").length,
      movie: items.filter((i) => i.type === "movie").length,
      series: items.filter((i) => i.type === "series").length,
      favorites: favorites.size,
    }),
    [items, favorites]
  );

  const filtered = useMemo(() => {
    if (!view) return [];
    let list = items;
    if (view === "favorites") {
      list = list.filter((i) => favorites.has(i.id));
    } else {
      list = list.filter((i) => i.type === view);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, view, favorites, search]);

  // ----- HOME SCREEN -----
  if (view === null) {
    return (
      <>
        {loading && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur">
            <div className="flex flex-col items-center text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-3 text-sm">Carregando lista IPTV...</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4">
            <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
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
          </div>
        )}
        <HomeTiles counts={counts} onSelect={setView} />
      </>
    );
  }

  // ----- BROWSE SCREEN -----
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        active={view}
        onChange={setView}
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
          <button
            onClick={() => setView(null)}
            className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </button>

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
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {view === "live" && "Canais ao vivo"}
                  {view === "movie" && "Filmes"}
                  {view === "series" && "Séries"}
                  {view === "favorites" && "Meus favoritos"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {filtered.length} resultados {search && `para "${search}"`}
                </p>
              </div>

              <CategoryBrowser
                items={filtered}
                mode={view}
                favorites={favorites}
                onPlay={setPlaying}
                onOpenShow={setOpenShow}
                onToggleFavorite={toggleFav}
              />
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
