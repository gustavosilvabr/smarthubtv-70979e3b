import { createFileRoute } from "@tanstack/react-router";
import { buildLiveStreamUrls } from "@/utils/buildLiveStreamUrls";
import { DEFAULT_IPTV_SETTINGS, normalizeIptvSettings } from "@/utils/iptvSettings";
import { parseEpisode } from "@/utils/parseEpisode";

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

              // SERIES — stream m3u text line by line, keep only /series/, enrich logos
              const seriesRes = await xtreamFetch(settings, "get_series");
              const seriesList = (await seriesRes.json()) as SeriesStream[];
              const logoByName = new Map<string, string>();
              for (const s of seriesList) {
                if (s.name && s.cover) logoByName.set(normalizeName(s.name), s.cover);
              }
              // Sorted entries (longest normalized name first) for prefix fallback matching
              const logoEntries: Array<[string, string]> = [...logoByName.entries()].sort(
                (a, b) => b[0].length - a[0].length,
              );
              (seriesList as unknown as unknown[]).length = 0;

              const m3uUrl = `${settings.server}/get.php?username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}&type=m3u_plus&output=mpegts`;
              const m3uRes = await fetch(m3uUrl, {
                headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
                redirect: "follow",
              });
              if (!m3uRes.ok || !m3uRes.body) {
                throw new Error(`Upstream m3u error: ${m3uRes.status}`);
              }
              write("\n");

              const reader = m3uRes.body.getReader();
              const decoder = new TextDecoder();
              let buf = "";
              let pendingExtinf: string | null = null;
              let pendingExtras: string[] = [];

              const flushIfSeries = (url: string) => {
                if (!pendingExtinf) return;
                if (/\/series\//i.test(url)) {
                  write(pendingExtinf + "\n");
                  for (const ex of pendingExtras) write(ex + "\n");
                  write(url + "\n");
                }
                pendingExtinf = null;
                pendingExtras = [];
              };

              const processLine = (rawLine: string) => {
                const line = rawLine;
                if (line.startsWith("#EXTM3U")) return;
                if (line.startsWith("#EXTINF")) {
                  pendingExtinf = enrichLogo(line, logoByName, logoEntries);
                  pendingExtras = [];
                  return;
                }
                if (line.startsWith("#")) {
                  if (pendingExtinf) pendingExtras.push(line);
                  return;
                }
                const trimmed = line.trim();
                if (!trimmed) return;
                flushIfSeries(trimmed);
              };

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx: number;
                while ((idx = buf.indexOf("\n")) >= 0) {
                  const line = buf.slice(0, idx).replace(/\r$/, "");
                  buf = buf.slice(idx + 1);
                  processLine(line);
                }
              }
              if (buf.length) processLine(buf.replace(/\r$/, ""));

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

function enrichLogo(line: string, logoByName: Map<string, string>) {
  const commaIdx = line.lastIndexOf(",");
  const fullName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "";
  const showName = parseEpisode(fullName).showName;
  const logo = logoByName.get(normalizeName(showName));
  if (!logo) return line;
  if (/tvg-logo="[^"]*"/i.test(line)) {
    return line.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${escapeAttr(logo)}"`);
  }
  return line.replace("#EXTINF", `#EXTINF tvg-logo="${escapeAttr(logo)}"`);
}

function normalizeName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
