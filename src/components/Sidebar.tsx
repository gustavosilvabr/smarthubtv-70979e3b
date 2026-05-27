import { Film, Heart, Radio, Tv, X } from "lucide-react";
import type { ContentType } from "@/types/iptv";

export type Tab = ContentType | "favorites";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
  counts: Record<Tab, number>;
  open: boolean;
  onClose: () => void;
}

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "live", label: "Canais ao vivo", icon: Radio },
  { id: "movie", label: "Filmes", icon: Film },
  { id: "series", label: "Séries", icon: Tv },
  { id: "favorites", label: "Favoritos", icon: Heart },
];

export function Sidebar({ active, onChange, counts, open, onClose }: Props) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 border-r border-border bg-card transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 md:hidden">
          <span className="font-bold">Menu</span>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{t.label}</span>
                <span className={`text-xs ${isActive ? "opacity-90" : "text-muted-foreground"}`}>
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-xs text-muted-foreground border-t border-border">
          FlixTV · IPTV Player
        </div>
      </aside>
    </>
  );
}
