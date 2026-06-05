import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Loader2 } from "lucide-react";
import type { EpgProgram } from "@/routes/api/epg";
import { useGsapEntrance } from "@/hooks/useGsapEntrance";
import { useRef } from "react";

interface Props {
  streamId?: string | number;
  settingsQuery: string;
}

function formatTime(ts: number) {
  if (!ts) return "--:--";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function EpgPanel({ streamId, settingsQuery }: Props) {
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(scrollerRef, { x: 30, opacity: 0, duration: 0.5, staggerSelector: ".epg-item" });
  useGsapEntrance(detailRef, { y: 20, opacity: 0, duration: 0.4, delay: 0.2 });

  // Live clock for progress bar
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch EPG when channel changes
  useEffect(() => {
    if (!streamId) {
      setPrograms([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    fetch(`/api/epg?streamId=${encodeURIComponent(String(streamId))}&limit=24&${settingsQuery}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPrograms(Array.isArray(data.programs) ? data.programs : []);
        if (data.error) setError("Sem guia disponível para este canal.");
      })
      .catch(() => {
        if (!cancelled) setError("Falha ao carregar o guia.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [streamId, settingsQuery]);

  const currentIdx = useMemo(
    () => programs.findIndex((p) => p.start <= now && now < p.stop),
    [programs, now],
  );
  const current = currentIdx >= 0 ? programs[currentIdx] : null;
  const progressPct =
    current && current.stop > current.start
      ? Math.min(100, Math.max(0, ((now - current.start) / (current.stop - current.start)) * 100))
      : 0;

  const selected = selectedId
    ? programs.find((p) => p.id === selectedId) || current
    : current;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#140a24]/80 p-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Calendar className="h-4 w-4 text-amber-300" />
        <span className="text-xs font-bold uppercase tracking-wider text-white/80">
          Guia de programação
        </span>
        {loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-white/50" />}
      </div>

      {!streamId ? (
        <p className="px-2 py-3 text-xs text-white/40">Selecione um canal.</p>
      ) : error && programs.length === 0 ? (
        <p className="px-2 py-3 text-xs text-white/40">{error}</p>
      ) : !loading && programs.length === 0 ? (
        <p className="px-2 py-3 text-xs text-white/40">Nenhuma programação encontrada.</p>
      ) : (
        <>
          {/* Hour-grid scroller */}
          <div ref={scrollerRef} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
            {programs.map((p, i) => {
              const isLive = i === currentIdx;
              const isPast = p.stop <= now;
              const isActive = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={[
                    "epg-item group flex min-w-[180px] max-w-[220px] shrink-0 flex-col gap-1 rounded-xl border px-3 py-2 text-left transition focus:outline-none",
                    isActive
                      ? "border-amber-400/70 bg-gradient-to-br from-purple-700/60 to-purple-900/70 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
                      : isLive
                      ? "border-amber-400/40 bg-purple-900/40 hover:border-amber-400/60"
                      : isPast
                      ? "border-white/5 bg-black/20 text-white/40 hover:border-white/15"
                      : "border-white/5 bg-black/30 hover:border-white/15 hover:bg-purple-900/30",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1 text-[10px] font-bold tabular-nums uppercase tracking-wider",
                        isLive ? "text-amber-300" : "text-white/60",
                      ].join(" ")}
                    >
                      <Clock className="h-3 w-3" />
                      {formatTime(p.start)} – {formatTime(p.stop)}
                    </span>
                    {isLive && (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                        Ao vivo
                      </span>
                    )}
                  </div>
                  <div
                    className={[
                      "line-clamp-2 text-xs font-semibold",
                      isActive || isLive ? "text-white" : "text-white/80",
                    ].join(" ")}
                  >
                    {p.title}
                  </div>
                  {isLive && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                  <div className="text-[10px] text-white/40">{formatDay(p.start)}</div>
                </button>
              );
            })}
          </div>

          {/* Selected program detail */}
          {selected && (
            <div ref={detailRef} className="mt-1 rounded-xl border border-white/5 bg-black/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{selected.title}</div>
                  <div className="text-[11px] text-white/50">
                    {formatDay(selected.start)} · {formatTime(selected.start)} –{" "}
                    {formatTime(selected.stop)}
                  </div>
                </div>
                {selected.id === current?.id && (
                  <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                    Agora
                  </span>
                )}
              </div>
              {selected.description && (
                <p className="mt-2 line-clamp-3 text-xs text-white/70">{selected.description}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
