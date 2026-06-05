import { Platform } from "react-native";
import { IptvSettings } from "./settings";

export type ContentType = "live" | "movie" | "series";

export interface M3UItem {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  fallbackUrl?: string;
  type: ContentType;
  streamId?: string | number;
}

export interface SeriesEpisode {
  id: string;
  name: string;
  title: string;
  logo?: string;
  url: string;
  episodeNum: number;
  seasonNum: number;
  info?: any;
}

export interface EpgProgram {
  id: string;
  title: string;
  description: string;
  start: number; // unix seconds
  stop: number; // unix seconds
}

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function b64decode(str: string): string {
  if (!str) return "";
  try {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let buffer = "";
    const cleanStr = str.replace(/=+$/, "");
    for (let i = 0; i < cleanStr.length; i += 4) {
      const c1 = chars.indexOf(cleanStr[i]);
      const c2 = chars.indexOf(cleanStr[i + 1] || "A");
      const c3 = chars.indexOf(cleanStr[i + 2] || "A");
      const c4 = chars.indexOf(cleanStr[i + 3] || "A");

      const val = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
      
      const char1 = String.fromCharCode((val >> 16) & 255);
      const char2 = String.fromCharCode((val >> 8) & 255);
      const char3 = String.fromCharCode(val & 255);

      buffer += char1;
      if (cleanStr[i + 2]) buffer += char2;
      if (cleanStr[i + 3]) buffer += char3;
    }
    
    return decodeURIComponent(
      Array.from(buffer)
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    try {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let buffer = "";
      const cleanStr = str.replace(/=+$/, "");
      for (let i = 0; i < cleanStr.length; i += 4) {
        const c1 = chars.indexOf(cleanStr[i]);
        const c2 = chars.indexOf(cleanStr[i + 1] || "A");
        const c3 = chars.indexOf(cleanStr[i + 2] || "A");
        const c4 = chars.indexOf(cleanStr[i + 3] || "A");
        const val = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
        buffer += String.fromCharCode((val >> 16) & 255);
        if (cleanStr[i + 2]) buffer += String.fromCharCode((val >> 8) & 255);
        if (cleanStr[i + 3]) buffer += String.fromCharCode(val & 255);
      }
      return buffer;
    } catch {
      return str;
    }
  }
}

async function xtreamFetch(settings: IptvSettings, action: string, extraParams: string = "") {
  const server = cleanUrl(settings.server);
  const username = encodeURIComponent(settings.username);
  const password = encodeURIComponent(settings.password);
  
  const url = `${server}/player_api.php?username=${username}&password=${password}&action=${action}${extraParams}`;
  
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") {
    headers["User-Agent"] = "VLC/3.0.20 LibVLC/3.0.20";
  }

  const res = await fetch(url, { headers });
  
  if (!res.ok) {
    throw new Error(`Xtream ${action} respondeu com erro: ${res.status}`);
  }
  return res.json();
}

/**
 * Validate credentials against Xtream API
 */
export async function validateCredentials(settings: IptvSettings): Promise<boolean> {
  const server = cleanUrl(settings.server);
  const username = encodeURIComponent(settings.username);
  const password = encodeURIComponent(settings.password);
  
  const url = `${server}/player_api.php?username=${username}&password=${password}`;
  
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") {
    headers["User-Agent"] = "VLC/3.0.20 LibVLC/3.0.20";
  }

  const res = await fetch(url, { headers });
  
  if (!res.ok) return false;
  const data = await res.json();
  return !!(data?.user_info?.auth === 1 || data?.user_info?.status === "Active");
}

/**
 * Fetch all channels, movies, and series lists in sequential loading phases
 */
