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
    label: "TV AO VIVO",
    icon: Radio,
    gradient: "from-emerald-400 via-cyan-500 to-indigo-600",
    large: true,
  },
  {
    id: "movie",
    label: "FILMES",
    icon: Film,
    gradient: "from-rose-500 via-red-500 to-amber-500",
  },
  {
    id: "series",
    label: "SÉRIES",
    icon: Tv,
    gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
  },
  {
    id: "settings",
    label: "CONFIGURAÇÕES",
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

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-3 sm:px-6 py-4 sm:py-8 min-h-screen">
        {/* Top bar - different layout for mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
          {/* Mobile: Logo centered and large */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
              <Logo className="h-56 sm:h-32 md:h-48 w-auto drop-shadow-[0_0_30px_rgba(168,85,247,0.6)]" />
            </div>
          </div>

          {/* Time - right side on desktop, below logo on mobile */}
          <div className="flex justify-center sm:justify-end w-full sm:w-auto">
            <div className="text-center sm:text-right">
              <div className="text-2xl sm:text-2xl font-semibold tabular-nums">{time}</div>
              <div className="text-xs text-muted-foreground">{date}</div>
            </div>
          </div>
        </div>

        {/* Tile grid */}
        <div className="mt-6 sm:mt-8 md:mt-10 grid flex-1 gap-3 md:gap-5 grid-cols-1 md:grid-cols-3 md:grid-rows-2">
          {/* Live TV - tall left */}
          <button
            onClick={() => onSelect("live")}
            className={`group relative md:row-span-2 overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br ${TILES[0].gradient} p-4 md:p-6 text-left shadow-xl transition hover:scale-[1.015] hover:shadow-2xl`}
          >
            <div className="flex h-full flex-col items-center justify-center text-white">
              <Radio className="h-14 w-14 md:h-28 md:w-28 drop-shadow-lg" strokeWidth={1.5} />
              <div className="mt-4 md:mt-6 text-xl md:text-4xl font-extrabold tracking-wide">TV AO VIVO</div>
              <div className="mt-1 md:mt-2 text-xs uppercase tracking-widest opacity-80">
                {counts.live} canais
              </div>
            </div>
          </button>

          {/* Movies */}
          <button
            onClick={() => onSelect("movie")}
            className={`group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br ${TILES[1].gradient} p-4 md:p-6 text-left shadow-xl transition hover:scale-[1.015] hover:shadow-2xl`}
          >
            <div className="flex h-full flex-col items-center justify-center text-white">
              <div className="grid h-14 w-14 md:h-20 md:w-20 place-items-center rounded-full border-4 border-white/90">
                <Film className="h-6 w-6 md:h-9 md:w-9" />
              </div>
              <div className="mt-3 md:mt-4 text-lg md:text-2xl font-extrabold tracking-wide">FILMES</div>
              <div className="mt-1 text-xs uppercase tracking-widest opacity-80">
                {counts.movie} filmes
              </div>
            </div>
          </button>

          {/* Series */}
          <button
            onClick={() => onSelect("series")}
            className={`group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br ${TILES[2].gradient} p-4 md:p-6 text-left shadow-xl transition hover:scale-[1.015] hover:shadow-2xl`}
          >
            <div className="flex h-full flex-col items-center justify-center text-white">
              <Tv className="h-12 w-12 md:h-16 md:w-16" strokeWidth={1.5} />
              <div className="mt-3 md:mt-4 text-lg md:text-2xl font-extrabold tracking-wide">SÉRIES</div>
              <div className="mt-1 text-xs uppercase tracking-widest opacity-80">
                {counts.series} séries
              </div>
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => onSelect("settings")}
            className={`group relative col-span-1 md:col-span-1 overflow-hidden rounded-2xl md:rounded-2xl bg-gradient-to-br ${TILES[3].gradient} p-4 md:p-5 text-left shadow-xl transition hover:scale-[1.015]`}
          >
            <div className="flex h-full items-center justify-center gap-2 md:gap-3 text-white">
              <Settings className="h-6 w-6 md:h-7 md:w-7" />
              <div className="text-base md:text-lg font-extrabold tracking-wide">CONFIGURAÇÕES</div>
            </div>
          </button>
        </div>

        <div className="mt-4 sm:mt-8 flex flex-col items-center gap-1 text-xs sm:text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>Smart Hub Play TV · IPTV Player Premium</span>
          <span>Powered by Smart Hub</span>
        </div>
      </div>
    </div>
  );
}
