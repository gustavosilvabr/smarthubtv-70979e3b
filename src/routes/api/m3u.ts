import { createFileRoute } from "@tanstack/react-router";
import { buildLiveStreamUrls } from "@/utils/buildLiveStreamUrls";
import { DEFAULT_IPTV_SETTINGS, normalizeIptvSettings } from "@/utils/iptvSettings";
import { parseEpisode } from "@/utils/parseEpisode";

const DEFAULT_SETTINGS = DEFAULT_IPTV_SETTINGS;

interface LiveCategory {
  category_id: string;
  category_name: string;
}

interface LiveStream {
  stream_id: string | number;
  name: string;
  stream_icon?: string;
  category_id?: string;
}

interface VodCategory {
  category_id: string;
  category_name: string;
}

interface VodStream {
  stream_id: string | number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
}

interface SeriesStream {
  series_id: string | number;
  name: string;
  cover?: string;
  category_id?: string;
}

export const Route = createFileRoute("/api/m3u")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const settings = getSettingsFromRequest(request);
          const m3uUrl = `${settings.server}/get.php?username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}&type=m3u_plus&output=mpegts`;
          const [categoriesRes, streamsRes, vodCategoriesRes, vodStreamsRes, seriesRes, m3uRes] = await Promise.all([
            xtreamFetch(settings, "get_live_categories"),
            xtreamFetch(settings, "get_live_streams"),
            xtreamFetch(settings, "get_vod_categories"),
            xtreamFetch(settings, "get_vod_streams"),
            xtreamFetch(settings, "get_series"),
            fetch(m3uUrl, {
              headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
              redirect: "follow",
            }),
          ]);

          if (!m3uRes.ok) {
            return new Response(`Upstream error: ${m3uRes.status}`, { status: 502 });
          }

          const [categories, streams, vodCategories, vodStreams, seriesStreams, m3uText] = await Promise.all([
            categoriesRes.json() as Promise<LiveCategory[]>,
            streamsRes.json() as Promise<LiveStream[]>,
            vodCategoriesRes.json() as Promise<VodCategory[]>,
            vodStreamsRes.json() as Promise<VodStream[]>,
            seriesRes.json() as Promise<SeriesStream[]>,
            m3uRes.text(),
          ]);

          const liveM3u = buildLiveM3U(settings, categories, streams);
          const vodM3u = buildVodM3U(settings, vodCategories, vodStreams);
          const seriesM3u = keepOnlySeries(enrichSeriesLogos(m3uText, seriesStreams));
          const body = `${liveM3u}\n${vodM3u}\n${seriesM3u}`;

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          return new Response(`Fetch failed: ${(e as Error).message}`, { status: 500 });
        }
      },
    },
  },
});

function getSettingsFromRequest(request: Request) {
  const url = new URL(request.url);
  return normalizeIptvSettings({
    server: url.searchParams.get("server") || DEFAULT_SETTINGS.server,
    username: url.searchParams.get("username") || DEFAULT_SETTINGS.username,
    password: url.searchParams.get("password") || DEFAULT_SETTINGS.password,
  });
}

async function xtreamFetch(settings: typeof DEFAULT_SETTINGS, action: string) {
  const url = `${settings.server}/player_api.php?username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}&action=${action}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Xtream ${action} error: ${res.status}`);
  return res;
}

function buildLiveM3U(settings: typeof DEFAULT_SETTINGS, categories: LiveCategory[], streams: LiveStream[]) {
  const categoryNames = new Map(categories.map((c) => [String(c.category_id), c.category_name]));
  const lines = ["#EXTM3U"];

  for (const channel of streams) {
    if (!channel.stream_id) continue;
    const urls = buildLiveStreamUrls(
      settings.server,
      settings.username,
      settings.password,
      channel.stream_id,
    );
    const name = escapeAttr(channel.name || `Canal ${channel.stream_id}`);
    const logo = escapeAttr(channel.stream_icon || "");
    const group = escapeAttr(categoryNames.get(String(channel.category_id)) || "Canais ao vivo");

    lines.push(
      `#EXTINF:-1 tvg-id="${channel.stream_id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${channel.name}`,
      `#SMART-HUB:stream-id="${channel.stream_id}" fallback-url="${urls.ts}" type="live"`,
      urls.hls,
    );
  }

  return lines.join("\n");
}

function buildVodM3U(settings: typeof DEFAULT_SETTINGS, categories: VodCategory[], streams: VodStream[]) {
  const categoryNames = new Map(categories.map((c) => [String(c.category_id), c.category_name]));
  const lines: string[] = [];

  for (const movie of streams) {
    if (!movie.stream_id) continue;
    const ext = (movie.container_extension || "mp4").replace(/^\./, "") || "mp4";
    const name = escapeAttr(movie.name || `Filme ${movie.stream_id}`);
    const logo = escapeAttr(movie.stream_icon || "");
    const group = escapeAttr(categoryNames.get(String(movie.category_id)) || "Filmes");
    const url = `${settings.server}/movie/${encodeURIComponent(settings.username)}/${encodeURIComponent(settings.password)}/${movie.stream_id}.${ext}`;

    lines.push(
      `#EXTINF:-1 tvg-id="movie-${movie.stream_id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${movie.name}`,
      `#SMART-HUB:stream-id="movie-${movie.stream_id}" type="movie"`,
      url,
    );
  }

  return lines.join("\n");
}

function stripHeader(text: string) {
  return text.replace(/^#EXTM3U[^\n]*(\r?\n)?/i, "").trimStart();
}

function keepOnlySeries(text: string) {
  const lines = stripHeader(text).split(/\r?\n/);
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXTINF")) continue;

    const entry = [line];
    let url = "";
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (next && !next.startsWith("#")) {
        url = next;
        entry.push(lines[j]);
        break;
      }
      if (next) entry.push(lines[j]);
      j++;
    }

    if (url && /\/series\//i.test(url)) kept.push(...entry);
    i = j;
  }

  return kept.join("\n");
}

function enrichSeriesLogos(text: string, series: SeriesStream[]) {
  const logoByName = new Map(
    series
      .filter((show) => show.name && show.cover)
      .map((show) => [normalizeName(show.name), show.cover || ""]),
  );

  return text.split(/\r?\n/).map((line) => {
    if (!line.startsWith("#EXTINF")) return line;
    const commaIdx = line.lastIndexOf(",");
    const fullName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "";
    const showName = parseEpisode(fullName).showName;
    const logo = logoByName.get(normalizeName(showName));
    if (!logo) return line;

    if (/tvg-logo="[^"]*"/i.test(line)) {
      return line.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${escapeAttr(logo)}"`);
    }
    return line.replace("#EXTINF", `#EXTINF tvg-logo="${escapeAttr(logo)}"`);
  }).join("\n");
}

function normalizeName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
