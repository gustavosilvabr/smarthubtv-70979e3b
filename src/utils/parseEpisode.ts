import type { M3UItem } from "@/types/iptv";

export interface EpisodeInfo {
  showName: string;
  season: number;
  episode: number;
}

const PATTERNS: RegExp[] = [
  /^(.*?)[\s\-_.]+S(\d{1,2})[\s\-_.]*E(\d{1,3})/i,
  /^(.*?)[\s\-_.]+(\d{1,2})x(\d{1,3})\b/i,
  /^(.*?)[\s\-_.]+Temporada\s*(\d{1,2})[\s\-_.]+Epis[oó]dio\s*(\d{1,3})/i,
  /^(.*?)[\s\-_.]+T(\d{1,2})[\s\-_.]*E(\d{1,3})/i,
];

export function parseEpisode(name: string): EpisodeInfo {
  for (const re of PATTERNS) {
    const m = name.match(re);
    if (m) {
      return {
        showName: m[1].replace(/[\s\-_.]+$/g, "").trim() || name,
        season: parseInt(m[2], 10) || 1,
        episode: parseInt(m[3], 10) || 1,
      };
    }
  }
  return { showName: name.trim(), season: 1, episode: 1 };
}

export interface SeriesShow {
  id: string;
  name: string;
  logo: string;
  group: string;
  seasons: Map<number, M3UItem[]>;
  episodeCount: number;
}

export function groupSeries(items: M3UItem[]): SeriesShow[] {
  const map = new Map<string, SeriesShow>();
  for (const it of items) {
    const info = parseEpisode(it.name);
    const key = `${it.group}::${info.showName.toLowerCase()}`;
    let show = map.get(key);
    if (!show) {
      show = {
        id: key,
        name: info.showName,
        logo: it.logo,
        group: it.group,
        seasons: new Map(),
        episodeCount: 0,
      };
      map.set(key, show);
    }
    if (!show.logo && it.logo) show.logo = it.logo;
    if (!show.seasons.has(info.season)) show.seasons.set(info.season, []);
    show.seasons.get(info.season)!.push(it);
    show.episodeCount++;
  }
  for (const show of map.values()) {
    for (const eps of show.seasons.values()) {
      eps.sort((a, b) => {
        const ea = parseEpisode(a.name).episode;
        const eb = parseEpisode(b.name).episode;
        return ea - eb;
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
