import { createFileRoute } from "@tanstack/react-router";
import { buildLiveStreamUrls } from "@/utils/buildLiveStreamUrls";
import { DEFAULT_IPTV_SETTINGS, normalizeIptvSettings } from "@/utils/iptvSettings";

const DEFAULT_SETTINGS = DEFAULT_IPTV_SETTINGS;

interface LiveCategory { category_id: string; category_name: string }
interface LiveStream { stream_id: string | number; name: string; stream_icon?: string; category_id?: string }
interface VodCategory { category_id: string; category_name: string }
interface VodStream { stream_id: string | number; name: string; stream_icon?: string; category_id?: string; container_extension?: string }
interface SeriesStream { series_id: string | number; name: string; cover?: string; category_id?: string }

export const Route = createFileRoute("/api/m3u")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const settings = getSettingsFromRequest(request);

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const encoder = new TextEncoder();
            const write = (s: string) => controller.enqueue(encoder.encode(s));

            try {
              // LIVE
              const [liveCatsRes, liveStreamsRes] = await Promise.all([
                xtreamFetch(settings, "get_live_categories"),
                xtreamFetch(settings, "get_live_streams"),
              ]);
              const liveCats = (await liveCatsRes.json()) as LiveCategory[];
              const liveStreams = (await liveStreamsRes.json()) as LiveStream[];
              const liveCatMap = new Map(liveCats.map((c) => [String(c.category_id), c.category_name]));
              write("#EXTM3U\n");
              for (const ch of liveStreams) {
                if (!ch.stream_id) continue;
                const urls = buildLiveStreamUrls(settings.server, settings.username, settings.password, ch.stream_id);
                const name = escapeAttr(ch.name || `Canal ${ch.stream_id}`);
                const logo = escapeAttr(ch.stream_icon || "");
                const group = escapeAttr(liveCatMap.get(String(ch.category_id)) || "Canais ao vivo");
                write(
                  `#EXTINF:-1 tvg-id="${ch.stream_id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n` +
                  `#SMART-HUB:stream-id="${ch.stream_id}" fallback-url="${urls.ts}" type="live"\n` +
                  `${urls.hls}\n`,
                );
              }
              // free
              (liveStreams as unknown as unknown[]).length = 0;
              liveCatMap.clear();

              // VOD
              const [vodCatsRes, vodStreamsRes] = await Promise.all([
                xtreamFetch(settings, "get_vod_categories"),
                xtreamFetch(settings, "get_vod_streams"),
              ]);
              const vodCats = (await vodCatsRes.json()) as VodCategory[];
              const vodStreams = (await vodStreamsRes.json()) as VodStream[];
              const vodCatMap = new Map(vodCats.map((c) => [String(c.category_id), c.category_name]));
              write("\n");
              for (const m of vodStreams) {
                if (!m.stream_id) continue;
                const ext = (m.container_extension || "mp4").replace(/^\./, "") || "mp4";
                const name = escapeAttr(m.name || `Filme ${m.stream_id}`);
                const logo = escapeAttr(m.stream_icon || "");
                const group = escapeAttr(vodCatMap.get(String(m.category_id)) || "Filmes");
                const url = `${settings.server}/movie/${encodeURIComponent(settings.username)}/${encodeURIComponent(settings.password)}/${m.stream_id}.${ext}`;
                write(
                  `#EXTINF:-1 tvg-id="movie-${m.stream_id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${m.name}\n` +
                  `#SMART-HUB:stream-id="movie-${m.stream_id}" type="movie"\n` +
                  `${url}\n`,
                );
              }
              (vodStreams as unknown as unknown[]).length = 0;
              vodCatMap.clear();

              // SERIES — emit one entry per series directly from Xtream API.
              // Episodes are fetched on-demand by /api/series-info, which keeps
              // this endpoint fast and guarantees every series shows up.
              const [seriesCatsRes, seriesRes] = await Promise.all([
                xtreamFetch(settings, "get_series_categories"),
                xtreamFetch(settings, "get_series"),
              ]);
              const seriesCats = (await seriesCatsRes.json()) as VodCategory[];
              const seriesList = (await seriesRes.json()) as SeriesStream[];
              const seriesCatMap = new Map(
                seriesCats.map((c) => [String(c.category_id), c.category_name]),
              );
              write("\n");
              for (const s of seriesList) {
                if (!s.series_id) continue;
                const name = escapeAttr(s.name || `Série ${s.series_id}`);
                const logo = escapeAttr(s.cover || "");
                const group = escapeAttr(
                  seriesCatMap.get(String(s.category_id)) || "Séries",
                );
                write(
                  `#EXTINF:-1 tvg-id="series-${s.series_id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${s.name}\n` +
                    `#SMART-HUB:stream-id="series-${s.series_id}" type="series"\n` +
                    `xtream-series://${s.series_id}\n`,
                );
              }
              (seriesList as unknown as unknown[]).length = 0;
              seriesCatMap.clear();

              controller.close();
            } catch (e) {
              try {
                write(`\n# ERROR: ${(e as Error).message}\n`);
              } catch {}
              controller.error(e);
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
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

function enrichLogo(
  line: string,
  logoByName: Map<string, string>,
  logoEntries: Array<[string, string]>,
) {
  const commaIdx = line.lastIndexOf(",");
  const fullName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "";
  const showName = parseEpisode(fullName).showName;

  const candidates = uniq([
    normalizeName(showName),
    normalizeName(stripQualifiers(showName)),
    normalizeName(fullName),
    normalizeName(stripQualifiers(fullName)),
  ]).filter(Boolean);

  let logo: string | undefined;

  // 1) exact match on any candidate
  for (const c of candidates) {
    logo = logoByName.get(c);
    if (logo) break;
  }

  // 2) longest-prefix / contains match against series names
  if (!logo) {
    for (const c of candidates) {
      for (const [key, value] of logoEntries) {
        if (!key) continue;
        if (c === key || c.startsWith(key + " ") || c.includes(" " + key + " ")) {
          logo = value;
          break;
        }
      }
      if (logo) break;
    }
  }

  // 3) reverse: series name starts with the candidate (handles truncated episode titles)
  if (!logo) {
    for (const c of candidates) {
      if (c.length < 4) continue;
      for (const [key, value] of logoEntries) {
        if (key.startsWith(c + " ") || key === c) {
          logo = value;
          break;
        }
      }
      if (logo) break;
    }
  }

  if (!logo) return line;
  if (/tvg-logo="[^"]*"/i.test(line)) {
    return line.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${escapeAttr(logo)}"`);
  }
  return line.replace("#EXTINF", `#EXTINF tvg-logo="${escapeAttr(logo)}"`);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// Remove common quality/language/year markers and bracketed extras.
function stripQualifiers(value: string): string {
  return value
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(4k|fhd|hd|sd|uhd|hdr|dual|dublado|dub|legendado|leg|nac|nacional|completo|completa|temporada|season)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
