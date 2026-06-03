import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { SeriesModal } from "@/components/SeriesModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { HomeTiles, type HomeTileTarget } from "@/components/HomeTiles";
import { SettingsPanel } from "@/components/SettingsPanel";
import { LoginScreen } from "@/components/LoginScreen";
import { LoadingScreen, type LoadingStage } from "@/components/LoadingScreen";
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
      { title: "Smart Hub Play TV — IPTV Player" },
      { name: "description", content: "Assista canais ao vivo, filmes e séries em alta qualidade." },
    ],
  }),
});

const FAV_KEY = "flixtv:favorites";
type View = Tab | "settings" | null;
type Stage = "login" | "loading" | "ready";

function Dashboard() {
  const [items, setItems] = useState<M3UItem[]>([]);
  const [stage, setStage] = useState<Stage>("login");
  const [bootDone, setBootDone] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("live");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(null);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<IptvSettings>(DEFAULT_IPTV_SETTINGS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<M3UItem | null>(null);
  const [openShow, setOpenShow] = useState<SeriesShow | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fetchSeq = useRef(0);

  // Boot: read storage once on client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw)));
      const rawSettings = localStorage.getItem(IPTV_SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as IptvSettings;
        if (parsed?.server && parsed?.username && parsed?.password) {
          setSettings(parsed);
          setStage("loading");
        }
      }
    } catch {}
    setBootDone(true);
  }, []);

  // When entering loading stage, fetch and animate stages.
  useEffect(() => {
    if (stage !== "loading") return;
    if (!settings.server || !settings.username || !settings.password) return;

    const id = ++fetchSeq.current;
    setError(null);
    setLoadingStage("live");

    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    stageTimers.push(setTimeout(() => id === fetchSeq.current && setLoadingStage("vod"), 700));
    stageTimers.push(setTimeout(() => id === fetchSeq.current && setLoadingStage("series"), 1400));
    stageTimers.push(setTimeout(() => id === fetchSeq.current && setLoadingStage("epg"), 2100));

    fetch(`/api/m3u?${settingsToQuery(settings)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Erro ${r.status} ao carregar lista`);
        return r.text();
      })
      .then((text) => {
        if (id !== fetchSeq.current) return;
        const parsed = parseM3U(text);
        if (!parsed.length) throw new Error("Lista vazia ou inválida");
        setItems(parsed);
        setLoadingStage("done");
        // Tiny pause for the "Completed!" beat.
        setTimeout(() => {
          if (id === fetchSeq.current) setStage("ready");
        }, 500);
      })
      .catch((e: Error) => {
        if (id !== fetchSeq.current) return;
        setError(e.message || "Falha ao carregar a lista");
      });

    return () => {
      stageTimers.forEach(clearTimeout);
    };
  }, [stage, settings]);

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

  const handleLogin = (next: IptvSettings) => {
    try {
      localStorage.setItem(IPTV_SETTINGS_KEY, JSON.stringify(next));
    } catch {}
    setItems([]);
    setSettings(next);
    setStage("loading");
  };

  const saveSettings = (next: IptvSettings) => {
    try {
      localStorage.setItem(IPTV_SETTINGS_KEY, JSON.stringify(next));
    } catch {}
    setItems([]);
    setPlaying(null);
    setOpenShow(null);
    setView(null);
    setSettings(next);
    setStage("loading");
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(IPTV_SETTINGS_KEY);
    } catch {}
    setItems([]);
    setView(null);
    setPlaying(null);
    setOpenShow(null);
    setSettings(DEFAULT_IPTV_SETTINGS);
    setStage("login");
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
    if (!view || view === "settings") return [];
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

  // ---------- Render gates ----------

  // Prevent SSR/hydration mismatch — wait until we've read localStorage.
  if (!bootDone) {
    return <div className="min-h-screen bg-background" />;
  }

  if (stage === "login") {
    return <LoginScreen onSubmit={handleLogin} initial={settings} />;
  }

  if (stage === "loading") {
    return (
      <LoadingScreen
        stage={loadingStage}
        error={error}
        onRetry={() => {
          setError(null);
          setStage("loading");
          // re-trigger by bumping settings ref
          setSettings((s) => ({ ...s }));
        }}
      />
    );
  }

  // ---------- HOME ----------
  if (view === null) {
    return <HomeTiles counts={counts} onSelect={selectHomeTile} />;
  }

  if (view === "settings") {
    return (
      <SettingsPanel
        settings={settings}
        loading={false}
        onSave={saveSettings}
        onHome={goHome}
        onLogout={handleLogout}
      />
    );
  }

  // ---------- BROWSE ----------
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
            onClick={goHome}
            className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </button>

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
