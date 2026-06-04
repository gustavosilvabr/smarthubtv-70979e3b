import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Heart,
  Loader2,
  Maximize2,
  MoreVertical,
  RotateCcw,
  Search,
  Settings,
  Tv,
  Star,
  LayoutGrid,
  PlayCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { getDisplayImageUrl } from "@/utils/media";
import type { SeriesEpisode, SeriesInfoResponse } from "@/routes/api/series-info";

const RECENTS_KEY = "smarthub:series:recents";
const MAX_RECENTS = 30;

interface Props {
  items: M3UItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  onOpenSettings?: () => void;
  settingsQuery: string;
}

type SpecialCat = "all" | "recent" | "favorites";

export function SeriesScreen({
  items,
  favorites,
  onToggleFavorite,
  onBack,
  onOpenSettings,
  settingsQuery,
}: Props) {
  const [catQuery, setCatQuery] = useState("");
  const [chanQuery, setChanQuery] = useState("");
  const [chanQueryDebounced, setChanQueryDebounced] = useState("");
  const [category, setCategory] = useState<SpecialCat | string>("all");
  const [selected, setSelected] = useState<M3UItem | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [info, setInfo] = useState<SeriesInfoResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [playing, setPlaying] = useState<M3UItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(200);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setChanQueryDebounced(chanQuery), 180);
    return () => clearTimeout(t);
  }, [chanQuery]);

  useEffect(() => { setVisibleCount(200); }, [category, chanQueryDebounced]);

  const realCats = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.group, (map.get(it.group) || 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return realCats;
    return realCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [realCats, catQuery]);

  const seriesForCategory = useMemo(() => {
    if (category === "all") return items;
    if (category === "favorites") return items.filter((i) => favorites.has(i.id));
    if (category === "recent") {
      const idx = new Map(items.map((i) => [i.id, i]));
      return recents.map((id) => idx.get(id)).filter(Boolean) as M3UItem[];
    }
    return items.filter((i) => i.group === category);
  }, [items, category, favorites, recents]);

  const visibleSeries = useMemo(() => {
    const q = chanQuery.trim().toLowerCase();
    if (!q) return seriesForCategory;
    return seriesForCategory.filter((i) => i.name.toLowerCase().includes(q));
  }, [seriesForCategory, chanQuery]);

  useEffect(() => {
    if (!visibleSeries.length) return;
    if (!selected || !visibleSeries.some((c) => c.id === selected.id)) {
      setSelected(visibleSeries[0]);
    }
  }, [visibleSeries, selected]);

  const selectSeries = (it: M3UItem) => {
    setSelected(it);
    setPlaying(null);
    setRecents((prev) => {
      const next = [it.id, ...prev.filter((id) => id !== it.id)].slice(0, MAX_RECENTS);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Fetch series-info when selection changes
  useEffect(() => {
    if (!selected) {
      setInfo(null);
      setSeason(null);
      return;
    }
    const seriesId = String(selected.streamId || "").replace(/^series-/, "") ||
      selected.url.replace("xtream-series://", "");
    if (!seriesId) return;
    let cancelled = false;
    setLoadingInfo(true);
    setInfoError(null);
    setInfo(null);
    setSeason(null);
    fetch(`/api/series-info?id=${encodeURIComponent(seriesId)}&${settingsQuery}`)
      .then((r) => r.json())
      .then((data: SeriesInfoResponse & { error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setInfoError(data.error);
          return;
        }
        setInfo(data);
        setSeason(data.seasons[0] ?? null);
      })
      .catch((e) => { if (!cancelled) setInfoError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoadingInfo(false); });
    return () => { cancelled = true; };
  }, [selected, settingsQuery]);

  const episodesForSeason = useMemo(() => {
    if (!info || season == null) return [];
    return info.episodes.filter((e) => e.season === season);
  }, [info, season]);

  const playEpisode = (ep: SeriesEpisode) => {
    if (!selected) return;
    const item: M3UItem = {
      id: `${selected.id}:ep:${ep.id}`,
      name: `${selected.name} · T${ep.season}E${ep.episode} ${ep.title}`,
      logo: ep.cover || selected.logo,
      group: selected.group,
      url: ep.url,
      type: "series",
    };
    setPlaying(item);
  };

  const { loading, error, retry } = useHlsPlayer(videoRef, playing);

  const goFullscreen = async () => {
    const el = playerWrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch (e) { console.error("[fullscreen]", e); }
  };

  const counts = {
    all: items.length,
    recent: recents.filter((id) => items.some((i) => i.id === id)).length,
    favorites: items.filter((i) => favorites.has(i.id)).length,
  };

  const posterUrl = info?.cover
    ? getDisplayImageUrl(info.cover)
    : selected
    ? getDisplayImageUrl(selected.logo)
    : "";

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(88,28,135,0.35)_0%,_#0a0613_55%,_#050308_100%)] text-foreground">
      <header className="flex items-center gap-3 border-b border-white/5 bg-black/40 px-4 py-3 backdrop-blur">
        <button onClick={onBack} aria-label="Voltar" className="grid h-11 w-11 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="relative mx-auto w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input value={chanQuery} onChange={(e) => setChanQuery(e.target.value)} placeholder="Search"
            className="h-11 w-full rounded-full border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20" />
        </div>
        <div className="flex items-center gap-2">
          <TopIcon icon={LayoutGrid} label="Categorias" />
          <TopIcon icon={MoreVertical} label="Opções" />
          <TopIcon icon={Settings} label="Configurações" onClick={onOpenSettings} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-[260px_320px_minmax(0,1fr)] md:gap-4 md:p-4">
        {/* Categories */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#140a24]/80 backdrop-blur">
          <div className="border-b border-white/5 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input value={catQuery} onChange={(e) => setCatQuery(e.target.value)} placeholder="Search in categories"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 text-xs uppercase tracking-wide text-white placeholder:text-white/40 outline-none focus:border-amber-400/60" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <CatBtn icon={LayoutGrid} label="All" count={counts.all} active={category === "all"} onClick={() => setCategory("all")} />
            <CatBtn icon={Clock} label="Recently Viewed" count={counts.recent} active={category === "recent"} onClick={() => setCategory("recent")} />
            <CatBtn icon={Star} label="Favorite" count={counts.favorites} active={category === "favorites"} onClick={() => setCategory("favorites")} />
            <div className="my-2 h-px bg-white/5" />
            {filteredCats.map((c) => (
              <CatBtn key={c.name} label={c.name} count={c.count} active={category === c.name} onClick={() => setCategory(c.name)} />
            ))}
            {filteredCats.length === 0 && <div className="px-3 py-4 text-center text-xs text-white/40">Nenhuma categoria</div>}
          </div>
        </aside>

        {/* Series list */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#140a24]/80 backdrop-blur">
          <div className="flex-1 overflow-y-auto p-2">
            {visibleSeries.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-white/40">Nenhuma série encontrada.</div>
            ) : (
              <ul className="space-y-1.5">
                {visibleSeries.map((s, idx) => {
                  const active = selected?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button onClick={() => selectSeries(s)} className={[
                        "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none",
                        active ? "border-amber-400/70 bg-gradient-to-r from-purple-700/60 to-purple-900/60"
                          : "border-white/5 bg-black/30 hover:border-white/15 hover:bg-purple-900/30",
                      ].join(" ")}>
                        <span className={["w-8 shrink-0 text-right text-sm font-bold tabular-nums", active ? "text-amber-300" : "text-white/40"].join(" ")}>{idx + 1}</span>
                        <span className={["grid h-12 w-9 shrink-0 place-items-center overflow-hidden rounded ring-1 ring-white/10", active ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-white/70"].join(" ")}>
                          {s.logo ? <img src={getDisplayImageUrl(s.logo)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <Tv className="h-4 w-4" />}
                        </span>
                        <span className={["min-w-0 flex-1 truncate text-sm font-medium", active ? "text-amber-300" : "text-white/90"].join(" ")}>{s.name}</span>
                        {favorites.has(s.id) && <Heart className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Right: player + episodes */}
        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div ref={playerWrapRef} onClick={() => playing && goFullscreen()}
            className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            {playing ? (
              <video ref={videoRef} autoPlay playsInline controls={false} className="h-full w-full bg-black" />
            ) : posterUrl ? (
              <img src={posterUrl} alt={selected?.name || ""} className="h-full w-full object-cover opacity-70" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-white/40"><Tv className="h-16 w-16" strokeWidth={1.2} /></div>
            )}
            {!playing && selected && (
              <div className="pointer-events-none absolute inset-0 grid place-items-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
                <div className="pointer-events-auto max-w-xl">
                  <div className="text-2xl font-bold text-white drop-shadow">{info?.name || selected.name}</div>
                  {info?.genre && <div className="mt-1 text-xs text-white/70">{info.genre}</div>}
                  {info?.plot && <p className="mt-2 line-clamp-2 text-xs text-white/80">{info.plot}</p>}
                </div>
              </div>
            )}
            {playing && loading && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 text-white">
                <div className="flex flex-col items-center gap-2 text-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-300" /> Carregando episódio...
                </div>
              </div>
            )}
            {playing && !loading && error && (
              <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-white">
                <div className="max-w-md">
                  <p className="text-sm">{error}</p>
                  <button onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-amber-300">
                    <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Series header / actions */}
          {selected && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#140a24]/80 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-white">{info?.name || selected.name}</div>
                <div className="truncate text-xs text-white/50">
                  {info ? `${info.seasons.length} temporada${info.seasons.length === 1 ? "" : "s"} · ${info.episodes.length} episódios` : selected.group}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Action active={favorites.has(selected.id)} onClick={() => onToggleFavorite(selected.id)} icon={Heart} label="Favorite" />
                {playing && (
                  <Action onClick={() => setPlaying(null)} icon={ArrowLeft} label="Voltar" />
                )}
                {playing && <Action onClick={goFullscreen} icon={Maximize2} label="Tela cheia" />}
              </div>
            </div>
          )}

          {/* Episodes panel */}
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#140a24]/80 backdrop-blur">
            {loadingInfo ? (
              <div className="grid h-full place-items-center text-white/40">
                <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
              </div>
            ) : infoError ? (
              <div className="grid h-full place-items-center px-6 text-center text-xs text-white/50">{infoError}</div>
            ) : info && info.seasons.length > 0 ? (
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/5 p-2">
                  {info.seasons.map((s) => (
                    <button key={s} onClick={() => setSeason(s)} className={[
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                      s === season ? "bg-amber-400 text-black" : "bg-white/5 text-white/80 hover:bg-white/10",
                    ].join(" ")}>
                      Temporada {s}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {episodesForSeason.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-white/40">Nenhum episódio.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {episodesForSeason.map((ep) => {
                        const isPlaying = playing?.url === ep.url;
                        return (
                          <li key={ep.id}>
                            <button onClick={() => playEpisode(ep)} className={[
                              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                              isPlaying
                                ? "border-amber-400/70 bg-gradient-to-r from-purple-700/60 to-purple-900/60"
                                : "border-white/5 bg-black/30 hover:border-white/15 hover:bg-purple-900/30",
                            ].join(" ")}>
                              <span className={["grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums", isPlaying ? "bg-amber-400 text-black" : "bg-white/10 text-white/80"].join(" ")}>{ep.episode}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-white/90">{ep.title}</span>
                                <span className="block text-[11px] text-white/40">T{ep.season} · E{ep.episode}{ep.duration ? ` · ${ep.duration}` : ""}</span>
                              </span>
                              <PlayCircle className={`h-5 w-5 shrink-0 ${isPlaying ? "text-amber-300" : "text-white/40"}`} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center px-6 text-center text-xs text-white/50">Selecione uma série para ver os episódios.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function TopIcon({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid h-11 w-11 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10">
      <Icon className="h-5 w-5 text-white/80" />
    </button>
  );
}

function CatBtn({ icon: Icon, label, count, active, onClick }: { icon?: React.ComponentType<{ className?: string }>; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={[
      "mb-1 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition focus:outline-none",
      active ? "border-amber-400/60 bg-gradient-to-r from-purple-700/70 to-purple-900/70 text-amber-300"
        : "border-white/5 bg-black/20 text-white/85 hover:border-white/15 hover:bg-purple-900/30",
    ].join(" ")}>
      <span className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 ${active ? "text-amber-300" : "text-white/60"}`} />}
        <span className="truncate font-semibold uppercase tracking-wide text-[11px]">{label}</span>
      </span>
      <span className={["shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", active ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/60"].join(" ")}>{count}</span>
    </button>
  );
}

function Action({ icon: Icon, label, onClick, active }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={[
      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition",
      active ? "border-amber-400/70 bg-amber-400/15 text-amber-300" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
    ].join(" ")}>
      <Icon className={`h-4 w-4 ${active ? "fill-amber-300" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
