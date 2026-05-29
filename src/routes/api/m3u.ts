import { createFileRoute } from "@tanstack/react-router";
import { buildLiveStreamUrls } from "@/utils/buildLiveStreamUrls";

const XTREAM_SERVER = "https://blckbr.shop";
const XTREAM_USERNAME = "janio798";
const XTREAM_PASSWORD = "7338644862";
const M3U_URL = `${XTREAM_SERVER}/get.php?username=${XTREAM_USERNAME}&password=${XTREAM_PASSWORD}&type=m3u_plus&output=mpegts`;

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

export const Route = createFileRoute("/api/m3u")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [categoriesRes, streamsRes, m3uRes] = await Promise.all([
            xtreamFetch("get_live_categories"),
            xtreamFetch("get_live_streams"),
            fetch(M3U_URL, {
              headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
              redirect: "follow",
            }),
          ]);

          if (!m3uRes.ok) {
            return new Response(`Upstream error: ${m3uRes.status}`, { status: 502 });
          }

          const [categories, streams, m3uText] = await Promise.all([
            categoriesRes.json() as Promise<LiveCategory[]>,
            streamsRes.json() as Promise<LiveStream[]>,
            m3uRes.text(),
          ]);

          const liveM3u = buildLiveM3U(categories, streams);
          const body = `${liveM3u}\n${stripHeader(m3uText)}`;

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

async function xtreamFetch(action: "get_live_categories" | "get_live_streams") {
  const url = `${XTREAM_SERVER}/player_api.php?username=${XTREAM_USERNAME}&password=${XTREAM_PASSWORD}&action=${action}`;
  const res = await fetch(url, {
            headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
            redirect: "follow",
          });
  if (!res.ok) throw new Error(`Xtream ${action} error: ${res.status}`);
  return res;
}

function buildLiveM3U(categories: LiveCategory[], streams: LiveStream[]) {
  const categoryNames = new Map(categories.map((c) => [String(c.category_id), c.category_name]));
  const lines = ["#EXTM3U"];

  for (const channel of streams) {
    if (!channel.stream_id) continue;
    const urls = buildLiveStreamUrls(
      XTREAM_SERVER,
      XTREAM_USERNAME,
      XTREAM_PASSWORD,
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

function stripHeader(text: string) {
  return text.replace(/^#EXTM3U[^\n]*(\r?\n)?/i, "").trimStart();
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
