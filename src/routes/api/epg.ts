import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_IPTV_SETTINGS, normalizeIptvSettings } from "@/utils/iptvSettings";

export interface EpgProgram {
  id: string;
  title: string;
  description: string;
  start: number; // unix seconds
  stop: number; // unix seconds
}

function b64decode(value: string): string {
  if (!value) return "";
  try {
    if (typeof atob === "function") {
      const bin = atob(value);
      // Decode as UTF-8
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    }
  } catch {}
  return value;
}

function toSec(value: string | number | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value > 1e12 ? Math.floor(value / 1000) : value;
  const n = Number(value);
  if (!Number.isNaN(n)) return n > 1e12 ? Math.floor(n / 1000) : n;
  // Try date string
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}

export const Route = createFileRoute("/api/epg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const streamId = url.searchParams.get("streamId");
        const limit = Number(url.searchParams.get("limit") || "12");
        if (!streamId) {
          return new Response(JSON.stringify({ error: "missing streamId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const settings = normalizeIptvSettings({
          server: url.searchParams.get("server") || DEFAULT_IPTV_SETTINGS.server,
          username: url.searchParams.get("username") || DEFAULT_IPTV_SETTINGS.username,
          password: url.searchParams.get("password") || DEFAULT_IPTV_SETTINGS.password,
        });

        try {
          const apiUrl = `${settings.server}/player_api.php?username=${encodeURIComponent(settings.username)}&password=${encodeURIComponent(settings.password)}&action=get_short_epg&stream_id=${encodeURIComponent(streamId)}&limit=${limit}`;
          const res = await fetch(apiUrl, {
            headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
            redirect: "follow",
          });
          if (!res.ok) throw new Error(`upstream ${res.status}`);
          const data = (await res.json()) as {
            epg_listings?: Array<{
              id?: string | number;
              title?: string;
              description?: string;
              start?: string | number;
              end?: string | number;
              stop?: string | number;
              start_timestamp?: string | number;
              stop_timestamp?: string | number;
            }>;
          };
          const list = data.epg_listings || [];
          const out: EpgProgram[] = list.map((p, i) => ({
            id: String(p.id ?? i),
            title: b64decode(p.title || "") || "Sem informação",
            description: b64decode(p.description || ""),
            start: toSec(p.start_timestamp ?? p.start),
            stop: toSec(p.stop_timestamp ?? p.stop ?? p.end),
          }))
          .filter((p) => p.start && p.stop)
          .sort((a, b) => a.start - b.start);

          return new Response(JSON.stringify({ programs: out }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=120",
            },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message, programs: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
