import { useEffect, useState } from "react";
import { Film, Radio, Settings, Tv } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { Tab } from "./Sidebar";
import { useGsapEntrance } from "@/hooks/useGsapEntrance";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

export type HomeTileTarget = Tab | "settings";

interface Props {
  counts: Record<Tab, number>;
  onSelect: (tab: HomeTileTarget) => void;
}

export function HomeTiles({ counts, onSelect }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const time = now ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const date = now ? now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

  const containerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(topBarRef, { y: -20, opacity: 0, duration: 0.6, ease: "power2.out" });
  useGsapEntrance(gridRef, { y: 40, staggerSelector: ".tile-item", delay: 0.1, duration: 0.7, ease: "back.out(1.2)" });
  useGsapEntrance(footerRef, { y: 10, delay: 0.5, duration: 0.5, ease: "power2.out" });

  useGSAP(
    () => {
      // Ambient floating bubbles
      gsap.to(".ambient-bubble", {
        y: "random(-30, 30)",
        x: "random(-30, 30)",
        scale: "random(0.9, 1.1)",
        duration: "random(4, 6)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.6,
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(126,34,206,0.25)_0%,_#0a0613_60%,_#050308_100%)] text-foreground">
      {/* Purple ambience */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-bubble absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[160px]" />
        <div className="ambient-bubble absolute bottom-[-200px] left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[160px]" />
      </div>

      {/* Full-height flex column — no scroll */}
      <div className="relative z-10 flex h-full flex-col px-3 sm:px-6 py-3 sm:py-4 mx-auto w-full max-w-[95vw] 2xl:max-w-[1600px]">

        {/* Top bar: Logo + Clock */}
        <div ref={topBarRef} className="flex items-center justify-between shrink-0">
          <Logo className="h-16 sm:h-20 md:h-24 lg:h-28 w-auto drop-shadow-[0_0_24px_rgba(168,85,247,0.6)]" />
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-semibold tabular-nums">{time}</div>
            <div className="text-[11px] text-muted-foreground">{date}</div>
          </div>
        </div>

        {/* Tile grid — fills remaining height */}
        <div ref={gridRef} className="mt-3 sm:mt-4 flex-1 grid gap-2 sm:gap-3 md:gap-4
          grid-cols-2 grid-rows-3
          sm:grid-cols-3 sm:grid-rows-2
          md:grid-cols-3 md:grid-rows-2
          min-h-0">

          {/* TV AO VIVO — ocupa 2 linhas no mobile (col 1-2, row 1) e col 1 em desktop */}
          <button
            onClick={() => onSelect("live")}
            className="tile-item group relative col-span-2 sm:col-span-1 sm:row-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-cyan-500 to-indigo-600 shadow-xl transition hover:scale-[1.015] hover:shadow-2xl focus:outline-none"
          >
            <div className="flex h-full flex-col items-center justify-center text-white p-3 sm:p-4">
              <Radio className="h-10 w-10 sm:h-16 sm:w-16 md:h-20 md:w-20 drop-shadow-lg" strokeWidth={1.5} />
              <div className="mt-2 sm:mt-3 text-lg sm:text-2xl md:text-3xl font-extrabold tracking-wide">TV AO VIVO</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-widest opacity-80">{counts.live} canais</div>
            </div>
          </button>

          {/* FILMES */}
          <button
            onClick={() => onSelect("movie")}
            className="tile-item group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-amber-500 shadow-xl transition hover:scale-[1.015] hover:shadow-2xl focus:outline-none"
          >
            <div className="flex h-full flex-col items-center justify-center text-white p-3 sm:p-4">
              <div className="grid h-10 w-10 sm:h-14 sm:w-14 place-items-center rounded-full border-[3px] border-white/90">
                <Film className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div className="mt-2 text-base sm:text-xl md:text-2xl font-extrabold tracking-wide">FILMES</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-widest opacity-80">{counts.movie} filmes</div>
            </div>
          </button>

          {/* SÉRIES */}
          <button
            onClick={() => onSelect("series")}
            className="tile-item group relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 shadow-xl transition hover:scale-[1.015] hover:shadow-2xl focus:outline-none"
          >
            <div className="flex h-full flex-col items-center justify-center text-white p-3 sm:p-4">
              <Tv className="h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14" strokeWidth={1.5} />
              <div className="mt-2 text-base sm:text-xl md:text-2xl font-extrabold tracking-wide">SÉRIES</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-widest opacity-80">{counts.series} séries</div>
            </div>
          </button>

          {/* CONFIGURAÇÕES — col-span-2 no mobile para preencher a última linha */}
          <button
            onClick={() => onSelect("settings")}
            className="tile-item group relative col-span-2 sm:col-span-1 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/80 to-teal-600/80 shadow-xl transition hover:scale-[1.015] focus:outline-none"
          >
            <div className="flex h-full items-center justify-center gap-2 sm:gap-3 text-white p-3 sm:p-4">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
              <div className="text-sm sm:text-base md:text-lg font-extrabold tracking-wide">CONFIGURAÇÕES</div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div ref={footerRef} className="mt-2 shrink-0 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
          <span>Smart Hub Play TV · IPTV Player Premium</span>
          <span>Powered by Smart Hub</span>
        </div>
      </div>
    </div>
  );
}
