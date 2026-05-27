import type { ContentType } from "@/types/iptv";

export function classifyContent(group: string, url: string): ContentType {
  const g = group.toUpperCase();
  const u = url.toLowerCase();
  if (/SÉRIE|SERIE|SERIES|TEMPORADA|EPISÓDIO|EPISODIO|SEASON/.test(g)) return "series";
  if (/FILME|MOVIE|VOD|CINEMA/.test(g)) return "movie";
  if (u.includes("/series/")) return "series";
  if (u.includes("/movie/") || u.endsWith(".mp4") || u.endsWith(".mkv")) return "movie";
  return "live";
}
