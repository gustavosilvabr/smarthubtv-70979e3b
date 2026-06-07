import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Heart,
  Loader2,
  Maximize2,
  MoreVertical,
  RotateCcw,
  Search,
  Settings,
  Tv,
  Clock,
  Star,
  LayoutGrid,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import type { M3UItem } from "@/types/iptv";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { EpgPanel } from "@/components/EpgPanel";
import { ChannelLogo } from "@/components/ChannelLogo";
import { AdultPinModal, isAdultCategory } from "@/components/AdultPinModal";
import { useGsapEntrance } from "@/hooks/useGsapEntrance";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const RECENTS_KEY = "smarthub:live:recents";
const INITIAL_VISIBLE = 200;
const LOAD_MORE_STEP = 200;

interface Props {
  items: M3UItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onBack: () => void;
  onOpenSettings?: () => void;
  settingsQuery: string;
}

type SpecialCat = "all" | "recent" | "favorites";

const ChannelListItem = memo(function ChannelListItem({
  ch,
  idx,
  active,
  isFavorite,
  onSelect,
  onDoubleClickFullscreen,
  serverBase,
}: {
  ch: M3UItem;
  idx: number;
  active: boolean;
  isFavorite: boolean;
  onSelect: (ch: M3UItem) => void;
  onDoubleClickFullscreen: () => void;
  serverBase?: string;
}) {
  return (
    <li>
      <button
        onClick={() => onSelect(ch)}
        onDoubleClick={onDoubleClickFullscreen}
        className={[
          "group flex w-full items-center gap-2 rounded-xl border px-2 sm:px-3 py-2 text-left transition focus:outline-none text-sm",
          active
            ? "border-amber-400/70 bg-gradient-to-r from-purple-700/60 to-purple-900/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
            : "border-white/5 bg-black/30 hover:border-white/15 hover:bg-purple-900/30 focus-visible:border-amber-400/50",
        ].join(" ")}
      >
        <span
          className={[
            "w-6 shrink-0 text-right text-xs font-bold tabular-nums",
            active ? "text-amber-300" : "text-white/40",
          ].join(" ")}
        >
          {idx + 1}
        </span>
        <ChannelLogo logo={ch.logo} name={ch.name} size="sm" serverBase={serverBase} />
        <span
          className={[
            "min-w-0 flex-1 truncate text-xs sm:text-sm font-medium",
            active ? "text-amber-300" : "text-white/90",
          ].join(" ")}
        >
          {ch.name}
        </span>
        {isFavorite && <Heart className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" />}
      </button>
    </li>
  );
});

export function LiveTvScreen({
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
  const [recents, setRecents] = useState<M3UItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [pinPending, setPinPending] = useState<string | null>(null);
  const [unlockedAdult, setUnlockedAdult] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const listWrapRef = useRef<HTMLElement>(null);

  useGsapEntrance(headerRef, { y: -20, opacity: 0, duration: 0.5 });
  useGsapEntrance(sidebarRef, { x: -30, opacity: 0, duration: 0.6, delay: 0.1 });
  useGsapEntrance(listWrapRef, { y: 20, opacity: 0, duration: 0.6, delay: 0.2 });
  useGsapEntrance(playerWrapRef, { scale: 0.95, opacity: 0, duration: 0.6, delay: 0.3, ease: "back.out(1.2)" });

  useGSAP(
    () => {
      gsap.to(".ambient-bubble", {
        y: "random(-20, 20)",
        x: "random(-20, 20)",
        scale: "random(0.9, 1.1)",
        duration: "random(4, 6)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.5,
      });
    },
    { scope: containerRef },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(RECENTS_KEY);
    if (raw) {
      try {
        setRecents(JSON.parse(raw));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setChanQueryDebounced(chanQuery), 180);
    return () => clearTimeout(t);
  }, [chanQuery]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [category, chanQueryDebounced]);

  const itemIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const realCats = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.group, (map.get(it.group) || 0) + 1);
    const all = [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const normal = all.filter((c) => !isAdultCategory(c.name));
    const adult = all.filter((c) => isAdultCategory(c.name));
    return [...normal, ...adult];
  }, [items]);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return realCats;
    return realCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [realCats, catQuery]);

  useEffect(() => {
    if (!isAdultCategory(String(category))) {
      setUnlockedAdult(false);
    }
  }, [category]);

  const handleCategoryClick = useCallback(
    (name: string) => {
      if (isAdultCategory(name) && !unlockedAdult) {
        setPinPending(name);
      } else {
        setCategory(name);
      }
    },
    [unlockedAdult],
  );

  const channelsForCategory = useMemo(() => {
    if (category === "all") return items;
    if (category === "favorites") return items.filter((i) => favorites.has(i.id));
    if (category === "recent") return recents;
    return items.filter((i) => i.group === category);
  }, [items, category, favorites, recents]);

  const filteredChannels = useMemo(() => {
    const q = chanQueryDebounced.trim().toLowerCase();
    if (!q) return channelsForCategory;
    return channelsForCategory.filter((i) => i.name.toLowerCase().includes(q));
  }, [channelsForCategory, chanQueryDebounced]);

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount],
  );

  useEffect(() => {
    if (!visibleChannels.length) return;
    if (!selected || !visibleChannels.some((c) => c.id === selected.id)) {
      setSelected(visibleChannels[0]);
    }
  }, [visibleChannels, selected]);

  const selectChannel = useCallback((it: M3UItem) => {
    setSelected(it);
    setRecents((prev) => {
      const next = [it, ...prev.filter((x) => x.id !== it.id)].slice(0, 20);
      try {
        sessionStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const { loading, error, retry } = useHlsPlayer(videoRef, selected);

  const goFullscreen = useCallback(async () => {
    const el = playerWrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (e) {
      console.error("[fullscreen]", e);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        setShowChannelInfo(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selected || visibleChannels.length === 0) return;

      const currentIdx = visibleChannels.findIndex((c) => c.id === selected.id);
      let nextIdx: number | null = null;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        nextIdx = (currentIdx + 1) % visibleChannels.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIdx = currentIdx <= 0 ? visibleChannels.length - 1 : currentIdx - 1;
      }

      if (nextIdx !== null && visibleChannels[nextIdx]) {
        selectChannel(visibleChannels[nextIdx]);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visibleChannels, selected, selectChannel]);

  const counts = useMemo(
    () => ({
      all: items.length,
      recent: recents.filter((r) => itemIds.has(r.id)).length,
      favorites: items.filter((i) => favorites.has(i.id)).length,
    }),
    [items, recents, itemIds, favorites],
  );

  const serverBase = useMemo(() => {
    const params = new URLSearchParams(settingsQuery);
    return params.get("server") || undefined;
  }, [settingsQuery]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(88,28,135,0.35)_0%,_#0a0613_55%,_#050308_100%)] text-foreground"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-bubble absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
        <div className="ambient-bubble absolute bottom-[-160px] left-[-100px] h-[380px] w-[380px] rounded-full bg-primary/15 blur-[140px]" />
      </div>

      <header
        ref={headerRef}
        className="relative z-10 flex items-center gap-2 sm:gap-3 border-b border-white/5 bg-black/40 px-2 sm:px-4 py-2 sm:py-3 backdrop-blur"
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="relative mx-auto w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            value={chanQuery}
            onChange={(e) => setChanQuery(e.target.value)}
            placeholder="Search"
            className="h-10 sm:h-11 w-full rounded-full border border-white/10 bg-white/5 pl-10 sm:pl-11 pr-4 text-xs sm:text-sm text-white placeholder:text-white/40 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="hidden sm:block">
            <TopIconButton label="Player" icon={PlayCircle} />
          </div>
          <div className="hidden md:block">
            <TopIconButton label="Categorias" icon={LayoutGrid} />
          </div>
          <div className="hidden lg:block">
            <TopIconButton label="Opções" icon={MoreVertical} />
          </div>
          <TopIconButton label="Configurações" icon={Settings} onClick={onOpenSettings} />
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 md:gap-4 md:p-4 grid-cols-1 sm:grid-cols-[200px_240px_minmax(0,1fr)] lg:grid-cols-[230px_280px_minmax(0,1fr)] xl:grid-cols-[260px_320px_minmax(0,1fr)] sm:grid-rows-1">
        <aside
          ref={sidebarRef}
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#140a24]/80 backdrop-blur row-start-2 col-span-1 sm:row-start-auto sm:col-span-auto md:row-start-auto md:col-span-auto max-h-[180px] sm:max-h-none sm:h-full"
        >
          <div className="border-b border-white/5 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder="Search in categories"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 text-xs uppercase tracking-wide text-white placeholder:text-white/40 outline-none focus:border-amber-400/60"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <CategoryButton icon={LayoutGrid} label="All" count={counts.all} active={category === "all"} onClick={() => setCategory("all")} />
            <CategoryButton icon={Clock} label="Recently Viewed" count={counts.recent} active={category === "recent"} onClick={() => setCategory("recent")} />
            <CategoryButton icon={Star} label="Favorite" count={counts.favorites} active={category === "favorites"} onClick={() => setCategory("favorites")} />
            <div className="my-2 h-px bg-white/5" />
            {filteredCats.map((c) => (
              <CategoryButton
                key={c.name}
                label={c.name}
                count={c.count}
                active={category === c.name}
                isAdult={isAdultCategory(c.name)}
                onClick={() => handleCategoryClick(c.name)}
              />
            ))}
            {filteredCats.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-white/40">Nenhuma categoria</div>
            )}
          </div>
        </aside>

        <section
          ref={listWrapRef}
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#140a24]/80 backdrop-blur order-3 sm:order-none col-span-1 sm:col-span-auto row-start-3 sm:row-start-auto md:row-start-auto max-h-[300px] sm:max-h-none sm:h-full"
        >
          <div className="flex-1 overflow-y-auto p-2">
            {visibleChannels.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-white/40">
                Nenhum canal encontrado.
              </div>
            ) : (
              <>
                <ul className="space-y-1">
                  {visibleChannels.map((ch, idx) => (
                    <ChannelListItem
                      key={ch.id}
                      ch={ch}
                      idx={idx}
                      active={selected?.id === ch.id}
                      isFavorite={favorites.has(ch.id)}
                      onSelect={selectChannel}
                      onDoubleClickFullscreen={goFullscreen}
                      serverBase={serverBase}
                    />
                  ))}
                </ul>
                {visibleCount < filteredChannels.length && (
                  <button
                    onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold uppercase tracking-wider text-white/70 transition hover:bg-white/10"
                  >
                    Carregar mais ({visibleCount} de {filteredChannels.length})
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-2 sm:gap-3 overflow-hidden order-2 col-span-1 sm:col-span-auto row-start-1 sm:row-start-auto">
          <div
            ref={playerWrapRef}
            onClick={goFullscreen}
            className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shrink-0"
            style={{ aspectRatio: "16/9", maxHeight: "42%" }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls
              controlsList="nodownload"
              className="h-full w-full bg-black"
            />

            <div className="pointer-events-none absolute right-2 top-2 sm:right-3 sm:top-3 rounded-full bg-black/60 p-1.5 sm:p-2 opacity-0 ring-1 ring-white/10 transition group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>

            {selected && loading && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 text-white">
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-amber-300" />
                  Carregando canal...
                </div>
              </div>
            )}

            {selected && !loading && error && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-white"
              >
                <div className="max-w-md">
                  <p className="text-sm">{error}</p>
                  <button
                    onClick={retry}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-amber-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
                  </button>
                </div>
              </div>
            )}

            {!selected && (
              <div className="absolute inset-0 grid place-items-center text-white/40">
                <Tv className="h-16 w-16" strokeWidth={1.2} />
              </div>
            )}

            {isFullscreen && selected && (
              <div className="pointer-events-none absolute bottom-4 sm:bottom-6 left-4 sm:left-6">
                <div className="bg-gradient-to-r from-black/90 via-black/80 to-black/70 px-4 sm:px-6 py-3 sm:py-4 rounded-lg backdrop-blur-sm border border-amber-400/20">
                  <div className="text-xl sm:text-3xl font-bold text-white tracking-wide">
                    {selected.name}
                  </div>
                  <div className="text-xs sm:text-sm text-amber-300/90 mt-1 font-semibold">
                    CANAL {(visibleChannels.findIndex((c) => c.id === selected.id) + 1 || 1)} • {selected.group}
                  </div>
                </div>
              </div>
            )}

            {isFullscreen && (
              <div className="pointer-events-none absolute right-4 sm:right-6 inset-y-0 flex flex-col items-center justify-center gap-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const currentIdx = visibleChannels.findIndex((c) => c.id === selected?.id);
                    const prevIdx = currentIdx <= 0 ? visibleChannels.length - 1 : currentIdx - 1;
                    if (prevIdx >= 0 && visibleChannels[prevIdx]) {
                      selectChannel(visibleChannels[prevIdx]);
                    }
                  }}
                  className="pointer-events-auto hover:scale-110 transition-transform"
                  aria-label="Canal anterior"
                >
                  <ChevronUp className="h-8 w-8 sm:h-10 sm:w-10 text-amber-300 drop-shadow-lg hover:text-amber-200" />
                </button>
                <div className="h-12 w-0.5 bg-white/20" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const currentIdx = visibleChannels.findIndex((c) => c.id === selected?.id);
                    const nextIdx = (currentIdx + 1) % visibleChannels.length;
                    if (nextIdx >= 0 && visibleChannels[nextIdx]) {
                      selectChannel(visibleChannels[nextIdx]);
                    }
                  }}
                  className="pointer-events-auto hover:scale-110 transition-transform"
                  aria-label="Próximo canal"
                >
                  <ChevronDown className="h-8 w-8 sm:h-10 sm:w-10 text-amber-300 drop-shadow-lg hover:text-amber-200" />
                </button>
              </div>
            )}
          </div>

          {selected && (
            <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl border border-white/10 bg-[#140a24]/80 px-3 sm:px-4 py-2 sm:py-3 backdrop-blur">
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-bold text-amber-300">
                  {(visibleChannels.findIndex((c) => c.id === selected.id) + 1 || 1)}.{" "}
                  <span className="text-white">{selected.name}</span>
                </div>
                <div className="truncate text-xs text-white/50">{selected.group}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <ActionButton
                  active={favorites.has(selected.id)}
                  onClick={() => onToggleFavorite(selected.id)}
                  icon={Heart}
                  label="Favorite"
                />
                <ActionButton icon={Clock} label="Catch Up" />
                <ActionButton onClick={goFullscreen} icon={Maximize2} label="Tela cheia" />
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto hidden sm:block">
            <EpgPanel streamId={selected?.streamId} settingsQuery={settingsQuery} />
          </div>
        </section>
      </div>

      {pinPending && (
        <AdultPinModal
          onUnlock={() => {
            setUnlockedAdult(true);
            setCategory(pinPending);
            setPinPending(null);
          }}
          onCancel={() => setPinPending(null)}
        />
      )}
    </div>
  );
}

function TopIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <Icon className="h-5 w-5 text-white/80" />
    </button>
  );
}

function CategoryButton({
  icon: Icon,
  label,
  count,
  active,
  isAdult,
  onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active: boolean;
  isAdult?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "mb-1 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition focus:outline-none",
        active
          ? "border-amber-400/60 bg-gradient-to-r from-purple-700/70 to-purple-900/70 text-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]"
          : isAdult
            ? "border-red-900/40 bg-red-950/20 text-white/75 hover:border-red-700/50 hover:bg-red-950/40"
            : "border-white/5 bg-black/20 text-white/85 hover:border-white/15 hover:bg-purple-900/30 focus-visible:border-amber-400/40",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 ${active ? "text-amber-300" : "text-white/60"}`} />}
        {isAdult && !Icon && (
          <ShieldAlert className={`h-3.5 w-3.5 shrink-0 ${active ? "text-amber-300" : "text-red-400/70"}`} />
        )}
        <span className="truncate font-semibold uppercase tracking-wide text-[11px]">{label}</span>
      </span>
      <span
        className={[
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
          active ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/60",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
        active
          ? "border-amber-400/70 bg-amber-400/15 text-amber-300"
          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
      ].join(" ")}
    >
      <Icon className={`h-4 w-4 ${active ? "fill-amber-300" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
