import { useEffect, useState } from "react";
import { Film, Heart, Radio, Settings, Tv } from "lucide-react";
import type { Tab } from "./Sidebar";

interface Props {
  counts: Record<Tab, number>;
  onSelect: (tab: Tab) => void;
}

interface Tile {
  id: Tab | "settings";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  large?: boolean;
  disabled?: boolean;
}

const TILES: Tile[] = [
  {
    id: "live",
    label: "LIVE TV",
    icon: Radio,
    gradient: "from-emerald-400 via-cyan-500 to-indigo-600",
    large: true,
  },
  {
    id: "movie",
    label: "MOVIES",
    icon: Film,
    gradient: "from-rose-500 via-red-500 to-amber-500",
  },
  {
    id: "series",
    label: "SERIES",
    icon: Tv,
    gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
  },
  {
    id: "favorites",
    label: "FAVORITES",
    icon: Heart,
    gradient: "from-emerald-500/80 to-teal-600/80",
  },
  {
    id: "settings",
    label: "SETTINGS",
    icon: Settings,
    gradient: "from-emerald-500/80 to-teal-600/80",
    disabled: true,
  },
];

export function HomeTiles({ counts, onSelect }: Props) {
  const now = new Date();
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,_#0b1a3a_0%,_#020617_70%)] text-foreground">
      {/* Radial rays background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "repeating-conic-gradient(from 0deg at 50% 50%, rgba(59,130,246,0.10) 0deg, transparent 8deg 16deg)",
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 py-8 min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/20 p-2 ring-1 ring-primary/40">
              <Tv className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                FLIX<span className="text-primary">TV</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Smart Hub Play
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">{time}</div>
              <div className="text-xs text-muted-foreground">{date}</div>
            </div>
          </div>
        </div>

        {/* Tile grid */}
        <div className="mt-10 grid flex-1 gap-5 md:grid-cols-3 md:grid-rows-2">
          {/* Live TV - tall left */}
          <button
            onClick={() => onSelect("live")}
            className={`group relative row-span-2 overflow-hidden rounded-3xl bg-gradient-to-br ${TILES[0].gradient} p-6 text-left shadow-xl transition hover:scale-[1.015] hover:shadow-2xl`}
          >
            <div className="flex h-full flex-col items-center justify-center text-white">
              <Radio className="h-20 w-20 md:h-28 md:w-28 drop-shadow-lg" strokeWidth={1.5} />
              <div className="mt-6 text-3xl md:text-4xl font-extrabold tracking-wide">LIVE TV</div>
              <div className="mt-2 text-xs uppercase tracking-widest opacity-80">
                {counts.live} canais
              </div>
            </div>
          </button>

          {/* Movies */}
          <button
            onClick={() => onSelect("movie")}
            className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${TILES[1].gradient} p-6 text-left shadow-xl transition hover:scale-[1.015] hover:shadow-2xl`}
          >
            <div className="flex h-full flex-col items-center justify-center text-white">
              <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/90">
                <Film className="h-9 w-9" />
              </div>
              <div className="mt-4 text-2xl font-extrabold tracking-wide">MOVIES</div>
              <div className="mt-1 text-xs uppercase tracking-widest opacity-80">
                {counts.movie} filmes
              </div>
            </div>
          </button>

          {/* Series */}
          <button
            onClick={() => onSelect("series")}
            className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${TILES[2].gradient} p-6 text-left shadow-xl transition hover:scale-[1.015] hover:shadow-2xl`}
          >
            <div className="flex h-full flex-col items-center justify-center text-white">
              <Tv className="h-16 w-16" strokeWidth={1.5} />
              <div className="mt-4 text-2xl font-extrabold tracking-wide">SERIES</div>
              <div className="mt-1 text-xs uppercase tracking-widest opacity-80">
                {counts.series} séries
              </div>
            </div>
          </button>

          {/* Favorites */}
          <button
            onClick={() => onSelect("favorites")}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${TILES[3].gradient} p-5 text-left shadow-xl transition hover:scale-[1.015]`}
          >
            <div className="flex h-full items-center justify-center gap-3 text-white">
              <Heart className="h-7 w-7" />
              <div className="text-lg font-extrabold tracking-wide">FAVORITES</div>
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold">
              {counts.favorites}
            </div>
          </button>

          {/* Settings (disabled placeholder) */}
          <button
            disabled
            className="group relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600/60 to-slate-800/60 p-5 text-left shadow-xl opacity-70 cursor-not-allowed"
          >
            <div className="flex h-full items-center justify-center gap-3 text-white">
              <Settings className="h-7 w-7" />
              <div className="text-lg font-extrabold tracking-wide">SETTINGS</div>
            </div>
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>FlixTV · IPTV Player Premium</span>
          <span>Powered by Smart Hub Play</span>
        </div>
      </div>
    </div>
  );
}