export async function fetchIptvData(
  settings: IptvSettings,
  onPhaseChange: (phase: "live" | "vod" | "series" | "epg" | "done") => void
): Promise<M3UItem[]> {
  const items: M3UItem[] = [];
  const server = cleanUrl(settings.server);
  const username = settings.username;
  const password = settings.password;

  // PHASE 1: Live TV
  onPhaseChange("live");
  try {
    const [liveCats, liveStreams] = await Promise.all([
      xtreamFetch(settings, "get_live_categories"),
      xtreamFetch(settings, "get_live_streams"),
    ]);

    const liveCatMap = new Map<string, string>(
      Array.isArray(liveCats) ? liveCats.map((c: any) => [String(c.category_id), String(c.category_name)]) : []
    );

    if (Array.isArray(liveStreams)) {
      for (const ch of liveStreams) {
        if (!ch.stream_id) continue;
        const group = liveCatMap.get(String(ch.category_id)) || "Canais ao vivo";
        const hlsUrl = `${server}/live/${username}/${password}/${ch.stream_id}.m3u8`;
        const tsUrl = `${server}/live/${username}/${password}/${ch.stream_id}.ts`;
        
        items.push({
          id: `live:${ch.stream_id}:${stableHash(`${ch.name}|${group}|${hlsUrl}`)}`,
          name: ch.name || `Canal ${ch.stream_id}`,
          logo: ch.stream_icon || "",
          group,
          url: hlsUrl,
          fallbackUrl: tsUrl,
          type: "live",
          streamId: ch.stream_id,
        });
      }
    }
  } catch (err) {
    console.error("Erro ao buscar Canais Ao Vivo:", err);
  }

  // PHASE 2: Movies (VOD)
  onPhaseChange("vod");
  try {
    const [vodCats, vodStreams] = await Promise.all([
      xtreamFetch(settings, "get_vod_categories"),
      xtreamFetch(settings, "get_vod_streams"),
    ]);

    const vodCatMap = new Map<string, string>(
      Array.isArray(vodCats) ? vodCats.map((c: any) => [String(c.category_id), String(c.category_name)]) : []
    );

    if (Array.isArray(vodStreams)) {
      for (const m of vodStreams) {
        if (!m.stream_id) continue;
        const ext = (m.container_extension || "mp4").replace(/^\./, "") || "mp4";
        const group = vodCatMap.get(String(m.category_id)) || "Filmes";
        const movieUrl = `${server}/movie/${username}/${password}/${m.stream_id}.${ext}`;

        items.push({
          id: `movie:${m.stream_id}:${stableHash(`${m.name}|${group}|${movieUrl}`)}`,
          name: m.name || `Filme ${m.stream_id}`,
          logo: m.stream_icon || "",
          group,
          url: movieUrl,
          type: "movie",
          streamId: m.stream_id,
        });
      }
    }
  } catch (err) {
    console.error("Erro ao buscar Filmes:", err);
  }

  // PHASE 3: Series
  onPhaseChange("series");
  try {
    const [seriesCats, seriesList] = await Promise.all([
      xtreamFetch(settings, "get_series_categories"),
      xtreamFetch(settings, "get_series"),
    ]);

    const seriesCatMap = new Map<string, string>(
      Array.isArray(seriesCats) ? seriesCats.map((c: any) => [String(c.category_id), String(c.category_name)]) : []
    );

    if (Array.isArray(seriesList)) {
      for (const s of seriesList) {
        if (!s.series_id) continue;
        const group = seriesCatMap.get(String(s.category_id)) || "Séries";
        const placeholderUrl = `xtream-series://${s.series_id}`;

        items.push({
          id: `series:${s.series_id}:${stableHash(`${s.name}|${group}|placeholderUrl`)}`,
          name: s.name || `Série ${s.series_id}`,
          logo: s.cover || "",
          group,
          url: placeholderUrl,
          type: "series",
          streamId: s.series_id,
        });
      }
    }
  } catch (err) {
    console.error("Erro ao buscar Séries:", err);
  }

  // PHASE 4: EPG (Simulated completion phase)
  onPhaseChange("epg");
  await new Promise((resolve) => setTimeout(resolve, 500));

  onPhaseChange("done");
  return items;
}

/**
 * Fetch series info and list of episodes grouped by season
 */
export async function fetchSeriesDetails(
  settings: IptvSettings,
  seriesId: string | number
): Promise<{ info: any; episodes: Record<number, SeriesEpisode[]> }> {
  const data = await xtreamFetch(settings, "get_series_info", `&series_id=${seriesId}`);
  const episodesGrouped: Record<number, SeriesEpisode[]> = {};
  const server = cleanUrl(settings.server);
  const username = settings.username;
  const password = settings.password;

  if (data && data.episodes) {
    const seasons = Object.keys(data.episodes);
    for (const sKey of seasons) {
      const seasonNum = parseInt(sKey, 10);
      const eps = data.episodes[sKey];
      if (Array.isArray(eps)) {
        episodesGrouped[seasonNum] = eps.map((e: any) => {
          const ext = (e.container_extension || "mp4").replace(/^\./, "") || "mp4";
          const streamUrl = `${server}/series/${username}/${password}/${e.id}.${ext}`;
          return {
            id: String(e.id),
            name: e.title || `Episódio ${e.episode_num}`,
            title: e.title || `Episódio ${e.episode_num}`,
            logo: e.info?.movie_image || undefined,
            url: streamUrl,
            episodeNum: parseInt(e.episode_num || "0", 10),
            seasonNum: seasonNum,
            info: e.info,
          };
        });
      }
    }
  }

  return {
    info: data?.info || {},
    episodes: episodesGrouped,
  };
}

/**
 * Fetch EPG listings for a specific channel
 */
export async function fetchChannelEpg(
  settings: IptvSettings,
  streamId: string | number,
  limit: number = 10
): Promise<EpgProgram[]> {
  try {
    const data = await xtreamFetch(settings, "get_short_epg", `&stream_id=${streamId}&limit=${limit}`);
    const list = data?.epg_listings || [];
    
    const toSec = (value: any): number => {
      if (value == null) return 0;
      const n = Number(value);
      if (!Number.isNaN(n)) return n > 1e12 ? Math.floor(n / 1000) : n;
      return 0;
    };

    return list.map((p: any, i: number) => ({
      id: String(p.id ?? i),
      title: b64decode(p.title || "") || "Sem informação",
      description: b64decode(p.description || ""),
      start: toSec(p.start_timestamp ?? p.start),
      stop: toSec(p.stop_timestamp ?? p.stop ?? p.end),
    }))
    .filter((p: any) => p.start && p.stop)
    .sort((a: any, b: any) => a.start - b.start);
  } catch (err) {
    console.error("Erro ao buscar EPG:", err);
    return [];
  }
}
