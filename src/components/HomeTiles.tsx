import { useEffect, useState } from "react";
import { Film, Radio, Settings, Tv } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { Tab } from "./Sidebar";

export type HomeTileTarget = Tab | "settings";

interface Props {
  counts: Record<Tab, number>;
  onSelect: (tab: HomeTileTarget) => void;
}

interface Tile {
  id: Tab | "settings";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  large?: boolean;
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
    id: "settings",
    label: "SETTINGS",
    icon: Settings,
    gradient: "from-emerald-500/80 to-teal-600/80",
  },
];

export function HomeTiles({ counts, onSelect }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const time = now ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const date = now ? now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(126,34,206,0.25)_0%,_#0a0613_60%,_#050308_100%)] text-foreground">
      {/* Purple ambience */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[160px]" />
        <div className="absolute bottom-[-200px] left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[160px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 py-8 min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Logo className="h-28 w-auto drop-shadow-[0_0_30px_rgba(168,85,247,0.6)] md:h-40" />

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

          {/* Settings */}
          <button
            onClick={() => onSelect("settings")}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${TILES[3].gradient} p-5 text-left shadow-xl transition hover:scale-[1.015]`}
          >
            <div className="flex h-full items-center justify-center gap-3 text-white">
              <Settings className="h-7 w-7" />
              <div className="text-lg font-extrabold tracking-wide">SETTINGS</div>
            </div>
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>Smart Hub Play TV · IPTV Player Premium</span>
          <span>Powered by Smart Hub</span>
        </div>
      </div>
    </div>
  );
}
