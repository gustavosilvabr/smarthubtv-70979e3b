import { Film, Tv, Radio } from "lucide-react";
import type { ContentType } from "@/types/iptv";
import { imageKindLabel } from "@/utils/media";

interface Props {
  title: string;
  type: ContentType;
}

export function MediaFallback({ title, type }: Props) {
  const Icon = type === "live" ? Radio : type === "series" ? Tv : Film;
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || imageKindLabel(type).slice(0, 2);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-card via-secondary to-accent">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_color-mix(in_oklab,var(--primary)_28%,transparent),transparent_48%)]" />
      <div className="relative flex flex-col items-center gap-2 px-3 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-background/50 ring-1 ring-border">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="text-xl font-black tracking-wide text-foreground">{initials}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {imageKindLabel(type)}
        </div>
      </div>
    </div>
  );
}